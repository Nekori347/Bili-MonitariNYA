import { useEffect, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

/**
 * Download a remote Bilibili asset into the app cache dir and return a local
 * src URL. Falls back to the remote URL on failure (never blocks the UI).
 */
export function useCachedAsset(url: string | undefined, key: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(url);

  useEffect(() => {
    if (!url) {
      setSrc(undefined);
      return;
    }
    let on = true;
    setSrc(url); // immediate remote fallback while downloading
    (async () => {
      try {
        const local = await invoke<string>("download_asset", { url, key });
        if (on) setSrc(convertFileSrc(local));
      } catch {
        /* keep remote URL */
      }
    })();
    return () => {
      on = false;
    };
  }, [url, key]);

  return src;
}
