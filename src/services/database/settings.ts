import { getDb } from "./db";

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const rows: any[] = await db.select("SELECT value FROM app_settings WHERE key = $1", [key]);
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return null;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}
