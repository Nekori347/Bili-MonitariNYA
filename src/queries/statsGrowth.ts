import { EMPTY_GROWTH, type StatsGrowthMap } from "../utils/growth";
import { useSnapshot } from "../store/dashboardStore";

export type { StatsGrowthMap };

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
