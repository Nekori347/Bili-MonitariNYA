import { getDb } from "./db";

export interface Subscription {
  mid: number;
  name: string;
  addedAt: number;
  enabled: boolean;
  videoLimit: number;
  customSettingsJson: string | null;
}

export interface CustomSettings {
  videoLimit?: number;
  overrides?: Record<string, boolean>;
}

function mapRow(row: any): Subscription {
  return {
    mid: Number(row.mid),
    name: String(row.name ?? ""),
    addedAt: Number(row.added_at ?? 0),
    enabled: Number(row.enabled ?? 1) === 1,
    videoLimit: Number(row.video_limit ?? 20),
    customSettingsJson: row.custom_settings_json ? String(row.custom_settings_json) : null,
  };
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
}

export function parseCustomSettings(json: string | null): CustomSettings {
  if (!json) return {};
  try {
    return JSON.parse(json) as CustomSettings;
  } catch {
    return {};
  }
}
