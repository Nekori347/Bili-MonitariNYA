import { getDb } from "./db";
import type { UserProfile, UserStats } from "../bilibili/types";

export interface UserCache {
  mid: number;
  profile: UserProfile | null;
  stats: UserStats | null;
  updatedAt: number;
}

/** Read the last successful cached profile/stats for a UP (instant display). */
export async function getUserCache(mid: number): Promise<UserCache | null> {
  const db = await getDb();
  const rows: any[] = await db.select("SELECT * FROM users_cache WHERE mid = $1", [mid]);
  if (!rows.length) return null;
  const row = rows[0];
  let profile: UserProfile | null = null;
  let stats: UserStats | null = null;
  try {
    if (row.profile_json) profile = JSON.parse(row.profile_json);
  } catch { /* ignore */ }
  try {
    if (row.stats_json) stats = JSON.parse(row.stats_json);
  } catch { /* ignore */ }
  return { mid: Number(row.mid), profile, stats, updatedAt: Number(row.updated_at ?? 0) };
}

/** Persist a successful profile fetch. */
export async function setUserCacheProfile(mid: number, profile: UserProfile): Promise<void> {
  const db = await getDb();
  const existing: any[] = await db.select("SELECT mid FROM users_cache WHERE mid = $1", [mid]);
  const json = JSON.stringify(profile);
  if (existing.length) {
    await db.execute("UPDATE users_cache SET profile_json = $1, updated_at = $2 WHERE mid = $3", [json, Date.now(), mid]);
  } else {
    await db.execute("INSERT INTO users_cache (mid, profile_json, stats_json, updated_at) VALUES ($1, $2, NULL, $3)", [mid, json, Date.now()]);
  }
}

/** Persist a successful stats fetch. */
export async function setUserCacheStats(mid: number, stats: UserStats): Promise<void> {
  const db = await getDb();
  const existing: any[] = await db.select("SELECT mid FROM users_cache WHERE mid = $1", [mid]);
  const json = JSON.stringify(stats);
  if (existing.length) {
    await db.execute("UPDATE users_cache SET stats_json = $1, updated_at = $2 WHERE mid = $3", [json, Date.now(), mid]);
  } else {
    await db.execute("INSERT INTO users_cache (mid, profile_json, stats_json, updated_at) VALUES ($1, NULL, $2, $3)", [mid, json, Date.now()]);
  }
}

/** Read only cached face URLs for the sidebar (mid -> face). */
export async function getCachedFaces(mids: number[]): Promise<Record<number, string>> {
  if (mids.length === 0) return {};
  const db = await getDb();
  const out: Record<number, string> = {};
  for (const mid of mids) {
    const rows: any[] = await db.select("SELECT profile_json FROM users_cache WHERE mid = $1", [mid]);
    if (!rows.length || !rows[0].profile_json) continue;
    try {
      const p = JSON.parse(rows[0].profile_json) as UserProfile;
      if (p.face) out[mid] = p.face;
    } catch { /* ignore */ }
  }
  return out;
}
