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
