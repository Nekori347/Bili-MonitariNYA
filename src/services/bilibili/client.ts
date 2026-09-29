import { invoke } from "@tauri-apps/api/core";

export interface FetchResult {
  status: number;
  body: string;
  /** Raw Set-Cookie headers (only populated when `wantCookies` is set). */
  cookies?: string[];
}

interface FetchRequest {
  url: string;
  method?: string;
  params?: [string, string][];
  cookie?: string | null;
  wantCookies?: boolean;
}

/* ------------------------------------------------------------------ *
 * Cookie jar: device fingerprint + optional login session.
 * Bilibili risk control rejects `space/wbi/acc/info` with -352 unless a
 * buvid3/buvid4 device cookie is present, so we obtain one once and keep it.
 * ------------------------------------------------------------------ */

const DEVICE_KEY = "bili_device_cookie";

let sessionCookie: string | null = null;
let deviceCookie: string | null = readDeviceCookie();
let devicePending: Promise<void> | null = null;

function readDeviceCookie(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function writeDeviceCookie(value: string) {
  try {
    window.localStorage.setItem(DEVICE_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Set (or clear) the login session cookie. Never logged. */
export function setSessionCookie(cookie: string | null) {
  sessionCookie = cookie;
}

export function getRequestCookie(): string | null {
  const parts = [deviceCookie, sessionCookie].filter((v): v is string => !!v && v.length > 0);
  return parts.length > 0 ? parts.join("; ") : null;
}

/** Fetch and cache the device fingerprint (buvid3/buvid4) once per install. */
export async function ensureDeviceCookie(): Promise<void> {
  if (deviceCookie) return;
  if (devicePending) return devicePending;
  devicePending = (async () => {
    try {
      const res = await biliFetch("https://api.bilibili.com/x/frontend/finger/spi", { noDevice: true });
      const data = JSON.parse(res.body)?.data;
      if (data?.b_3) {
        deviceCookie = `buvid3=${data.b_3}${data.b_4 ? `; buvid4=${data.b_4}` : ""}; b_nut=${Math.floor(Date.now() / 1000)}`;
        writeDeviceCookie(deviceCookie);
      }
    } catch {
      /* transient: retried on the next call */
    } finally {
      devicePending = null;
    }
  })();
  return devicePending;
}

// Detect if we are running inside Tauri (as opposed to plain `vite dev` in a browser).
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Global request pacing: Bilibili anti-bot blocks bursts of anonymous requests,
// so we space every request start by at least this many ms.
const MIN_GAP_MS = 900;
let lastRequestAt = 0;
let pacingChain: Promise<void> = Promise.resolve();

function pace(): Promise<void> {
  pacingChain = pacingChain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  return pacingChain;
}

/**
 * Central HTTP layer for Bilibili requests.
 * Inside Tauri it proxies through the Rust `fetch_bili` command so we can set
 * Referer/Origin/User-Agent/Cookie headers (WebView forbids these from JS).
 * In plain browser dev it falls back to fetch for quick testing.
 */
export async function biliFetch(
  url: string,
  opts: {
    params?: [string, string][];
    cookie?: string | null;
    wantCookies?: boolean;
    /** Internal: skip the device-cookie bootstrap (used by the bootstrap itself). */
    noDevice?: boolean;
    /** Internal: send no cookie at all. */
    noCookie?: boolean;
  } = {},
): Promise<FetchResult> {
  const { params = [], cookie, wantCookies = false, noDevice = false, noCookie = false } = opts;

  if (!noDevice) await ensureDeviceCookie();
  await pace();

  const effectiveCookie = noCookie ? null : (cookie ?? getRequestCookie());

  if (isTauri()) {
    const req: FetchRequest = { url, method: "get", params, cookie: effectiveCookie, wantCookies };
    return invoke<FetchResult>("fetch_bili", { req });
  }

  const u = new URL(url);
  for (const [k, v] of params) u.searchParams.set(k, v);
  const resp = await fetch(u.toString(), { credentials: "omit" });
  const body = await resp.text();
  return { status: resp.status, body };
}

/** Minimal concurrency limiter (Bilibili max concurrent ≈ 3–5). */
export class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private limit = 3) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          this.active--;
          this.next();
        }
      };
      this.queue.push(task);
      this.next();
    });
  }

  private next() {
    while (this.active < this.limit && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.active++;
      task();
    }
  }
}

export const biliLimiter = new ConcurrencyLimiter(3);
