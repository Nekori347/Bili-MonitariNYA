import { useQueries } from "@tanstack/react-query";
import { computeGrowth, type Growth } from "../../utils/growth";

/**
 * Computes day/week/month view growth for each video.
 * Keyed on bvid + current view so it recomputes when fresh detail data lands.
 */
export function useGrowthMap(items: { bvid: string; view: number | null }[]): Record<string, Growth> {
  const queries = useQueries({
    queries: items.map((v) => ({
      queryKey: ["growth", v.bvid, v.view ?? -1] as const,
      queryFn: () => computeGrowth(v.bvid, v.view, "viewCount"),
      staleTime: 5 * 60 * 1000,
      enabled: v.view != null,
    })),
  });

  const map: Record<string, Growth> = {};
  items.forEach((v, i) => {
    map[v.bvid] = queries[i]?.data ?? { day: null, week: null, month: null };
  });
  return map;
}
