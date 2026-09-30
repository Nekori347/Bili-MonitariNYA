// Bilibili API endpoints, centralized. UI must never hardcode these.

export const ENDPOINTS = {
  nav: "https://api.bilibili.com/x/web-interface/nav",
  /** 用户空间资料 (WBI) */
  spaceInfo: "https://api.bilibili.com/x/space/wbi/acc/info",
  /** 备用用户卡片 */
  card: "https://api.bilibili.com/x/web-interface/card",
  /** 关注 / 粉丝 */
  relationStat: "https://api.bilibili.com/x/relation/stat",
  /** UP 主总播放 / 获赞 */
  upStat: "https://api.bilibili.com/x/space/upstat",
  /** 最近投稿列表 (WBI) */
  spaceSearch: "https://api.bilibili.com/x/space/wbi/arc/search",
  /** 投稿列表 fallback (风控备用) */
  seriesRec: "https://api.bilibili.com/x/series/recArchivesByKeywords",
  /** 视频详情 */
  view: "https://api.bilibili.com/x/web-interface/view",
  /** 当前在线观看人数 */
  onlineTotal: "https://api.bilibili.com/x/player/online/total",
  /** 用户空间动态 (取装扮卡片) */
  dynamicSpace: "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space",
  /** 当前登录账号自己的空间信息（含自定义头图 toutu / theme） */
  myInfo: "https://api.bilibili.com/x/space/v2/myinfo",
  /** 粉丝勋章墙（v2 颜色，需要登录） */
  medalWall: "https://api.live.bilibili.com/xlive/web-ucenter/user/MedalWall",
} as const;

export const WEB_BASE = "https://www.bilibili.com";
export const SPACE_BASE = "https://space.bilibili.com";

export function spaceUrl(mid: number): string {
  return `${SPACE_BASE}/${mid}`;
}

export function videoSpaceUrl(mid: number): string {
  return `${SPACE_BASE}/${mid}/video`;
}

export function videoUrl(bvid: string): string {
  return `${WEB_BASE}/video/${bvid}`;
}

/**
 * Bilibili serves pre-cropped cover variants via an `@<w>w_<h>h_1c.<fmt>`
 * suffix. Wide rows want 16:9, the narrow breakpoint wants the 4:3 preview.
 */
export function coverUrl(raw: string, ratio: "16:9" | "4:3"): string {
  if (!raw) return raw;
  const base = raw.split("@")[0];
  const crop = ratio === "4:3" ? "@480w_360h_1c.webp" : "@672w_378h_1c.webp";
  return base + crop;
}
