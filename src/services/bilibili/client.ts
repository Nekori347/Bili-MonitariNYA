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
  opts: { params?: [string, string][]; cookie?: string | null; wantCookies?: boolean } = {},
): Promise<FetchResult> {
  const { params = [], cookie = null, wantCookies = false } = opts;

  await pace();

  if (isTauri()) {
    const req: FetchRequest = { url, method: "get", params, cookie, wantCookies };
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
