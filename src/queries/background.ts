import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import { useSubscriptions } from "./subscriptions";
import { profileKeys } from "./profile";
import { videoKeys } from "./videos";
import { useSettingsStore } from "../store/settingsStore";
import { useUIStore } from "../store/uiStore";
import { useDashboardStore } from "../store/dashboardStore";
import {
  setUserCacheDecoration,
  setUserCacheProfile,
  setUserCacheStats,
} from "../services/database/usersCache";
import { insertStatsSnapshot } from "../services/database/statsSnapshots";
import { saveVideos } from "../services/database/videos";
import { computeStatsGrowth } from "../utils/growth";

/* Startup stage C: once the window is usable and the cached dashboard is on
 * screen, the UP the user is *not* looking at is brought up to date — one at a
 * time, spaced out, and never while the window sits in the tray. */

/** First pass waits this long so startup traffic stays quiet. */
const START_DELAY = 25_000;
/** Coming back from the tray: a shorter pause is enough. */
const RESUME_DELAY = 4_000;
/** Pause between two UPs so Bilibili never sees a burst. */
const GAP = 6_000;
/** At most this many UPs per pass. */
const MAX_PER_PASS = 2;
/** Skip a UP that was refreshed by this pass less than 30 minutes ago. */
const FRESH_MS = 30 * 60 * 1000;

const lastRefreshedAt = new Map<number, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Refresh one UP without React Query's cache in the loop, then seed that cache
 * so switching to the UP afterwards shows the new numbers immediately.
 */
async function refreshUp(mid: number, limit: number, qc: QueryClient): Promise<void> {
  const store = useDashboardStore.getState();

  const profile = await BilibiliAdapter.getUserProfile(mid).catch(() => null);
  if (profile) {
    const old = store.snapshots[mid]?.profile;
    if (!profile.topPhoto && old?.topPhoto) profile.topPhoto = old.topPhoto;
    if (!profile.pendantUrl && old?.pendantUrl) profile.pendantUrl = old.pendantUrl;
    if (!profile.fansMedal && old?.fansMedal) profile.fansMedal = old.fansMedal;
    store.patch(mid, { profile });
    qc.setQueryData(profileKeys.profile(mid), profile);
    void setUserCacheProfile(mid, profile).catch(() => {});
  }

  const stats = await BilibiliAdapter.getUserStats(mid).catch(() => null);
  if (stats) {
    store.patch(mid, { stats });
    qc.setQueryData(profileKeys.stats(mid), stats);
    void setUserCacheStats(mid, stats).catch(() => {});
    void insertStatsSnapshot(mid, stats).catch(() => {});
    void computeStatsGrowth(mid, stats)
      .then((statsGrowth) => useDashboardStore.getState().patch(mid, { statsGrowth }))
      .catch(() => {});
  }

  const list = await BilibiliAdapter.getUserVideos(mid, limit).catch(() => null);
  if (list && list.length > 0) {
    store.setVideoList(mid, list);
    qc.setQueryData(videoKeys.list(mid, limit), list);
    void saveVideos(mid, list).catch(() => {});
  }

  const decoration = await BilibiliAdapter.getDynamicDecoration(mid).catch(() => null);
  if (decoration) {
    store.patch(mid, { decoration });
    void setUserCacheDecoration(mid, decoration).catch(() => {});
  }

  lastRefreshedAt.set(mid, Date.now());
}

export function useBackgroundRefresh() {
  const { data: subs } = useSubscriptions();
  const hydrated = useDashboardStore((s) => s.hydrated);
  const visible = useUIStore((s) => s.isWindowVisible);
  const qc = useQueryClient();
  const ranOnce = useRef(false);

  useEffect(() => {
    if (!hydrated || !visible || !subs || subs.length === 0) return;
    let cancelled = false;

    const pass = async () => {
      const settings = useSettingsStore.getState();
      let done = 0;
      for (const sub of subs) {
        if (cancelled || done >= MAX_PER_PASS) break;
        if (!useUIStore.getState().isWindowVisible) break;
        if (!sub.enabled) continue;
        if (sub.mid === useUIStore.getState().selectedMid) continue;
        const last = lastRefreshedAt.get(sub.mid) ?? 0;
        if (Date.now() - last < FRESH_MS) continue;
        await refreshUp(sub.mid, settings.effectiveVideoLimit(sub.mid), qc);
        done += 1;
        if (done < MAX_PER_PASS) await sleep(GAP);
      }
    };

    const delay = ranOnce.current ? RESUME_DELAY : START_DELAY;
    ranOnce.current = true;
    const timer = window.setTimeout(() => void pass(), delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hydrated, visible, subs, qc]);
}
