import { useEffect, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

/**
 * Resolved local files, kept for the life of the window. Re-mounting a card
 * (switching subscriptions back and forth) then paints from `convertFileSrc`
 * synchronously instead of showing the remote URL for a frame.
 * The URL is part of the key because the backend stores one file per URL hash.
 */
const localByKey = new Map<string, string>();

/**
 * Download a remote Bilibili asset into the app cache dir and return a local
 * src URL. Falls back to the remote URL on failure (never blocks the UI).
 */
export function useCachedAsset(url: string | undefined, key: string): string | undefined {
  const cacheKey = url ? `${key}|${url}` : "";
  const [src, setSrc] = useState<string | undefined>(() =>
    url ? localByKey.get(cacheKey) ?? url : undefined,
  );

  useEffect(() => {
    if (!url) {
      setSrc(undefined);
      return;
    }
    const known = localByKey.get(cacheKey);
    if (known) {
      setSrc(known);
      return;
    }
    let on = true;
    setSrc(url); // immediate remote fallback while downloading
    (async () => {
      try {
        const local = await invoke<string>("download_asset", { url, key });
        const localSrc = convertFileSrc(local);
        localByKey.set(cacheKey, localSrc);
        if (on) setSrc(localSrc);
      } catch {
        /* keep remote URL */
      }
    })();
    return () => {
      on = false;
    };
  }, [url, key, cacheKey]);

  return src;
}
