import { useQuery } from "@tanstack/react-query";
import type { UserStats } from "../services/bilibili/types";
import { computeStatsGrowth } from "../utils/growth";
import type { StatsField } from "../services/database/statsSnapshots";

export type StatsGrowthMap = Record<StatsField, { day: number | null; week: number | null; month: number | null }>;

const EMPTY: StatsGrowthMap = {
  following: { day: null, week: null, month: null },
  follower: { day: null, week: null, month: null },
  likes: { day: null, week: null, month: null },
  totalViews: { day: null, week: null, month: null },
  videoCount: { day: null, week: null, month: null },
};

/**
 * Day/week/month growth for the profile stats row, derived from the local
 * snapshot history. Recomputes whenever the live counters change.
 */
export function useStatsGrowth(mid: number, stats: UserStats | undefined): StatsGrowthMap {
  const { data } = useQuery({
    queryKey: [
      "statsGrowth",
      mid,
      stats?.following ?? -1,
      stats?.follower ?? -1,
      stats?.likes ?? -1,
      stats?.totalViews ?? -1,
      stats?.videoCount ?? -1,
    ],
    queryFn: () =>
      computeStatsGrowth(mid, {
        following: stats?.following ?? null,
        follower: stats?.follower ?? null,
        likes: stats?.likes ?? null,
        totalViews: stats?.totalViews ?? null,
        videoCount: stats?.videoCount ?? null,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!stats,
  });
  return data ?? EMPTY;
}
