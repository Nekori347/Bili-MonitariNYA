import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import type { DynamicDecoration, UserProfile, UserStats } from "../services/bilibili/types";
import {
  getUserCache,
  setUserCacheDecoration,
  setUserCacheProfile,
  setUserCacheStats,
} from "../services/database/usersCache";
import { insertStatsSnapshot } from "../services/database/statsSnapshots";
import { isDefaultBannerUrl } from "../services/bilibili/adapter";
import { profileInterval } from "../utils/refresh";
import { computeStatsGrowth } from "../utils/growth";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { useDashboardStore, useSnapshot } from "../store/dashboardStore";

export const profileKeys = {
  profile: (mid: number) => ["profile", mid] as const,
  stats: (mid: number) => ["stats", mid] as const,
  decoration: (mid: number) => ["decoration", mid] as const,
};

const PROFILE_STALE = 10 * 60 * 1000;
const STATS_STALE = 10 * 60 * 1000;

/** The last successfully fetched profile for one UP (never another mid's). */
function knownProfile(mid: number): UserProfile | undefined {
  return useDashboardStore.getState().snapshots[mid]?.profile;
}

/**
 * The session cookie is restored asynchronously, and `/space/wbi/acc/info`
 * only returns the real custom banner when it is present — without it Bilibili
 * answers with its stock artwork. Waiting for the restore before fetching is
 * what keeps 自定义 Banner correct on the very first load.
 */
function useAuthReady(): boolean {
  return useAuthStore((s) => s.status !== "loading");
}

export function useUserProfile(mid: number, isForeground: boolean) {
  const visible = useUIStore((s) => s.isWindowVisible);
  const authReady = useAuthReady();
  const snapshot = useSnapshot(mid);

  const query = useQuery({
    queryKey: profileKeys.profile(mid),
    queryFn: async () => {
      const fresh = await BilibiliAdapter.getUserProfile(mid);
      const old = knownProfile(mid);

      // The custom banner comes from the risk-controlled `/space/wbi/acc/info`.
      // When that call degrades to the card endpoint only Bilibili's stock
      // artwork is available, so a previously successful custom banner is
      // never replaced by a default one.
      if (old?.topPhoto && (!fresh.topPhoto || isDefaultBannerUrl(fresh.topPhoto))) {
        fresh.topPhoto = old.topPhoto;
      }

      // MedalWall carries the real v2 medal gradient; only overwrite with it.
      const wallMedal = await BilibiliAdapter.getFansMedal(mid).catch(() => null);
      if (wallMedal) fresh.fansMedal = { ...fresh.fansMedal, ...wallMedal };

      // Never overwrite a previously-successful asset with an empty value when
      // the current fetch fell back to the card endpoint.
      if (old) {
        if (!fresh.pendantUrl && old.pendantUrl) fresh.pendantUrl = old.pendantUrl;
        if (!fresh.fansMedal && old.fansMedal) fresh.fansMedal = old.fansMedal;
      }
      void setUserCacheProfile(mid, fresh).catch(() => {});
      return fresh;
    },
    staleTime: PROFILE_STALE,
    refetchInterval: profileInterval(visible ? "foreground" : "tray", isForeground),
    retry: 2,
    enabled: authReady,
  });

  const profile = query.data;
  useEffect(() => {
    if (!profile) return;
    useDashboardStore.getState().patch(mid, { profile });
  }, [mid, profile]);

  return { ...query, data: snapshot?.profile as UserProfile | undefined, isLoading: false };
}

export function useUserStats(mid: number, isForeground: boolean) {
  const visible = useUIStore((s) => s.isWindowVisible);
  const authReady = useAuthReady();
  const snapshot = useSnapshot(mid);

  const query = useQuery({
    queryKey: profileKeys.stats(mid),
    queryFn: async () => {
      const fresh = await BilibiliAdapter.getUserStats(mid);
      void setUserCacheStats(mid, fresh).catch(() => {});
      // Growth history for the stats row (day/week/month).
      void insertStatsSnapshot(mid, fresh).catch(() => {});
      return fresh;
    },
    staleTime: STATS_STALE,
    refetchInterval: profileInterval(visible ? "foreground" : "tray", isForeground),
    retry: 1,
    // 获赞 / 总播放 only come back with a session; fetching as a guest just
    // burns a request and caches a null.
    enabled: authReady,
  });

  const stats = query.data;
  useEffect(() => {
    if (!stats) return;
    const store = useDashboardStore.getState();
    store.patch(mid, { stats });
    // Refresh the day/week/month deltas against the new counters.
    void computeStatsGrowth(mid, stats)
      .then((statsGrowth) => useDashboardStore.getState().patch(mid, { statsGrowth }))
      .catch(() => {});
  }, [mid, stats]);

  return { ...query, data: snapshot?.stats as UserStats | undefined, isLoading: false };
}

export function useDecoration(mid: number) {
  const snapshot = useSnapshot(mid);

  const query = useQuery({
    queryKey: profileKeys.decoration(mid),
    queryFn: async () => {
      const decoration = await BilibiliAdapter.getDynamicDecoration(mid);
      // A null result is a real answer ("this UP wears no decoration"), but it
      // must not wipe artwork we already hold — only the feed can say so.
      if (decoration) void setUserCacheDecoration(mid, decoration).catch(() => {});
      return decoration;
    },
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });

  const decoration = query.data;
  useEffect(() => {
    if (decoration === undefined) return;
    if (decoration == null && useDashboardStore.getState().snapshots[mid]?.decoration) return;
    useDashboardStore.getState().patch(mid, { decoration });
  }, [mid, decoration]);

  return { ...query, data: snapshot?.decoration as DynamicDecoration | null | undefined };
}

export interface ProfileCardData {
  profile: UserProfile | undefined;
  stats: UserStats | undefined;
  decoration: DynamicDecoration | null | undefined;
  loading: boolean;
}

export function useProfileCard(mid: number, isForeground: boolean): ProfileCardData {
  const profile = useUserProfile(mid, isForeground);
  const stats = useUserStats(mid, isForeground);
  const decoration = useDecoration(mid);
  return {
    profile: profile.data,
    stats: stats.data,
    decoration: decoration.data,
    // Only a genuinely unknown UP shows a placeholder; a switch never does.
    loading: !profile.data,
  };
}

/** Read a cached profile once (used where no hook is available). */
export async function peekUserCache(mid: number) {
  return getUserCache(mid);
}
