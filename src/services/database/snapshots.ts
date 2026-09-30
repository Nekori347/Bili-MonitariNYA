import { getDb } from "./db";

export interface Snapshot {
  mid: number;
  bvid: string;
  capturedAt: number;
  viewCount: number | null;
  likeCount: number | null;
  coinCount: number | null;
  onlineCount: number | null;
  danmakuCount: number | null;
  replyCount: number | null;
}

export async function insertSnapshot(s: Snapshot): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO video_snapshots
       (mid, bvid, captured_at, view_count, like_count, coin_count, online_count, danmaku_count, reply_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      s.mid,
      s.bvid,
      s.capturedAt,
      s.viewCount,
      s.likeCount,
      s.coinCount,
      s.onlineCount,
      s.danmakuCount ?? null,
      s.replyCount ?? null,
    ],
  );
}

/** Snapshot closest to `targetTs` for a single video, looking backwards. */
export async function getSnapshotNear(bvid: string, targetTs: number): Promise<Snapshot | null> {
  const db = await getDb();
  const rows: any[] = await db.select(
    `SELECT * FROM video_snapshots
     WHERE bvid = $1 AND captured_at <= $2
     ORDER BY ABS(captured_at - $2) ASC LIMIT 1`,
    [bvid, targetTs],
  );
  if (!rows.length) return null;
  return {
    mid: Number(rows[0].mid),
    bvid: String(rows[0].bvid),
    capturedAt: Number(rows[0].captured_at),
    viewCount: rows[0].view_count != null ? Number(rows[0].view_count) : null,
    likeCount: rows[0].like_count != null ? Number(rows[0].like_count) : null,
    coinCount: rows[0].coin_count != null ? Number(rows[0].coin_count) : null,
    onlineCount: rows[0].online_count != null ? Number(rows[0].online_count) : null,
    danmakuCount: rows[0].danmaku_count != null ? Number(rows[0].danmaku_count) : null,
    replyCount: rows[0].reply_count != null ? Number(rows[0].reply_count) : null,
  };
}

export async function pruneSnapshots(beforeTs: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM video_snapshots WHERE captured_at < $1", [beforeTs]);
}
