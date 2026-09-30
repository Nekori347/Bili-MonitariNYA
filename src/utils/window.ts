import { getCurrentWindow, availableMonitors, Effect } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const appWindow = getCurrentWindow();

/**
 * The always-interactive strip at the top of the window, in CSS pixels.
 * In mouse pass-through mode everything below it forwards clicks to whatever
 * is behind the window, while this band keeps working — which is what lets the
 * same titlebar button switch the mode back off.
 */
export const TITLEBAR_BAND_CSS = 44;

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  try {
    await appWindow.setAlwaysOnTop(on);
  } catch {
    /* ignore if unsupported */
  }
}

/** Enable/disable partial mouse pass-through (no-op outside Tauri). */
export async function setClickThrough(enabled: boolean): Promise<void> {
  try {
    await invoke("set_click_through", { enabled, band: TITLEBAR_BAND_CSS });
  } catch {
    /* ignore if unsupported */
  }
}

export interface WindowBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Current outer frame in physical pixels. */
export async function readWindowBounds(): Promise<WindowBounds | null> {
  try {
    const [pos, size] = await Promise.all([appWindow.outerPosition(), appWindow.outerSize()]);
    return { x: pos.x, y: pos.y, w: size.width, h: size.height };
  } catch {
    return null;
  }
}

/**
 * Restore the frame the window had when it was last closed.
 *
 * The saved position is only reused if it still overlaps a connected monitor —
 * otherwise (monitor unplugged, resolution changed) the window recentres rather
 * than opening off-screen.
 */
export async function applyWindowBounds(b: WindowBounds): Promise<void> {
  try {
    const monitors = await availableMonitors();
    const reachable = monitors.some((m) => {
      const ax = m.position.x;
      const ay = m.position.y;
      const aw = m.size.width;
      const ah = m.size.height;
      return b.x < ax + aw && b.x + b.w > ax && b.y < ay + ah && b.y + b.h > ay;
    });
    if (!reachable) {
      await appWindow.center();
      return;
    }
    await appWindow.setSize(new PhysicalSize(Math.max(360, b.w), Math.max(600, b.h)));
    await appWindow.setPosition(new PhysicalPosition(b.x, b.y));
  } catch {
    /* ignore */
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
