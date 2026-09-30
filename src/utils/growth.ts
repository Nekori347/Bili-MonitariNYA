import { getDb } from "../services/database/db";
import { getSnapshotNear, type Snapshot } from "../services/database/snapshots";
import type { StatsField, StatsSnapshot } from "../services/database/statsSnapshots";

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

const EMPTY: Growth = { day: null, week: null, month: null };

/** All stats snapshots from the last 31 days, oldest first (one query). */
async function recentStatsSnapshots(mid: number): Promise<StatsSnapshot[]> {
  const db = await getDb();
  const rows: any[] = await db.select(
    "SELECT * FROM stats_snapshots WHERE mid = $1 AND captured_at >= $2 ORDER BY captured_at ASC",
    [mid, Date.now() - 31 * DAY],
  );
  return rows.map((r) => ({
    mid: Number(r.mid),
    capturedAt: Number(r.captured_at),
    following: r.following != null ? Number(r.following) : null,
    follower: r.follower != null ? Number(r.follower) : null,
    likes: r.likes != null ? Number(r.likes) : null,
    totalViews: r.total_views != null ? Number(r.total_views) : null,
    videoCount: r.video_count != null ? Number(r.video_count) : null,
  }));
}

/**
 * Day/week/month growth for the profile stats row. No snapshot old enough for
 * a window means that window stays null (rendered as blank, never "—").
 */
export async function computeStatsGrowth(
  mid: number,
  current: Partial<Record<StatsField, number | null>>,
): Promise<Record<StatsField, Growth>> {
  const out: Record<StatsField, Growth> = {
    following: { ...EMPTY },
    follower: { ...EMPTY },
    likes: { ...EMPTY },
    totalViews: { ...EMPTY },
    videoCount: { ...EMPTY },
  };
  const snaps = await recentStatsSnapshots(mid);
  if (snaps.length === 0) return out;

  const fields = Object.keys(out) as StatsField[];
  for (const field of fields) {
    const now = current[field];
    if (now == null) continue;
    const targets: [keyof Growth, number][] = [
      ["day", Date.now() - DAY],
      ["week", Date.now() - 7 * DAY],
      ["month", Date.now() - 30 * DAY],
    ];
    for (const [key, ts] of targets) {
      let best: StatsSnapshot | null = null;
      for (const s of snaps) {
        if (s.capturedAt <= ts) best = s;
        else break;
      }
      const before = best?.[field];
      if (before == null) continue;
      const delta = now - before;
      // A zero delta is noise, not growth — leave the slot blank.
      if (delta !== 0) out[field][key] = delta;
    }
  }
  return out;
}
