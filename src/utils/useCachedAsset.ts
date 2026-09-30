import { useEffect, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { assetKey, recallAsset, rememberAsset, subscribeAsset } from "./assetCache";

/** Only real remote assets are worth a disk round trip. */
function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Resolve a remote Bilibili asset to a local file URL.
 *
 * State machine:
 *   - already resolved locally → use it, nothing to do
 *   - not resolved yet         → show the origin URL while the download runs,
 *                                then swap to the local file
 *   - download failed          → keep whatever is on screen (never a path that
 *                                is known to be missing)
 *   - cache cleared            → re-resolve; the current image stays visible
 *                                until the replacement download succeeds
 *
 * A local path is only ever set from a *successful* download, so the UI cannot
 * end up pointing at a file that is not there.
 */
export function useCachedAsset(url: string | undefined, key: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(() =>
    url ? recallAsset(key, url) ?? url : undefined,
  );
  const [generation, setGeneration] = useState(0);

  // The UP's cache directory was cleared — re-fetch, but do not blank the image.
  useEffect(() => {
    if (!url) return;
    return subscribeAsset(assetKey(key, url), () => setGeneration((g) => g + 1));
  }, [url, key]);

  useEffect(() => {
    if (!url) {
      setSrc(undefined);
      return;
    }
    // A data: / asset: / inline value is already local — use it as-is.
    if (!isRemote(url)) {
      setSrc(url);
      return;
    }
    const known = recallAsset(key, url);
    if (known) {
      setSrc(known);
      return;
    }
    let on = true;
    // First resolve falls back to the origin URL; a re-resolve after a cache
    // clear keeps the previous image until the new file is ready.
    if (generation === 0) setSrc(url);
    (async () => {
      try {
        const local = await invoke<string>("download_asset", { url, key });
        // Cache-bust so the WebView re-reads a file that was just rewritten.
        const bust = generation > 0 ? `?v=${generation}` : "";
        const localSrc = convertFileSrc(local) + bust;
        rememberAsset(key, url, localSrc);
        if (on) setSrc(localSrc);
      } catch {
        /* keep whatever is on screen — an error must never blank the element */
      }
    })();
    return () => {
      on = false;
    };
  }, [url, key, generation]);

  return src;
}
