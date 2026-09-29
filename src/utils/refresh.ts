// Refresh interval policy: foreground (window visible) vs tray-background (hidden).
// Intervals in ms; `false` means no polling.

export type RunMode = "foreground" | "tray";

/** 在线人数：前台当前 UP 60s，其他情况不轮询。 */
export function onlineInterval(mode: RunMode, isCurrentUp: boolean): number | false {
  if (mode === "tray") return false;
  return isCurrentUp ? 60_000 : false;
}

/** 视频播放/点赞/投币：前台当前 UP 5min、其他 UP 15min；托盘 30min。 */
export function videoStatsInterval(mode: RunMode, isCurrentUp: boolean): number | false {
  if (mode === "tray") return 30 * 60_000;
  return isCurrentUp ? 5 * 60_000 : 15 * 60_000;
}

/** 用户资料：前台当前 UP 15min、其他 UP 30min；托盘最多 2h。 */
export function profileInterval(mode: RunMode, isCurrentUp: boolean): number | false {
  if (mode === "tray") return 2 * 60 * 60_000;
  return isCurrentUp ? 15 * 60_000 : 30 * 60_000;
}
