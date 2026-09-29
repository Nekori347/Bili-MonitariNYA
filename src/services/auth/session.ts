import { invoke } from "@tauri-apps/api/core";
import { setSessionCookie } from "../bilibili/client";

/**
 * Session cookie holder.
 *
 * The cookie lives in memory only; the persisted copy is a DPAPI-encrypted blob
 * written by the Rust layer (see src-tauri/src/secret.rs). It is never logged,
 * never written to SQLite and never sent anywhere except api.bilibili.com.
 */
let cookie: string | null = null;

setSessionCookie(null);

export function getCookie(): string | null {
  return cookie;
}

export function hasSession(): boolean {
  return !!cookie;
}

/** Keep the cookie names Bilibili needs; drop tracking-only ones. */
const KEEP = new Set(["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"]);

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Pull a `name=value` pair list out of raw Set-Cookie headers. */
export function cookiesFromHeaders(headers: string[]): string {
  const pairs = new Map<string, string>();
  for (const raw of headers) {
    const first = raw.split(";")[0];
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    const name = first.slice(0, idx).trim();
    const value = first.slice(idx + 1).trim();
    if (KEEP.has(name) && value) pairs.set(name, value);
  }
  return [...pairs.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Fallback: the poll response embeds the same values in its redirect URL. */
export function cookiesFromUrl(url: string): string {
  const pairs = new Map<string, string>();
  try {
    const q = new URL(url).search;
    const sp = new URLSearchParams(q);
    for (const [k, v] of sp.entries()) {
      if (KEEP.has(k) && v) pairs.set(k, v);
    }
  } catch {
    /* ignore */
  }
  return [...pairs.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Store the session (memory + encrypted on-disk copy). */
export async function persistSession(next: string): Promise<void> {
  cookie = next;
  setSessionCookie(next);
  if (isTauri()) {
    try {
      await invoke("save_credential", { secret: next });
    } catch {
      /* in-memory session still works for this run */
    }
  }
}

/** Load the encrypted session from disk into memory. Returns true if present. */
export async function restoreSession(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const stored = await invoke<string | null>("load_credential");
    if (stored) {
      cookie = stored;
      setSessionCookie(stored);
      return true;
    }
  } catch {
    /* treat as logged out */
  }
  return false;
}

export async function clearSession(): Promise<void> {
  cookie = null;
  setSessionCookie(null);
  if (isTauri()) {
    try {
      await invoke("delete_credential");
    } catch {
      /* ignore */
    }
  }
}
