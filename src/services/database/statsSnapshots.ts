import { getDb } from "./db";
import type { UserStats } from "../bilibili/types";

/** One point-in-time capture of a UP's public counters. */
export interface StatsSnapshot {
  mid: number;
  capturedAt: number;
  following: number | null;
  follower: number | null;
  likes: number | null;
  totalViews: number | null;
  videoCount: number | null;
}

/** Column names usable for growth lookups. */
export type StatsField = "following" | "follower" | "likes" | "totalViews" | "videoCount";

const COLUMN: Record<StatsField, string> = {
  following: "following",
  follower: "follower",
  likes: "likes",
  totalViews: "total_views",
  videoCount: "video_count",
};

/** Avoid piling up duplicate rows when a refresh returns unchanged numbers. */
const MIN_GAP_MS = 10 * 60 * 1000;

export async function insertStatsSnapshot(mid: number, stats: UserStats): Promise<void> {
  if (stats.following == null && stats.follower == null && stats.likes == null && stats.totalViews == null) {
    return;
  }
  const db = await getDb();
  const last: any[] = await db.select(
    "SELECT * FROM stats_snapshots WHERE mid = $1 ORDER BY captured_at DESC LIMIT 1",
    [mid],
  );
  const now = Date.now();
  const prev = last[0];
  if (prev) {
    const same =
      Number(prev.following ?? -1) === (stats.following ?? -1) &&
      Number(prev.follower ?? -1) === (stats.follower ?? -1) &&
      Number(prev.likes ?? -1) === (stats.likes ?? -1) &&
      Number(prev.total_views ?? -1) === (stats.totalViews ?? -1) &&
      Number(prev.video_count ?? -1) === (stats.videoCount ?? -1);
    if (same && now - Number(prev.captured_at) < MIN_GAP_MS) return;
  }
  await db.execute(
    `INSERT INTO stats_snapshots (mid, captured_at, following, follower, likes, total_views, video_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [mid, now, stats.following, stats.follower, stats.likes, stats.totalViews, stats.videoCount],
  );
}

/** Snapshot closest to (and not after) `targetTs`. */
export async function findStatsSnapshot(mid: number, targetTs: number): Promise<StatsSnapshot | null> {
  const db = await getDb();
  const rows: any[] = await db.select(
    `SELECT * FROM stats_snapshots
     WHERE mid = $1 AND captured_at <= $2
     ORDER BY captured_at DESC LIMIT 1`,
    [mid, targetTs],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    mid: Number(r.mid),
    capturedAt: Number(r.captured_at),
    following: r.following != null ? Number(r.following) : null,
    follower: r.follower != null ? Number(r.follower) : null,
    likes: r.likes != null ? Number(r.likes) : null,
    totalViews: r.total_views != null ? Number(r.total_views) : null,
    videoCount: r.video_count != null ? Number(r.video_count) : null,
  };
}

export const STATS_COLUMN = COLUMN;
