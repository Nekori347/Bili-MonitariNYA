use tauri_plugin_sql::{Migration, MigrationKind};

/// Versioned SQLite migrations, run automatically on startup.
pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: r#"
CREATE TABLE IF NOT EXISTS subscriptions (
    mid INTEGER PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    added_at INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    video_limit INTEGER NOT NULL DEFAULT 20,
    custom_settings_json TEXT
);

CREATE TABLE IF NOT EXISTS users_cache (
    mid INTEGER PRIMARY KEY,
    profile_json TEXT,
    stats_json TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS videos (
    bvid TEXT PRIMARY KEY,
    mid INTEGER NOT NULL,
    cid INTEGER,
    title TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    pubdate INTEGER NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0,
    last_detail_json TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_videos_mid ON videos (mid);

CREATE TABLE IF NOT EXISTS video_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mid INTEGER NOT NULL,
    bvid TEXT NOT NULL,
    captured_at INTEGER NOT NULL,
    view_count INTEGER,
    like_count INTEGER,
    coin_count INTEGER,
    online_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_snapshot_video_time ON video_snapshots (bvid, captured_at);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
"#,
        kind: MigrationKind::Up,
    }]
}
