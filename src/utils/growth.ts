import { getDb } from "../services/database/db";
import type { StatsField, StatsSnapshot } from "../services/database/statsSnapshots";

export interface Growth {
  day: number | null;
  week: number | null;
  month: number | null;
}

/** Day/week/month growth for every profile stats column. */
export type StatsGrowthMap = Record<StatsField, Growth>;

/** Day/week/month growth for one video's per-metric counters. */
export interface VideoGrowth {
  view: Growth;
  like: Growth;
  coin: Growth;
}

export type VideoGrowthMap = Record<string, VideoGrowth>;

const DAY = 24 * 60 * 60 * 1000;

export const EMPTY_GROWTH: Growth = { day: null, week: null, month: null };

export const EMPTY_VIDEO_GROWTH: VideoGrowth = {
  view: { ...EMPTY_GROWTH },
  like: { ...EMPTY_GROWTH },
  coin: { ...EMPTY_GROWTH },
};

/** Window start offsets: now - offset is the instant we compare against. */
const WINDOWS: [keyof Growth, number][] = [
  ["day", DAY],
  ["week", 7 * DAY],
  ["month", 30 * DAY],
];

/**
 * Pick, for each window, the newest sample at or before `now - offset` and
 * return `current - sample`. Missing history leaves the window null (rendered
 * blank, never a fake "+0").
 */
function growthFrom(
  samples: { capturedAt: number; value: number | null }[],
  current: number | null | undefined,
): Growth {
  const out: Growth = { ...EMPTY_GROWTH };
  if (current == null) return out;
  const now = Date.now();
  for (const [key, offset] of WINDOWS) {
    const target = now - offset;
    let best: number | null = null;
    // `samples` is oldest-first, so the last one at or before the target wins.
    for (const s of samples) {
      if (s.capturedAt <= target) best = s.value;
      else break;
    }
    if (best == null) continue;
    // A zero delta is noise, not growth — leave the slot blank.
    if (current !== best) out[key] = current - best;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Profile stats growth (关注 / 粉丝 / 获赞 / 播放 / 投稿)
 * ------------------------------------------------------------------ */

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

export async function computeStatsGrowth(
  mid: number,
  current: Partial<Record<StatsField, number | null>>,
): Promise<StatsGrowthMap> {
  const out: StatsGrowthMap = {
    following: { ...EMPTY_GROWTH },
    follower: { ...EMPTY_GROWTH },
    likes: { ...EMPTY_GROWTH },
    totalViews: { ...EMPTY_GROWTH },
    videoCount: { ...EMPTY_GROWTH },
  };
  const snaps = await recentStatsSnapshots(mid);
  if (snaps.length === 0) return out;

  for (const field of Object.keys(out) as StatsField[]) {
    out[field] = growthFrom(
      snaps.map((s) => ({ capturedAt: s.capturedAt, value: s[field] })),
      current[field],
    );
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Video growth (播放 / 点赞 / 投币)
 * ------------------------------------------------------------------ */

/** Shape of a video list entry the growth pass needs. */
export interface GrowthSubject {
  bvid: string;
  view: number | null;
  like: number | null;
  coin: number | null;
}

/**
 * Day/week/month growth for a whole video list in ONE query, so hydrating a
 * cached dashboard stays cheap (no per-video round trips).
 */
export async function computeVideoGrowthMap(
  mid: number,
  items: GrowthSubject[],
): Promise<VideoGrowthMap> {
  const map: VideoGrowthMap = {};
  if (items.length === 0) return map;

  const db = await getDb();
  const rows: any[] = await db.select(
    `SELECT bvid, captured_at, view_count, like_count, coin_count
       FROM video_snapshots
      WHERE mid = $1 AND captured_at >= $2
      ORDER BY bvid ASC, captured_at ASC`,
    [mid, Date.now() - 31 * DAY],
  );

  const byBvid = new Map<string, { capturedAt: number; view: number | null; like: number | null; coin: number | null }[]>();
  for (const r of rows) {
    const key = String(r.bvid);
    const list = byBvid.get(key) ?? [];
    list.push({
      capturedAt: Number(r.captured_at),
      view: r.view_count != null ? Number(r.view_count) : null,
      like: r.like_count != null ? Number(r.like_count) : null,
      coin: r.coin_count != null ? Number(r.coin_count) : null,
    });
    byBvid.set(key, list);
  }

  for (const v of items) {
    const snaps = byBvid.get(v.bvid) ?? [];
    map[v.bvid] = {
      view: growthFrom(snaps.map((s) => ({ capturedAt: s.capturedAt, value: s.view })), v.view),
      like: growthFrom(snaps.map((s) => ({ capturedAt: s.capturedAt, value: s.like })), v.like),
      coin: growthFrom(snaps.map((s) => ({ capturedAt: s.capturedAt, value: s.coin })), v.coin),
    };
  }
  return map;
}
