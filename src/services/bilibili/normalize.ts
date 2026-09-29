import type {
  DynamicDecoration,
  OnlineStats,
  UserProfile,
  UserStats,
  VideoDetail,
  VideoSummary,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function normalizeProfile(raw: any, mid: number): UserProfile {
  const d = raw?.data ?? {};
  const vip = d.vip ?? {};
  const official = d.official ?? {};
  const fansMedal = d.fans_medal ?? {};
  return {
    mid: Number(d.mid ?? mid),
    name: String(d.name ?? ""),
    face: String(d.face ?? ""),
    sign: String(d.sign ?? ""),
    level: Number(d.level ?? 0),
    isVip: Number(vip.status ?? 0) === 1,
    vipLabel: vip.label?.text ? String(vip.label.text) : undefined,
    official: official.title
      ? { title: String(official.title), type: Number(official.type ?? 0), desc: official.desc ? String(official.desc) : undefined }
      : undefined,
    topPhoto: d.top_photo ? String(d.top_photo) : undefined,
    pendantUrl: d.pendant?.image ? String(d.pendant.image) : undefined,
    nameplateUrl: d.nameplate?.image ? String(d.nameplate.image) : undefined,
    fansMedal: fansMedal.medal?.medal_name
      ? { name: String(fansMedal.medal.medal_name), level: Number(fansMedal.medal.level ?? 0) }
      : undefined,
  };
}

export function normalizeCardProfile(raw: any, mid: number): Partial<UserProfile> {
  const card = raw?.data?.card ?? {};
  return {
    mid: Number(card.mid ?? mid),
    name: String(card.name ?? ""),
    face: String(card.face ?? ""),
    sign: String(card.sign ?? ""),
    level: Number(card.level_info?.current_level ?? 0),
    isVip: Number(card.vip?.status ?? 0) === 1,
    vipLabel: card.vip?.label?.text ? String(card.vip.label.text) : undefined,
    official: card.official?.title
      ? { title: String(card.official.title), type: Number(card.official.type ?? 0) }
      : undefined,
    topPhoto: card.top_photo ? String(card.top_photo) : undefined,
  };
}

export function normalizeRelationStat(raw: any, mid: number): Partial<UserStats> {
  const d = raw?.data ?? {};
  return {
    mid: Number(d.mid ?? mid),
    following: Number(d.following ?? 0),
    follower: Number(d.follower ?? 0),
  };
}

export function normalizeUpStat(raw: any, mid: number): Partial<UserStats> {
  const d = raw?.data ?? {};
  const archive = d.archive ?? {};
  return {
    mid,
    likes: typeof archive.likes === "number" ? archive.likes : null,
    totalViews: typeof archive.view === "number" ? archive.view : null,
  };
}

export function normalizeVideoSummary(raw: any): VideoSummary[] {
  const list = raw?.data?.list?.vlist ?? [];
  const out: VideoSummary[] = [];
  for (const item of list) {
    out.push({
      bvid: String(item.bvid ?? ""),
      aid: Number(item.aid ?? 0),
      title: String(item.title ?? ""),
      cover: String(item.pic ?? ""),
      pubdate: Number(item.created ?? 0),
      duration: parseDuration(item.length),
      view: null,
      like: null,
      coin: null,
    });
  }
  return out;
}

export function normalizeVideoDetail(raw: any): VideoDetail {
  const d = raw?.data ?? {};
  const stat = d.stat ?? {};
  const owner = d.owner ?? {};
  const cid = Array.isArray(d.pages) && d.pages.length > 0 ? Number(d.pages[0].cid ?? 0) : Number(d.cid ?? 0);
  return {
    aid: Number(d.aid ?? 0),
    bvid: String(d.bvid ?? ""),
    cid,
    title: String(d.title ?? ""),
    pic: String(d.pic ?? ""),
    pubdate: Number(d.pubdate ?? 0),
    duration: Number(d.duration ?? 0),
    ownerMid: Number(owner.mid ?? d.mid ?? 0),
    ownerName: String(owner.name ?? ""),
    view: Number(stat.view ?? 0),
    danmaku: Number(stat.danmaku ?? 0),
    reply: Number(stat.reply ?? 0),
    favorite: Number(stat.favorite ?? 0),
    coin: Number(stat.coin ?? 0),
    share: Number(stat.share ?? 0),
    like: Number(stat.like ?? 0),
  };
}

function parseDuration(v: unknown): number {
  const s = String(v ?? "");
  const m = s.match(/^(\d+):(\d+)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeOnline(raw: any): OnlineStats {
  const d = raw?.data ?? {};
  const total: string = d.total ?? "";
  // `count` is a numeric string (e.g. "13"); exact count may be absent.
  const count = Number(d.count);
  const exact = Number.isFinite(count) && count > 0 ? count : undefined;
  return {
    displayText: total ? String(total) : formatCount(exact),
    exactCount: exact,
    isEstimate: exact === undefined,
  };
}

function formatCount(n?: number): string {
  if (!n) return "0";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

export function normalizeDecoration(raw: any): DynamicDecoration | null {
  const author = raw?.data?.items?.[0]?.modules?.module_author;
  const dec = author?.decorate;
  if (!dec || Object.keys(dec).length === 0) return null;
  const fan = dec.fan ?? {};
  return {
    id: dec.id != null ? Number(dec.id) : undefined,
    name: dec.name ? String(dec.name) : undefined,
    cardUrl: dec.card_url ? String(dec.card_url) : undefined,
    jumpUrl: dec.jump_url ? String(dec.jump_url) : undefined,
    fanNumber: fan.number != null ? Number(fan.number) : undefined,
    fanNumberText: fan.num_str ? String(fan.num_str) : undefined,
    color: fan.color ? String(fan.color) : undefined,
  };
}
