import { biliFetch, biliLimiter } from "./client";
import { ENDPOINTS } from "./endpoints";
import {
  normalizeCardProfile,
  normalizeDecoration,
  normalizeMedalWall,
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
  type FansMedal,
  type OnlineStats,
  type UserIdentity,
  type UserProfile,
  type UserStats,
  type VideoDetail,
  type VideoSummary,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The feature set the dynamic feed must be asked for so `module_author` comes
 * back complete — `decorationCard` is what carries the author's 装扮卡片.
 */
const DYNAMIC_FEATURES = [
  "itemOpusStyle",
  "opusBigCover",
  "onlyfansVote",
  "endFooterHidden",
  "decorationCard",
  "onlyfansAssetsV2",
  "ugcDelete",
  "onlyfansQaCard",
  "commentsNewVersion",
].join(",");

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
  // Cookies (device fingerprint + optional login session) are injected by the
  // shared HTTP layer, so every Bilibili call carries them automatically.
  const res = await biliFetch(url, { params });
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

  /**
   * Current login state (nav endpoint). Bilibili answers -101 when logged out
   * but still returns a data object, so we read `data.isLogin` rather than code.
   */
  async getNavInfo(): Promise<{ isLogin: boolean; mid: number; name: string; face: string } | null> {
    try {
      const res = await biliFetch(ENDPOINTS.nav);
      const raw = JSON.parse(res.body);
      const d = raw?.data;
      if (!d) return null;
      const mid = Number(d.mid ?? 0);
      return {
        isLogin: Boolean(d.isLogin) && mid > 0,
        mid,
        name: String(d.uname ?? ""),
        face: String(d.face ?? ""),
      };
    } catch {
      return null;
    }
  },

  /** Minimal existence check for fast "add subscription" (card endpoint only). */
  async getBriefUser(mid: number): Promise<{ mid: number; name: string; face: string }> {
    const raw = await getJson(ENDPOINTS.card, [
      ["mid", String(mid)],
      ["photo", "true"],
    ]);
    if (raw?.code === -404 || !raw?.data?.card) {
      throw new BiliError("not_found", "未找到该 UP 主", raw?.code);
    }
    const c = raw.data.card;
    return { mid: Number(c.mid ?? mid), name: String(c.name ?? ""), face: String(c.face ?? "") };
  },

  async getUserProfile(mid: number): Promise<UserProfile> {
    // 1) card endpoint — data.space.l_img is the custom space banner for users
    //    who set one (verified against 影视飓风 / 罗翔说刑法).
    let cardProfile: Partial<UserProfile> = {};
    let cardImages: BannerCandidates = {};
    try {
      const cardRaw = await getJson(ENDPOINTS.card, [
        ["mid", String(mid)],
        ["photo", "true"],
      ]);
      if (cardRaw?.code === -404 || (!cardRaw?.data?.card && !cardRaw?.data)) {
        throw new BiliError("not_found", "用户不存在", cardRaw?.code);
      }
      cardProfile = normalizeCardProfile(cardRaw, mid);
      const space = cardRaw?.data?.space ?? {};
      cardImages = { lImg: space.l_img, sImg: space.s_img };
    } catch (e) {
      if (e instanceof BiliError && e.type === "not_found") throw e;
    }

    // 2) acc/info — retried (risk-controlled); carries fans_medal + top_photo(_v2).
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const params = await signWbi({ mid, token: "", platform: "web", web_location: "1550101" });
        const raw = await getJson(ENDPOINTS.spaceInfo, params);
        if (raw?.code === -404 || !raw?.data) break;
        const p = normalizeProfile(raw, mid);
        // The card endpoint only ever *fills gaps*: spreading it over the
        // acc/info result would overwrite `topPhoto` with the card's undefined
        // value and silently drop the user's custom banner.
        const merged = mergeProfiles(p, cardProfile);
        merged.topPhoto = pickBanner({
          topPhoto: p.topPhoto,
          // What the space page itself renders; also the smallest variant.
          l200h: raw?.data?.top_photo_v2?.l_200h_img,
          ...cardImages,
        });
        logBanner(mid, merged.topPhoto);
        return merged;
      } catch (e) {
        if (e instanceof BiliError && e.type === "not_found") throw e;
        if (!(e instanceof BiliError && (e.type === "rate_limit" || e.type === "wbi"))) break;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 12_000));
      }
    }

    // 3) card-only fallback (no fans_medal).
    if (Object.keys(cardProfile).length > 0) {
      const banner = pickBanner(cardImages) ?? cardProfile.topPhoto;
      logBanner(mid, banner);
      return { ...(cardProfile as UserProfile), topPhoto: banner };
    }
    throw new BiliError("network", "获取用户资料失败");
  },

  /**
   * 粉丝勋章墙 — supplies the real v2 medal gradient. Requires login; when the
   * wall is unavailable we return null and the profile keeps its own medal.
   */
  async getFansMedal(mid: number): Promise<FansMedal | null> {
    try {
      const raw = await getJson(ENDPOINTS.medalWall, [["target_id", String(mid)]]);
      if (raw?.code !== 0) return null;
      return normalizeMedalWall(raw);
    } catch {
      return null;
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

    // UP 主总播放 / 获赞 — needs a login session and is risk-controlled, so it
    // gets a couple of spaced attempts before degrading to null.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const up = await getJson(ENDPOINTS.upStat, [["mid", String(mid)]]);
        if (up?.code === 0) {
          Object.assign(stats, normalizeUpStat(up, mid));
          break;
        }
      } catch {
        /* retry once, then leave null */
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 4000));
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
    // The dynamic feed endpoint is aggressively risk-controlled: two tries with
    // a pause, then degrade to null (feature hidden). No further fallbacks.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // WBI signing is required: without it the endpoint answers
        // HTTP 200 / code -352 (risk control) and returns zero items.
        const params = await signWbi({
          host_mid: mid,
          timezone_offset: -480,
          web_location: "333.1387",
          // Without `decorationCard` the response omits module_author's card.
          features: DYNAMIC_FEATURES,
        });
        const res = await biliFetch(ENDPOINTS.dynamicSpace, { params });
        const raw = JSON.parse(res.body);
        const items = raw?.data?.items ?? [];
        const decorated = items.filter((it: any) => {
          const a = it?.modules?.module_author;
          return a?.decorate ?? a?.decoration_card;
        }).length;
        const result = normalizeDecoration(raw);
        if (import.meta.env.DEV) {
          console.info(
            `[decoration] mid=${mid} HTTP ${res.status} code ${raw?.code} items=${items.length} withDecorate=${decorated} -> ${result ? "ok" : "null"}`,
          );
        }
        if (result) return result;
        // 200 + no decorate on any of the scanned items: nothing to show.
        if (res.status === 200 && raw?.code === 0) return null;
      } catch {
        /* fall through to retry */
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 10_000));
    }
    return null;
  },
};

