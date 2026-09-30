use tauri_plugin_sql::{Migration, MigrationKind};

/// Versioned SQLite migrations, run automatically on startup.
///
/// NEVER rebuild the database on upgrade — user subscriptions, remarks,
/// settings, growth history and the login credential must survive app updates.
/// Add a new `Migration` entry for every schema change instead.
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
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
        },
        Migration {
            version: 2,
            description: "sidebar_order_and_stats_snapshots",
            sql: r#"
-- Manual ordering of the subscription list (sidebar drag & drop).
ALTER TABLE subscriptions ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Day/week/month growth for the profile stats row (following/follower/...).
CREATE TABLE IF NOT EXISTS stats_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mid INTEGER NOT NULL,
    captured_at INTEGER NOT NULL,
    following INTEGER,
    follower INTEGER,
    likes INTEGER,
    total_views INTEGER,
    video_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_stats_snapshot_mid_time ON stats_snapshots (mid, captured_at);
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "cache_dynamic_decoration",
            sql: r#"
-- Decoration card (动态装扮编号) so the profile hero restores instantly on
-- launch instead of waiting for the risk-controlled dynamic feed.
ALTER TABLE users_cache ADD COLUMN decoration_json TEXT;
"#,
            kind: MigrationKind::Up,
        },
    ]
}
