import { EMPTY_GROWTH, type StatsGrowthMap } from "../utils/growth";
import { useSnapshot } from "../store/dashboardStore";
import { useSettingsStore } from "../store/settingsStore";
import { insertStatsSnapshot } from "../services/database/statsSnapshots";
import type { UserStats } from "../services/bilibili/types";

export type { StatsGrowthMap };

/**
 * Record one growth point.
 *
 * This is the single gate every refresh goes through, so 增长数据跟随数据更新 has
 * exactly one meaning: with it on, a refresh adds a point; with it off, growth is
 * computed from the records already stored and nothing new is written.
 */
export function recordStatsSnapshot(mid: number, stats: UserStats): void {
  if (!useSettingsStore.getState().global.growthFollowsRefresh) return;
  void insertStatsSnapshot(mid, stats).catch(() => {});
}

const EMPTY: StatsGrowthMap = {
  following: { ...EMPTY_GROWTH },
  follower: { ...EMPTY_GROWTH },
  likes: { ...EMPTY_GROWTH },
  totalViews: { ...EMPTY_GROWTH },
  videoCount: { ...EMPTY_GROWTH },
};

/**
 * Day/week/month growth for the profile stats row, read from the per-UP
 * snapshot so switching subscriptions never flashes an empty pill row.
 */
export function useStatsGrowth(mid: number): StatsGrowthMap {
  const snapshot = useSnapshot(mid);
  return snapshot?.statsGrowth ?? EMPTY;
}
