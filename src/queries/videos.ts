import { useQuery, useQueries } from "@tanstack/react-query";
import { BilibiliAdapter, limited } from "../services/bilibili/adapter";
import type { OnlineStats, VideoSummary } from "../services/bilibili/types";
import { insertSnapshot } from "../services/database/snapshots";
import { onlineInterval, videoStatsInterval } from "../utils/refresh";
import { useUIStore } from "../store/uiStore";

export interface VideoItem extends VideoSummary {
  view: number | null;
  like: number | null;
  coin: number | null;
  cid: number;
  online: OnlineStats | null;
  onlineError: boolean;
}

export const videoKeys = {
  list: (mid: number, limit: number) => ["videos", mid, limit] as const,
};

const LIST_STALE = 5 * 60 * 1000;
const ONLINE_STALE = 30 * 1000;

interface DetailResult {
  view: number;
  like: number;
  coin: number;
  cid: number;
}

/** Fetch the recent X videos for a UP and enrich each with its detail stats. */
export function useVideos(mid: number, limit: number, isForeground: boolean): VideoItem[] | undefined {
  const visible = useUIStore((s) => s.isWindowVisible);
  const mode = visible ? "foreground" : "tray";

  const listQuery = useQuery({
    queryKey: videoKeys.list(mid, limit),
    queryFn: () => BilibiliAdapter.getUserVideos(mid, limit),
    staleTime: LIST_STALE,
    refetchInterval: videoStatsInterval(mode, isForeground),
    retry: 2,
  });

  const summaries = listQuery.data ?? [];

  const detailQueries = useQueries({
    queries: summaries.map((s: VideoSummary) => ({
      queryKey: ["videoDetail", s.bvid] as const,
      queryFn: async (): Promise<DetailResult> => {
        const detail = await limited(() => BilibiliAdapter.getVideoDetail(s.bvid));
        void insertSnapshot({
          mid,
          bvid: s.bvid,
          capturedAt: Date.now(),
          viewCount: detail.view,
          likeCount: detail.like,
          coinCount: detail.coin,
          onlineCount: null,
        }).catch(() => {});
        return { view: detail.view, like: detail.like, coin: detail.coin, cid: detail.cid };
      },
      staleTime: LIST_STALE,
      refetchInterval: videoStatsInterval(mode, isForeground),
      retry: 1,
    })),
  });

  // Online viewers: only poll for the foreground UP, and only when cid is known.
  const onlineQueries = useQueries({
    queries: summaries.map((s: VideoSummary, i: number) => {
      const cid = detailQueries[i]?.data?.cid ?? 0;
      const interval = onlineInterval(mode, isForeground);
      return {
        queryKey: ["online", s.bvid, cid] as const,
        queryFn: () => BilibiliAdapter.getVideoOnline(s.bvid, cid).catch(() => null),
        staleTime: ONLINE_STALE,
        refetchInterval: interval && cid > 0 ? interval : false,
        retry: 0,
        enabled: isForeground && cid > 0 && mode === "foreground",
      };
    }),
  });

  return summaries.map((s: VideoSummary, i: number) => {
    const d = detailQueries[i]?.data;
    const online = onlineQueries[i]?.data ?? null;
    return {
      ...s,
      view: d?.view ?? null,
      like: d?.like ?? null,
      coin: d?.coin ?? null,
      cid: d?.cid ?? 0,
      online,
      onlineError: onlineQueries[i]?.isError ?? false,
    };
  });
}