/**
 * Merge a secondary profile into the authoritative one.
 *
 * Used to fold the card endpoint into `acc/info`: every key present on the
 * card is copied only when acc/info left that field empty, so a `undefined`
 * on the card can never blank a value acc/info did return (which is exactly
 * how the custom space banner used to disappear).
 */
function mergeProfiles(primary: UserProfile, fallback: Partial<UserProfile>): UserProfile {
  const out: Record<string, unknown> = { ...primary };
  for (const [k, v] of Object.entries(fallback)) {
    const cur = out[k];
    if (v === undefined || v === null) continue;
    if (cur === undefined || cur === null || cur === "") out[k] = v;
  }
  return out as unknown as UserProfile;
}

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
      danmaku: Number(item.stat?.danmaku ?? 0) || null,
      reply: Number(item.stat?.reply ?? 0) || null,
    });
  }
  return out;
}

interface BannerCandidates {
  lImg?: string;
  sImg?: string;
  /** top_photo_v2.l_200h_img — the image the space page itself renders. */
  l200h?: string;
  topPhoto?: string;
}

/** Bilibili's stock space banners, served when a UP has not set a custom one. */
const DEFAULT_BANNERS = [
  "cb1c3ef50e22b6096fde67febe863494caefebad",
  "0977767b2e79d8ad0a36a731068a83d7/1sz3p8w2Sk",
  "LRjqHhi0wL",
];

export function isDefaultBannerUrl(url: string | undefined): boolean {
  return !!url && DEFAULT_BANNERS.some((marker) => url.includes(marker));
}

function isDefaultBanner(url: string): boolean {
  return isDefaultBannerUrl(url);
}

/**
 * Pick the most "real" banner we can get, in the order the space page itself
 * uses: `/x/space/wbi/acc/info → data.top_photo` first, then the `top_photo_v2`
 * preview, and only then the card endpoint's `space.l_img` / `s_img`. Bilibili's
 * stock artwork is skipped whenever a custom candidate exists.
 */
function pickBanner(c: BannerCandidates): string | undefined {
  const list = [c.topPhoto, c.l200h, c.lImg, c.sImg].filter((u): u is string => !!u);
  if (list.length === 0) return undefined;
  return list.find((u) => !isDefaultBanner(u)) ?? list[0];
}

/** Dev-only one-liner so the banner source is verifiable without log spam. */
function logBanner(mid: number, url: string | undefined) {
  if (!import.meta.env.DEV) return;
  console.info(`[banner] mid=${mid} ${url ?? "(none)"}${url && isDefaultBanner(url) ? "  <-- B站默认图" : ""}`);
}

/** Convenience: run a bounded set of tasks through the shared limiter. */
export function limited<T>(fn: () => Promise<T>): Promise<T> {
  return biliLimiter.run(fn);
}

export type { UserIdentity, UserProfile, UserStats, VideoSummary, VideoDetail, OnlineStats, DynamicDecoration };
