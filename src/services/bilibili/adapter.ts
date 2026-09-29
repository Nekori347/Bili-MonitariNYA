import { biliFetch, biliLimiter } from "./client";
import { ENDPOINTS } from "./endpoints";
import {
  normalizeCardProfile,
  normalizeDecoration,
  normalizeOnline,
  normalizeProfile,
  normalizeRelationStat,
  normalizeUpStat,
  normalizeVideoDetail,
  normalizeVideoSummary,
} from "./normalize";
import { signWbi } from "./wbi";
import {
  BiliError,
  type DynamicDecoration,
  type OnlineStats,
  type UserIdentity,
  type UserProfile,
  type UserStats,
  type VideoDetail,
  type VideoSummary,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Optional Bilibili cookie, injected by the app once settings load.
let cookieProvider: (() => string | null) = () => null;
export function setCookieProvider(fn: () => string | null) {
  cookieProvider = fn;
}

/** Map raw Bilibili API codes to our error taxonomy. */
function toBiliError(status: number, body: string): BiliError | null {
  if (status === 403 || status === 412 || status === 429) {
    // Bilibili anti-bot returns an HTML page with these statuses.
    return new BiliError("rate_limit", `风控拦截 (HTTP ${status})`, status);
  }
  if (status !== 200) {
    return new BiliError("network", `HTTP ${status}`, status);
  }
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    return new BiliError("api_changed", "响应解析失败");
  }
  const code = Number(data?.code ?? 0);
  if (code === 0) return null;
  const msg = String(data?.message ?? "请求失败");
  if (code === -352 || code === -412) return new BiliError("rate_limit", msg, code);
  if (code === -403) return new BiliError("auth", msg, code);
  if (code === -404) return new BiliError("not_found", msg, code);
  if (code === -799 || code === -101) return new BiliError("wbi", msg, code);
  return new BiliError("unknown", msg, code);
}

async function getJson(url: string, params?: [string, string][]): Promise<any> {
  const res = await biliFetch(url, { params, cookie: cookieProvider() });
  const err = toBiliError(res.status, res.body);
  if (err) throw err;
  return JSON.parse(res.body);
}

/**
 * BilibiliAdapter — the single entry point for all Bilibili data.
 * UI / TanStack Query never call endpoints directly.
 */
