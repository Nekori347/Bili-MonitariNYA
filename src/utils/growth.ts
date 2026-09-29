import { getSnapshotNear, type Snapshot } from "../services/database/snapshots";

export interface Growth {
  day: number | null;
  week: number | null;
  month: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Compute day/week/month growth for a metric by comparing its current value
 * against the snapshot closest to now-1d / now-7d / now-30d.
 * Returns null when there is not enough history ("统计中").
 */
export async function computeGrowth(
  bvid: string,
  current: number | null | undefined,
  metric: keyof Pick<Snapshot, "viewCount" | "likeCount" | "coinCount">,
): Promise<Growth> {
  const now = Date.now();
  if (current == null) return { day: null, week: null, month: null };

  const [d, w, m] = await Promise.all([
    getSnapshotNear(bvid, now - DAY),
    getSnapshotNear(bvid, now - 7 * DAY),
    getSnapshotNear(bvid, now - 30 * DAY),
  ]);

  const diff = (s: Snapshot | null): number | null => {
    if (!s) return null;
    const before = s[metric];
    if (before == null) return null;
    return current - before;
  };

  return { day: diff(d), week: diff(w), month: diff(m) };
}
