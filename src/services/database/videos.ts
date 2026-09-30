import { getDb } from "./db";
import type { VideoSummary } from "../bilibili/types";

/** A cached list entry, including the cid needed to query online viewers. */
export interface CachedVideo extends VideoSummary {
  cid: number;
}

/** Load the last-known video list for a UP (instant display on user switch). */
export async function getCachedVideos(mid: number, limit: number): Promise<CachedVideo[]> {
  const db = await getDb();
  const rows: any[] = await db.select(
    "SELECT * FROM videos WHERE mid = $1 ORDER BY pubdate DESC LIMIT $2",
    [mid, limit],
  );
  return rows.map((r) => {
    let detail: any = {};
    try {
      if (r.last_detail_json) detail = JSON.parse(r.last_detail_json);
    } catch { /* ignore */ }
    return {
      bvid: String(r.bvid ?? ""),
      aid: Number(r.aid ?? detail.aid ?? 0),
      title: String(r.title ?? ""),
      cover: String(r.cover ?? ""),
      pubdate: Number(r.pubdate ?? 0),
      duration: Number(r.duration ?? 0),
      view: detail.view ?? null,
      like: detail.like ?? null,
      coin: detail.coin ?? null,
      danmaku: detail.danmaku ?? null,
      reply: detail.reply ?? null,
      cid: r.cid != null ? Number(r.cid) : 0,
    };
  });
}

/** Persist a fetched video list (list summary only; details are written separately). */
export async function saveVideos(mid: number, list: VideoSummary[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  for (const v of list) {
    if (!v.bvid) continue;
    await db.execute(
      `INSERT INTO videos (bvid, mid, cid, title, cover, pubdate, duration, last_detail_json, updated_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, NULL, $7)
       ON CONFLICT(bvid) DO UPDATE SET
         title = excluded.title, cover = excluded.cover,
         pubdate = excluded.pubdate, duration = excluded.duration, updated_at = excluded.updated_at`,
      [v.bvid, mid, v.title, v.cover, v.pubdate, v.duration, now],
    );
  }
}

/** Persist a video's detail stats for cache display. */
export async function saveVideoDetail(
  bvid: string,
  detail: {
    view: number;
    like: number;
    coin: number;
    danmaku: number;
    reply: number;
    cid: number;
    aid?: number;
  },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE videos SET last_detail_json = $1, cid = $2, updated_at = $3 WHERE bvid = $4",
    [
      JSON.stringify({
        view: detail.view,
        like: detail.like,
        coin: detail.coin,
        danmaku: detail.danmaku,
        reply: detail.reply,
        aid: detail.aid,
      }),
      detail.cid,
      Date.now(),
      bvid,
    ],
  );
}
