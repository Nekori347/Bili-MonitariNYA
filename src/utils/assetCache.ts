import type { SyntheticEvent } from "react";

/**
 * Locally resolved asset URLs, kept for the life of the window.
 *
 * A value is a `convertFileSrc()` URL for a file that existed when it was
 * resolved. Clearing a user's cache directory does not simply delete the entry:
 * the mounted `<img>` must keep showing the picture it already has until a
 * fresh download succeeds, so the entry is *invalidated* instead and the
 * subscribers re-resolve it.
 */
const localByKey = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

export const assetKey = (key: string, url: string) => `${key}|${url}`;

export function rememberAsset(key: string, url: string, localSrc: string): void {
  localByKey.set(assetKey(key, url), localSrc);
}

export function recallAsset(key: string, url: string): string | undefined {
  return localByKey.get(assetKey(key, url));
}

/** Notify one resolved asset that its file is gone and should be re-fetched. */
export function subscribeAsset(keyUrl: string, cb: () => void): () => void {
  const set = listeners.get(keyUrl) ?? new Set<() => void>();
  set.add(cb);
  listeners.set(keyUrl, set);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(keyUrl);
  };
}

/**
 * The cache directory for one UP was removed. Every asset currently resolved
 * for that UP is asked to re-resolve; each keeps its current image on screen
 * until the replacement download lands.
 */
export function invalidateUserAssets(mid: number): void {
  const prefix = `users/${mid}/`;
  for (const [keyUrl, set] of [...listeners.entries()]) {
    if (!keyUrl.startsWith(prefix)) continue;
    localByKey.delete(keyUrl);
    for (const cb of [...set]) cb();
  }
}

/**
 * Keep a broken asset from ever showing the browser's broken-image glyph.
 * Hiding the element leaves its layout box intact, so nothing reflows.
 */
export function assetImgHandlers() {
  return {
    onError: (e: SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.style.visibility = "hidden";
    },
    onLoad: (e: SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.style.visibility = "visible";
    },
  };
}
