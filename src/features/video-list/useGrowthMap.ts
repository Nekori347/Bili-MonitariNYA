import { useEffect, useMemo } from "react";
import { computeVideoGrowthMap, EMPTY_VIDEO_GROWTH, type VideoGrowth, type VideoGrowthMap } from "../../utils/growth";
import { useDashboardStore, useSnapshot } from "../../store/dashboardStore";

export type { VideoGrowth };

/**
 * Day/week/month growth for view / like / coin on every row. One SQLite query
 * covers the whole list, and the result is kept in the per-UP snapshot so a
 * subscription switch re-uses it instead of recomputing from scratch.
 */
export function useGrowthMap(
  mid: number,
  items: { bvid: string; view: number | null; like: number | null; coin: number | null }[],
): VideoGrowthMap {
  const snapshot = useSnapshot(mid);

  // Recompute only when the counters themselves change, not on every render.
  const signature = useMemo(
    () => items.map((v) => `${v.bvid}:${v.view ?? -1}:${v.like ?? -1}:${v.coin ?? -1}`).join(","),
    [items],
  );

  useEffect(() => {
    if (items.length === 0) return;
    let on = true;
    void computeVideoGrowthMap(mid, items)
      .then((map) => {
        if (on) useDashboardStore.getState().patch(mid, { videoGrowth: map });
      })
      .catch(() => {});
    return () => {
      on = false;
    };
    // `items` is fully described by `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid, signature]);

  return snapshot?.videoGrowth ?? EMPTY_MAP;
}

const EMPTY_MAP: VideoGrowthMap = {};

export function growthFor(map: VideoGrowthMap, bvid: string): VideoGrowth {
  return map[bvid] ?? EMPTY_VIDEO_GROWTH;
}
