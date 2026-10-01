import { invoke } from "@tauri-apps/api/core";

/**
 * On-disk size of the asset cache, measured by the Rust side.
 *
 * `total` is the whole app cache directory except the WebView2 runtime's own
 * `EBWebView` folder (browser scratch, not the app's image cache — counting it
 * would swamp the number and make 清除缓存 look like it frees nothing).
 * `users` is keyed by mid as a string, matching the directory names on disk.
 */
export interface CacheUsage {
  total: number;
  users: Record<string, number>;
}

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Display form asked for by the cache page: MB, e.g. `2.3 MB`. */
export function formatCacheSize(bytes: number | undefined): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

/**
 * Read the cache sizes once.
 *
 * Read-only: creates, moves and deletes nothing, so it never disturbs the
 * existing cache layout or keys. Callers scan on mount — there is no polling,
 * no watcher and no background monitoring.
 */
export async function getCacheUsage(): Promise<CacheUsage> {
  if (!isTauri()) return { total: 0, users: {} };
  return invoke<CacheUsage>("cache_usage");
}
