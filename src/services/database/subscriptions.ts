import { getDb } from "./db";

export interface Subscription {
  mid: number;
  name: string;
  addedAt: number;
  enabled: boolean;
  videoLimit: number;
  customSettingsJson: string | null;
  remark?: string;
  lastSeenLatestBvid?: string;
  hasUnreadUpdate?: boolean;
}

export interface CustomSettings {
  videoLimit?: number;
  overrides?: Record<string, boolean>;
  remark?: string;
  lastSeenLatestBvid?: string;
  hasUnreadUpdate?: boolean;
}

function mapRow(row: any): Subscription {
  const json = row.custom_settings_json ? String(row.custom_settings_json) : null;
  const cs = parseCustomSettings(json);
  return {
    mid: Number(row.mid),
    name: String(row.name ?? ""),
    addedAt: Number(row.added_at ?? 0),
    enabled: Number(row.enabled ?? 1) === 1,
    videoLimit: Number(row.video_limit ?? 20),
    customSettingsJson: json,
    remark: cs.remark,
    lastSeenLatestBvid: cs.lastSeenLatestBvid,
    hasUnreadUpdate: !!cs.hasUnreadUpdate,
  };
}

async function patchCustom(mid: number, patch: Partial<CustomSettings>): Promise<void> {
  const db = await getDb();
  const rows: any[] = await db.select("SELECT custom_settings_json FROM subscriptions WHERE mid = $1", [mid]);
  const existing = parseCustomSettings(rows[0]?.custom_settings_json ?? null);
  Object.assign(existing, patch);
  await db.execute("UPDATE subscriptions SET custom_settings_json = $1 WHERE mid = $2", [JSON.stringify(existing), mid]);
}

export async function setRemark(mid: number, remark: string): Promise<void> {
  await patchCustom(mid, { remark: remark.trim() || undefined });
}

/** Mark whether a UP has an unseen new video (pink dot). */
export async function markUnread(mid: number, hasUnread: boolean): Promise<void> {
  await patchCustom(mid, { hasUnreadUpdate: hasUnread });
}

/** Record the latest seen bvid when the user opens a UP. */
export async function markSeen(mid: number, latestBvid: string): Promise<void> {
  await patchCustom(mid, { lastSeenLatestBvid: latestBvid, hasUnreadUpdate: false });
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const db = await getDb();
  const rows: any[] = await db.select("SELECT * FROM subscriptions ORDER BY added_at ASC");
  return rows.map(mapRow);
}

export async function getSubscription(mid: number): Promise<Subscription | null> {
  const db = await getDb();
  const rows: any[] = await db.select("SELECT * FROM subscriptions WHERE mid = $1", [mid]);
  return rows.length ? mapRow(rows[0]) : null;
}

export async function upsertSubscription(sub: {
  mid: number;
  name: string;
  videoLimit?: number;
  customSettingsJson?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO subscriptions (mid, name, added_at, enabled, video_limit, custom_settings_json)
     VALUES ($1, $2, $3, 1, $4, $5)
     ON CONFLICT(mid) DO UPDATE SET name = excluded.name`,
    [sub.mid, sub.name, Date.now(), sub.videoLimit ?? 20, sub.customSettingsJson ?? null],
  );
}

export async function updateSubscription(mid: number, patch: Partial<Subscription>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];
  const set = (col: string, val: any) => {
    fields.push(`${col} = $${values.length + 1}`);
    values.push(val);
  };
  if (patch.name !== undefined) set("name", patch.name);
  if (patch.enabled !== undefined) set("enabled", patch.enabled ? 1 : 0);
  if (patch.videoLimit !== undefined) set("video_limit", patch.videoLimit);
  if (patch.customSettingsJson !== undefined) set("custom_settings_json", patch.customSettingsJson);
  if (fields.length === 0) return;
  values.push(mid);
  await db.execute(`UPDATE subscriptions SET ${fields.join(", ")} WHERE mid = $${values.length}`, values);
}

export async function removeSubscription(mid: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM subscriptions WHERE mid = $1", [mid]);
  await db.execute("DELETE FROM videos WHERE mid = $1", [mid]);
  await db.execute("DELETE FROM video_snapshots WHERE mid = $1", [mid]);
  await db.execute("DELETE FROM users_cache WHERE mid = $1", [mid]);
  // Remove the user's cached asset directory (avatar/banner/pendant/...).
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("clear_user_cache", { mid: String(mid) });
  } catch {
    /* ignore if not in Tauri */
  }
}

export function parseCustomSettings(json: string | null): CustomSettings {
  if (!json) return {};
  try {
    return JSON.parse(json) as CustomSettings;
  } catch {
    return {};
  }
}
