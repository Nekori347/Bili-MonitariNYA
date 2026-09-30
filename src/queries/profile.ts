import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import type { DynamicDecoration, UserProfile, UserStats } from "../services/bilibili/types";
import { getUserCache, setUserCacheProfile, setUserCacheStats } from "../services/database/usersCache";
import { insertStatsSnapshot } from "../services/database/statsSnapshots";
import { isDefaultBannerUrl } from "../services/bilibili/adapter";
import { useDelayedReady } from "../utils/useDelayedReady";
import { profileInterval } from "../utils/refresh";
import { useUIStore } from "../store/uiStore";

export const profileKeys = {
  profile: (mid: number) => ["profile", mid] as const,
  stats: (mid: number) => ["stats", mid] as const,
  decoration: (mid: number) => ["decoration", mid] as const,
};

const PROFILE_STALE = 10 * 60 * 1000;
const STATS_STALE = 10 * 60 * 1000;

/** Load cached profile for instant display (stale-while-revalidate). */
function useCachedProfile(mid: number): UserProfile | null {
  const [entry, setEntry] = useState<{ mid: number; profile: UserProfile | null } | null>(null);
  useEffect(() => {
    let on = true;
    void getUserCache(mid).then((c) => {
      if (on) setEntry({ mid, profile: c?.profile ?? null });
    });
    return () => {
      on = false;
    };
  }, [mid]);
  // Never return another mid's cached profile (prevents showing the previous user).
  return entry && entry.mid === mid ? entry.profile : null;
}

function useCachedStats(mid: number): UserStats | null {
  const [entry, setEntry] = useState<{ mid: number; stats: UserStats | null } | null>(null);
  useEffect(() => {
    let on = true;
    void getUserCache(mid).then((c) => {
      if (on) setEntry({ mid, stats: c?.stats ?? null });
    });
    return () => {
      on = false;
    };
  }, [mid]);
  return entry && entry.mid === mid ? entry.stats : null;
}

export function useUserProfile(mid: number, isForeground: boolean) {
  const cached = useCachedProfile(mid);
  const ready = useDelayedReady(3000);
  const visible = useUIStore((s) => s.isWindowVisible);
  const query = useQuery({
    queryKey: profileKeys.profile(mid),
    queryFn: async () => {
      const fresh = await BilibiliAdapter.getUserProfile(mid);
      const old = await getUserCache(mid).catch(() => null);

      // The real custom space banner is only readable by its owner, so for the
      // signed-in account try that first; otherwise keep whatever public banner
      // we already had cached rather than dropping back to Bilibili's stock art.
      const selfBanner = await BilibiliAdapter.getSelfBanner(mid).catch(() => undefined);
      if (selfBanner) fresh.topPhoto = selfBanner;
      else if (old?.profile?.topPhoto && isDefaultBannerUrl(fresh.topPhoto)) {
        fresh.topPhoto = old.profile.topPhoto;
      }

      // MedalWall carries the real v2 medal gradient; only overwrite with it.
      const wallMedal = await BilibiliAdapter.getFansMedal(mid).catch(() => null);
      if (wallMedal) fresh.fansMedal = { ...fresh.fansMedal, ...wallMedal };

      // Never overwrite a previously-successful asset with an empty value when
      // the current fetch fell back to the card endpoint.
      if (old?.profile) {
        if (!fresh.topPhoto && old.profile.topPhoto) fresh.topPhoto = old.profile.topPhoto;
        if (!fresh.pendantUrl && old.profile.pendantUrl) fresh.pendantUrl = old.profile.pendantUrl;
        if (!fresh.fansMedal && old.profile.fansMedal) fresh.fansMedal = old.profile.fansMedal;
      }
      void setUserCacheProfile(mid, fresh).catch(() => {});
      return fresh;
    },
    staleTime: PROFILE_STALE,
    refetchInterval: profileInterval(visible ? "foreground" : "tray", isForeground),
    retry: 2,
    enabled: ready,
  });
  return { ...query, data: (query.data ?? cached) as UserProfile | undefined, isLoading: query.isLoading && cached == null };
}

export function useUserStats(mid: number, isForeground: boolean) {
  const cached = useCachedStats(mid);
  const ready = useDelayedReady(3000);
  const visible = useUIStore((s) => s.isWindowVisible);
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
    enabled: ready,
  });
  return { ...query, data: (query.data ?? cached) as UserStats | undefined, isLoading: query.isLoading && cached == null };
}

export function useDecoration(mid: number) {
  const ready = useDelayedReady(6000);
  return useQuery({
    queryKey: profileKeys.decoration(mid),
    queryFn: () => BilibiliAdapter.getDynamicDecoration(mid),
    staleTime: 60 * 60 * 1000,
    retry: 0,
    enabled: ready,
  });
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
    loading: profile.isLoading,
  };
}
