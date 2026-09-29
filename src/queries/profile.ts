import { useQuery } from "@tanstack/react-query";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import type { DynamicDecoration, UserProfile, UserStats } from "../services/bilibili/types";
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

export function useUserProfile(mid: number, isForeground: boolean) {
  // Defer so the video-list request goes out first (avoids anti-bot burst).
  const ready = useDelayedReady(3000);
  const visible = useUIStore((s) => s.isWindowVisible);
  return useQuery({
    queryKey: profileKeys.profile(mid),
    queryFn: () => BilibiliAdapter.getUserProfile(mid),
    staleTime: PROFILE_STALE,
    refetchInterval: profileInterval(visible ? "foreground" : "tray", isForeground),
    retry: 2,
    enabled: ready,
  });
}

export function useUserStats(mid: number, isForeground: boolean) {
  const ready = useDelayedReady(3000);
  const visible = useUIStore((s) => s.isWindowVisible);
  return useQuery({
    queryKey: profileKeys.stats(mid),
    queryFn: () => BilibiliAdapter.getUserStats(mid),
    staleTime: STATS_STALE,
    refetchInterval: profileInterval(visible ? "foreground" : "tray", isForeground),
    retry: 1,
    enabled: ready,
  });
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
