import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BilibiliAdapter, limited } from "../services/bilibili/adapter";
import { insertSnapshot } from "../services/database/snapshots";
import { saveVideos, saveVideoDetail } from "../services/database/videos";
import { onlineInterval, videoStatsInterval } from "../utils/refresh";
import { useUIStore } from "../store/uiStore";
import {
  useDashboardStore,
  useSnapshot,
  type SnapshotVideo,
  type VideoStatPatch,
} from "../store/dashboardStore";

export type VideoItem = SnapshotVideo;

export const videoKeys = {
  list: (mid: number, limit: number) => ["videos", mid, limit] as const,
};

const LIST_STALE = 5 * 60 * 1000;
const ONLINE_STALE = 30 * 1000;

/** Details fetched immediately; the rest trickle in so startup stays responsive. */
const START_BURST = 10;
const BURST_STEP = 5;
const BURST_EVERY = 2500;

interface DetailResult {
  view: number;
  like: number;
  coin: number;
  danmaku: number;
  reply: number;
  cid: number;
}

/**
 * Release the per-video detail fetches in growing batches. Bilibili rate-limits
 * bursts, and one request per row up front is what made the first paint slow.
 */
function useDetailBudget(count: number): number {
  const [budget, setBudget] = useState(START_BURST);
  useEffect(() => {
    if (budget >= count) return;
    const t = window.setTimeout(() => setBudget((b) => b + BURST_STEP), BURST_EVERY);
    return () => window.clearTimeout(t);
  }, [budget, count]);
  return budget;
}

/**
 * The video list for one UP, always read from the in-memory snapshot so a
 * subscription switch paints the whole page in one frame. Live data lands in
 * the snapshot as it arrives and re-renders locally.
 */
export function useVideos(mid: number, limit: number, isForeground: boolean): VideoItem[] | undefined {
  const visible = useUIStore((s) => s.isWindowVisible);
  const mode = visible ? "foreground" : "tray";
  const snapshot = useSnapshot(mid);
  const items = useMemo(() => snapshot?.videos ?? [], [snapshot?.videos]);

  const listQuery = useQuery({
    queryKey: videoKeys.list(mid, limit),
    queryFn: async () => {
      const list = await BilibiliAdapter.getUserVideos(mid, limit);
      void saveVideos(mid, list).catch(() => {});
      return list;
    },
    staleTime: LIST_STALE,
    refetchInterval: videoStatsInterval(mode, isForeground),
    retry: 2,
  });

  const remoteList = listQuery.data;
  useEffect(() => {
    if (!remoteList) return;
    useDashboardStore.getState().setVideoList(mid, remoteList);
  }, [mid, remoteList]);

  const budget = useDetailBudget(items.length);

  const detailQueries = useQueries({
    queries: items.map((s: SnapshotVideo, i: number) => ({
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
          danmakuCount: detail.danmaku,
          replyCount: detail.reply,
        }).catch(() => {});
        void saveVideoDetail(s.bvid, {
          view: detail.view,
          like: detail.like,
          coin: detail.coin,
          danmaku: detail.danmaku,
          reply: detail.reply,
          cid: detail.cid,
          aid: detail.aid,
        }).catch(() => {});
        return {
          view: detail.view,
          like: detail.like,
          coin: detail.coin,
          danmaku: detail.danmaku,
          reply: detail.reply,
          cid: detail.cid,
        };
      },
      staleTime: LIST_STALE,
      refetchInterval: videoStatsInterval(mode, isForeground),
      retry: 1,
      enabled: i < budget,
    })),
  });

  // Online viewers: only for the foreground UP, and only once the cid is known.
  const onlineQueries = useQueries({
    queries: items.map((s: SnapshotVideo, i: number) => {
      const cid = detailQueries[i]?.data?.cid ?? s.cid;
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

  const detailSig = detailQueries
    .map((q) => q.data)
    .map((d) => (d ? `${d.view}:${d.like}:${d.coin}:${d.danmaku}:${d.reply}:${d.cid}` : ""))
    .join("|");
  const onlineSig = onlineQueries.map((q) => q.data).map((o) => o?.displayText ?? "").join("|");

  useEffect(() => {
    if (items.length === 0) return;
    const rows: Record<string, VideoStatPatch> = {};
    items.forEach((s, i) => {
      const d = detailQueries[i]?.data;
      const knownOnline = onlineQueries[i]?.data;
      if (!d && knownOnline === undefined) return;
      rows[s.bvid] = {
        view: d?.view ?? null,
        like: d?.like ?? null,
        coin: d?.coin ?? null,
        danmaku: d?.danmaku ?? null,
        reply: d?.reply ?? null,
        cid: d?.cid ?? s.cid,
        online: onlineQueries[i]?.data ?? null,
      };
    });
    if (Object.keys(rows).length > 0) {
      useDashboardStore.getState().mergeVideoStats(mid, rows);
    }
    // The signatures are the actual payloads; the arrays are rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid, detailSig, onlineSig, items.length]);

  return snapshot?.videos;
}

/** Invalidate everything the video list reads for one UP. */
export function invalidateVideoData(qc: { invalidateQueries: (o: { queryKey: unknown[] }) => Promise<void> }, mid: number) {
  void qc.invalidateQueries({ queryKey: ["videos", mid] });
  void qc.invalidateQueries({ queryKey: ["videoDetail"] });
  void qc.invalidateQueries({ queryKey: ["online"] });
}
