import { useQueries } from "@tanstack/react-query";
import { computeGrowth, type Growth } from "../../utils/growth";

export interface VideoGrowth {
  view: Growth;
  like: Growth;
  coin: Growth;
}

const EMPTY: Growth = { day: null, week: null, month: null };

/**
 * Computes day/week/month growth for view / like / coin per video.
 * Keyed on bvid + current values so it recomputes when fresh detail data lands.
 */
export function useGrowthMap(
  items: { bvid: string; view: number | null; like: number | null; coin: number | null }[],
): Record<string, VideoGrowth> {
  const queries = useQueries({
    queries: items.map((v) => ({
      queryKey: ["growth", v.bvid, v.view ?? -1, v.like ?? -1, v.coin ?? -1] as const,
      queryFn: async (): Promise<VideoGrowth> => {
        const [view, like, coin] = await Promise.all([
          computeGrowth(v.bvid, v.view, "viewCount"),
          computeGrowth(v.bvid, v.like, "likeCount"),
          computeGrowth(v.bvid, v.coin, "coinCount"),
        ]);
        return { view, like, coin };
      },
      staleTime: 5 * 60 * 1000,
      enabled: v.view != null,
    })),
  });

  const map: Record<string, VideoGrowth> = {};
  items.forEach((v, i) => {
    map[v.bvid] = queries[i]?.data ?? { view: EMPTY, like: EMPTY, coin: EMPTY };
  });
  return map;
}
