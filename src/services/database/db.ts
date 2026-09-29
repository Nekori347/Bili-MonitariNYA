import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

/** Lazy singleton for the SQLite database (migrations run in Rust on startup). */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:biliupmonitor.db");
  }
  return dbPromise;
}