export const BilibiliAdapter = {
  /** Parse a UID number or a space.bilibili.com URL into a mid. */
  resolveUser(input: string): UserIdentity {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/space\.bilibili\.com\/(\d+)/);
    if (urlMatch) return { mid: Number(urlMatch[1]) };
    const numMatch = trimmed.match(/(\d+)/);
    if (!numMatch) throw new BiliError("unknown", "无法识别该 UID 或主页链接");
    return { mid: Number(numMatch[1]) };
  },

  async getUserProfile(mid: number): Promise<UserProfile> {
    try {
      const params = await signWbi({ mid, token: "", platform: "web", web_location: "1550101" });
      const raw = await getJson(ENDPOINTS.spaceInfo, params);
      if (raw?.code === -404 || !raw?.data) throw new BiliError("not_found", "用户不存在", raw?.code);
      return normalizeProfile(raw, mid);
    } catch (e) {
      if (e instanceof BiliError && e.type === "not_found") throw e;
      // Fallback to the public card endpoint (may lack WBI-only fields).
      try {
        const raw = await getJson(ENDPOINTS.card, [
          ["mid", String(mid)],
          ["photo", "true"],
        ]);
        return { ...normalizeProfile(raw, mid), ...normalizeCardProfile(raw, mid) } as UserProfile;
      } catch {
        throw e;
      }
    }
  },

  async getUserStats(mid: number): Promise<UserStats> {
    const stats: UserStats = {
      mid,
      following: 0,
      follower: 0,
      likes: null,
      totalViews: null,
      videoCount: null,
    };

    // Relation stat (following / follower) — rarely blocked.
    try {
      const rel = await getJson(ENDPOINTS.relationStat, [["vmid", String(mid)]]);
      Object.assign(stats, normalizeRelationStat(rel, mid));
    } catch {
      /* leave zeros */
    }

    // UP 主总播放 / 获赞 — may require login; degrade gracefully.
    try {
      const up = await getJson(ENDPOINTS.upStat, [["mid", String(mid)]]);
      if (up?.code === 0) Object.assign(stats, normalizeUpStat(up, mid));
    } catch {
      /* leave null -> UI shows 暂不可用 */
    }

    // 投稿数 via card endpoint.
    try {
      const card = await getJson(ENDPOINTS.card, [["mid", String(mid)]]);
      const videoCount = card?.data?.archive_count ?? card?.data?.card?.archive_count;
      if (typeof videoCount === "number") stats.videoCount = videoCount;
    } catch {
      /* leave null */
    }

    return stats;
  },

  async getUserVideos(mid: number, limit: number): Promise<VideoSummary[]> {
    const pages = Math.max(1, Math.ceil(limit / 50));
    const summaries: VideoSummary[] = [];
    for (let pn = 1; pn <= pages; pn++) {
      const page = await this.fetchVideoPage(mid, pn, 50);
      summaries.push(...page);
      if (summaries.length >= limit) break;
    }
    return summaries.slice(0, limit);
  },

  async fetchVideoPage(mid: number, pn: number, ps: number): Promise<VideoSummary[]> {
    // Primary: series recommendation path (no WBI, more tolerant of anonymous
    // access). Bilibili's anti-bot blocks bursts and recovers after ~10s, so
    // we retry a few times with a long pause on rate-limit.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const raw = await getJson(ENDPOINTS.seriesRec, [
          ["mid", String(mid)],
          ["keywords", ""],
          ["ps", String(ps)],
          ["pn", String(pn)],
        ]);
        const list = normalizeSeriesList(raw);
        if (list.length > 0) return list;
      } catch (e) {
        if (!(e instanceof BiliError && e.type === "rate_limit")) throw e;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 15_000));
    }

    // Backup: WBI-signed space archive search.
    const params = await signWbi({
      mid,
      pn,
      ps,
      tid: 0,
      keyword: "",
      order: "pubdate",
      platform: "web",
      web_location: "1550101",
    });
    const raw = await getJson(ENDPOINTS.spaceSearch, params);
    return normalizeVideoSummary(raw);
  },

  async getVideoDetail(bvid: string): Promise<VideoDetail> {
    const raw = await getJson(ENDPOINTS.view, [["bvid", bvid]]);
    return normalizeVideoDetail(raw);
  },

  async getVideoOnline(bvid: string, cid: number): Promise<OnlineStats> {
    const raw = await getJson(ENDPOINTS.onlineTotal, [
      ["bvid", bvid],
      ["cid", String(cid)],
    ]);
    return normalizeOnline(raw);
  },

  async getDynamicDecoration(mid: number): Promise<DynamicDecoration | null> {
    try {
      const raw = await getJson(ENDPOINTS.dynamicSpace, [
        ["host_mid", String(mid)],
        ["offset", ""],
        ["timezone_offset", "-480"],
      ]);
      return normalizeDecoration(raw);
    } catch {
      return null;
    }
  },
};

function normalizeSeriesList(raw: any): VideoSummary[] {
  const list = raw?.data?.archives ?? raw?.data?.list ?? [];
  const out: VideoSummary[] = [];
  for (const item of list) {
    out.push({
      bvid: String(item.bvid ?? ""),
      aid: Number(item.aid ?? 0),
      title: String(item.title ?? ""),
      cover: String(item.pic ?? "").replace(/^http:\/\//, "https://"),
      pubdate: Number(item.pubdate ?? 0),
      duration: Number(item.duration ?? 0),
      view: Number(item.stat?.view ?? item.play ?? 0) || null,
      like: Number(item.stat?.like ?? 0) || null,
      coin: Number(item.stat?.coin ?? 0) || null,
    });
  }
  return out;
}

/** Convenience: run a bounded set of tasks through the shared limiter. */
export function limited<T>(fn: () => Promise<T>): Promise<T> {
  return biliLimiter.run(fn);
}

export type { UserIdentity, UserProfile, UserStats, VideoSummary, VideoDetail, OnlineStats, DynamicDecoration };
