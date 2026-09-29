import { getCurrentWindow, Effect } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const appWindow = getCurrentWindow();

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  try {
    await appWindow.setAlwaysOnTop(on);
  } catch {
    /* ignore if unsupported */
  }
}

/** Apply native window backdrop (Mica on Win11, Acrylic/Blur elsewhere). */
export async function applyWindowEffects(): Promise<void> {
  try {
    // Mica needs Win11; older Windows falls back to acrylic/blur. Any failure
    // is non-fatal — the CSS backdrop-filter in the UI is the visual fallback.
    await appWindow.setEffects({
      effects: [Effect.Mica, Effect.Acrylic, Effect.Blur],
    });
  } catch {
    /* ignore */
  }
}

/** Tell the Rust layer how the close button should behave. */
export async function setCloseBehavior(toTray: boolean): Promise<void> {
  try {
    await invoke("set_close_behavior", { toTray });
  } catch {
    /* ignore */
  }
}

export function onWindowHidden(cb: () => void): Promise<UnlistenFn> {
  return listen("window-hidden", cb);
}

export function onWindowShown(cb: () => void): Promise<UnlistenFn> {
  return listen("window-shown", cb);
}

export function onTrayRefresh(cb: () => void): Promise<UnlistenFn> {
  return listen("tray-refresh", cb);
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
