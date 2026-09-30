import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  notes?: string;
  /** Opaque handle used by installUpdate. */
  raw: Update;
}

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Ask the configured endpoint (see tauri.conf.json → plugins.updater) whether a
 * newer release exists. Returns null when up to date or when running outside
 * Tauri / without a configured signing key.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  const update = await check();
  if (!update) return null;
  return { version: update.version, notes: update.body ?? undefined, raw: update };
}

/** Download + install, reporting 0-100 progress. Relaunches on success. */
export async function installUpdate(info: UpdateInfo, onProgress: (pct: number) => void): Promise<void> {
  let total = 0;
  let done = 0;
  await info.raw.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
    } else if (event.event === "Progress") {
      done += event.data.chunkLength;
      if (total > 0) onProgress(Math.min(100, Math.round((done / total) * 100)));
    } else if (event.event === "Finished") {
      onProgress(100);
    }
  });
  await relaunch();
}
