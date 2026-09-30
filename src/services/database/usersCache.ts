import { getDb } from "./db";
import type { DynamicDecoration, UserProfile, UserStats } from "../bilibili/types";

export interface UserCache {
  mid: number;
  profile: UserProfile | null;
  stats: UserStats | null;
  decoration: DynamicDecoration | null;
  updatedAt: number;
}

/** Read the last successful cached profile/stats/decoration for one UP. */
export async function getUserCache(mid: number): Promise<UserCache | null> {
  const db = await getDb();
  const rows: any[] = await db.select("SELECT * FROM users_cache WHERE mid = $1", [mid]);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    mid: Number(row.mid),
    profile: parseJson<UserProfile>(row.profile_json),
    stats: parseJson<UserStats>(row.stats_json),
    decoration: parseJson<DynamicDecoration>(row.decoration_json),
    updatedAt: Number(row.updated_at ?? 0),
  };
}

function parseJson<T>(raw: unknown): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

/** Insert an empty row so later single-column updates always have a target. */
async function ensureRow(mid: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO users_cache (mid, profile_json, stats_json, decoration_json, updated_at) VALUES ($1, NULL, NULL, NULL, $2)",
    [mid, Date.now()],
  );
}

/** Persist a successful profile fetch. */
export async function setUserCacheProfile(mid: number, profile: UserProfile): Promise<void> {
  const db = await getDb();
  await ensureRow(mid);
  await db.execute("UPDATE users_cache SET profile_json = $1, updated_at = $2 WHERE mid = $3", [
    JSON.stringify(profile),
    Date.now(),
    mid,
  ]);
}

/** Persist a successful stats fetch. */
export async function setUserCacheStats(mid: number, stats: UserStats): Promise<void> {
  const db = await getDb();
  await ensureRow(mid);
  await db.execute("UPDATE users_cache SET stats_json = $1, updated_at = $2 WHERE mid = $3", [
    JSON.stringify(stats),
    Date.now(),
    mid,
  ]);
}

/** Persist the decoration card so the hero keeps its right corner on restart. */
export async function setUserCacheDecoration(
  mid: number,
  decoration: DynamicDecoration | null,
): Promise<void> {
  const db = await getDb();
  await ensureRow(mid);
  await db.execute("UPDATE users_cache SET decoration_json = $1, updated_at = $2 WHERE mid = $3", [
    decoration ? JSON.stringify(decoration) : null,
    Date.now(),
    mid,
  ]);
}

/** Read every cached row in one query — used to hydrate the startup snapshot. */
export async function getCaches(mids: number[]): Promise<UserCache[]> {
  if (mids.length === 0) return [];
  const db = await getDb();
  const placeholders = mids.map((_, i) => `$${i + 1}`).join(", ");
  const rows: any[] = await db.select(
    `SELECT * FROM users_cache WHERE mid IN (${placeholders})`,
    mids,
  );
  return rows.map((row) => ({
    mid: Number(row.mid),
    profile: parseJson<UserProfile>(row.profile_json),
    stats: parseJson<UserStats>(row.stats_json),
    decoration: parseJson<DynamicDecoration>(row.decoration_json),
    updatedAt: Number(row.updated_at ?? 0),
  }));
}
