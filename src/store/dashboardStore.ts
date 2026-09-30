import { create } from "zustand";
import type {
  DynamicDecoration,
  OnlineStats,
  UserProfile,
  UserStats,
  VideoSummary,
} from "../services/bilibili/types";
import { getCaches } from "../services/database/usersCache";
import { getCachedVideos } from "../services/database/videos";
import {
  computeStatsGrowth,
  computeVideoGrowthMap,
  type StatsGrowthMap,
  type VideoGrowthMap,
} from "../utils/growth";

/** One video row exactly as the list renders it. */
export interface SnapshotVideo extends VideoSummary {
  cid: number;
  online: OnlineStats | null;
}

/**
 * Everything the main page needs for one UP. Kept in memory per mid so
 * switching subscriptions is instant — the whole page is painted from the last
 * known snapshot and live data replaces it slice by slice afterwards.
 */
export interface DashboardSnapshot {
  mid: number;
  profile?: UserProfile;
  stats?: UserStats;
  decoration?: DynamicDecoration | null;
  videos?: SnapshotVideo[];
  statsGrowth?: StatsGrowthMap;
  videoGrowth?: VideoGrowthMap;
  updatedAt: number;
}

export interface VideoStatPatch {
  view: number | null;
  like: number | null;
  coin: number | null;
  cid: number;
  online: OnlineStats | null;
}

interface DashboardState {
  /** True once the local (SQLite) pass has run, so a blank page means "new UP". */
  hydrated: boolean;
  snapshots: Record<number, DashboardSnapshot>;
  hydrate: (limits: Record<number, number>) => Promise<void>;
  patch: (mid: number, patch: Partial<DashboardSnapshot>) => void;
  /** Replace the list while keeping the per-video counters already on screen. */
  setVideoList: (mid: number, list: VideoSummary[]) => void;
  /** Merge fresh counters; a no-op when nothing actually changed. */
  mergeVideoStats: (mid: number, rows: Record<string, VideoStatPatch>) => void;
  drop: (mid: number) => void;
}

function emptySnapshot(mid: number): DashboardSnapshot {
  return { mid, updatedAt: Date.now() };
}

const sameVideo = (a: SnapshotVideo, b: SnapshotVideo): boolean =>
  a.view === b.view &&
  a.like === b.like &&
  a.coin === b.coin &&
  a.cid === b.cid &&
  a.online?.displayText === b.online?.displayText &&
  a.online?.exactCount === b.online?.exactCount;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  hydrated: false,
  snapshots: {},

  /**
   * Startup stage B: fill the in-memory snapshots straight from SQLite so the
   * first paint shows the last known dashboard — no network, no empty fields.
   */
  hydrate: async (limits) => {
    const mids = Object.keys(limits).map(Number);
    if (mids.length === 0) {
      set({ hydrated: true });
      return;
    }
    const [caches, ...videoLists] = await Promise.all([
      getCaches(mids),
      ...mids.map((mid) => getCachedVideos(mid, limits[mid]).catch(() => [])),
    ]);
    const cacheByMid = new Map(caches.map((c) => [c.mid, c]));

    const next: Record<number, DashboardSnapshot> = { ...get().snapshots };
    await Promise.all(
      mids.map(async (mid, i) => {
        const cache = cacheByMid.get(mid);
        const list: VideoSummary[] = videoLists[i] ?? [];
        const videos: SnapshotVideo[] = list.map((v) => ({
          ...v,
          cid: 0,
          online: null,
        }));
        const videoGrowth =
          videos.length > 0 ? await computeVideoGrowthMap(mid, videos).catch(() => ({})) : {};
        const statsGrowth = cache?.stats
          ? await computeStatsGrowth(mid, cache.stats).catch(() => undefined)
          : undefined;
        next[mid] = {
          ...(next[mid] ?? emptySnapshot(mid)),
          profile: cache?.profile ?? next[mid]?.profile,
          stats: cache?.stats ?? next[mid]?.stats,
          decoration: cache?.decoration ?? next[mid]?.decoration,
          videos: videos.length > 0 ? videos : next[mid]?.videos,
          videoGrowth: Object.keys(videoGrowth).length > 0 ? videoGrowth : next[mid]?.videoGrowth,
          statsGrowth: statsGrowth ?? next[mid]?.statsGrowth,
          updatedAt: Date.now(),
        };
      }),
    );
    set({ snapshots: next, hydrated: true });
  },

  patch: (mid, patch) => {
    const snapshots = get().snapshots;
    const current = snapshots[mid] ?? emptySnapshot(mid);
    set({
      snapshots: { ...snapshots, [mid]: { ...current, ...patch, updatedAt: Date.now() } },
    });
  },

  setVideoList: (mid, list) => {
    const snapshots = get().snapshots;
    const current = snapshots[mid] ?? emptySnapshot(mid);
    const previous = new Map((current.videos ?? []).map((v) => [v.bvid, v]));
    const videos: SnapshotVideo[] = list.map((v) => {
      const old = previous.get(v.bvid);
      return {
        ...v,
        cid: old?.cid ?? 0,
        online: old?.online ?? null,
        // The list endpoint can omit counters; keep the last known values.
        view: v.view ?? old?.view ?? null,
        like: v.like ?? old?.like ?? null,
        coin: v.coin ?? old?.coin ?? null,
      };
    });
    const unchanged =
      current.videos?.length === videos.length &&
      current.videos.every((v, i) => sameVideo(v, videos[i]));
    if (unchanged) return;
    set({
      snapshots: { ...snapshots, [mid]: { ...current, videos, updatedAt: Date.now() } },
    });
  },

  mergeVideoStats: (mid, rows) => {
    const snapshots = get().snapshots;
    const current = snapshots[mid];
    if (!current?.videos) return;
    let changed = false;
    const videos = current.videos.map((v) => {
      const r = rows[v.bvid];
      if (!r) return v;
      const next: SnapshotVideo = {
        ...v,
        view: r.view ?? v.view,
        like: r.like ?? v.like,
        coin: r.coin ?? v.coin,
        cid: r.cid || v.cid,
        online: r.online === undefined ? v.online : r.online,
      };
      if (!sameVideo(v, next)) changed = true;
      return next;
    });
    if (!changed) return;
    set({
      snapshots: { ...snapshots, [mid]: { ...current, videos, updatedAt: Date.now() } },
    });
  },

  drop: (mid) => {
    const snapshots = { ...get().snapshots };
    delete snapshots[mid];
    set({ snapshots });
  },
}));

/** Selector hook: the last known dashboard for one UP. */
export function useSnapshot(mid: number): DashboardSnapshot | undefined {
  return useDashboardStore((s) => s.snapshots[mid]);
}
