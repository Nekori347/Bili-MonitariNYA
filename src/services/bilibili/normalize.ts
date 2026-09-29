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
  return buildProfile(d, mid);
}

export function normalizeCardProfile(raw: any, mid: number): Partial<UserProfile> {
  const card = raw?.data?.card ?? {};
  const p = buildProfile(card, mid);
  // card endpoint uses "Official" (capital) / official_verify for certification.
  const off = card.Official ?? card.official_verify ?? card.official;
  if (off && (off.title || off.desc)) {
    p.official = {
      title: String(off.title ?? off.desc ?? ""),
      type: Number(off.type ?? 0),
      role: Number(off.role ?? 0),
      desc: off.desc ? String(off.desc) : undefined,
    };
  }
  return p;
}

/** Convert an int color or "#AARRGGBB" string to "#RRGGBB". */
function toHexColor(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const s = v.replace("#", "");
    if (s.length === 8) return "#" + s.slice(2); // drop alpha
    if (s.length === 6) return "#" + s;
    return undefined;
  }
  if (typeof v === "number") {
    return "#" + (v & 0xffffff).toString(16).padStart(6, "0");
  }
  return undefined;
}

/** Bilibili space banner URL is a relative path (bfs/space/xxx.png). */
function toBannerUrl(v: any): string | undefined {
  if (!v) return undefined;
  const s = String(v);
  if (s.startsWith("http")) return s;
  // top_photo may be "bfs/space/..." (already prefixed) or a bare filename.
  if (s.startsWith("bfs/") || s.startsWith("/bfs/")) {
    return "https://i0.hdslb.com/" + s.replace(/^\/+/, "");
  }
  return "https://i0.hdslb.com/bfs/" + s.replace(/^\/+/, "");
}

/** Shared field extraction for both acc/info and card payloads. */
function buildProfile(d: any, mid: number): UserProfile {
  const vip = d.vip ?? {};
  const label = vip.label ?? {};
  const pendant = d.pendant ?? {};
  const nameplate = d.nameplate ?? {};
  const official = d.official ?? d.Official ?? {};
  const fansMedal = d.fans_medal ?? {};
  const medal = fansMedal.medal ?? {};
  const medalDetail = fansMedal.detail ?? {};
  return {
    mid: Number(d.mid ?? mid),
    name: String(d.name ?? ""),
    face: String(d.face ?? ""),
    sign: String(d.sign ?? ""),
    level: Number(d.level ?? d.level_info?.current_level ?? 0),
    sex: String(d.sex ?? ""),
    isSeniorMember: Number(d.is_senior_member ?? 0) === 1,
    isVip: Number(vip.status ?? d.vipStatus ?? 0) === 1,
    vipType: Number(vip.type ?? d.vipType ?? 0),
    vipLabel: label.text ? String(label.text) : undefined,
    vipLabelImg: label.img_label_uri_hans_static || label.img_label_uri_hans || undefined,
    vipLabelTheme: label.label_theme ? String(label.label_theme) : undefined,
    nicknameColor: d.nickname_color ? String(d.nickname_color) : undefined,
    official: official.title || official.desc
      ? {
          title: String(official.title ?? official.desc ?? ""),
          type: Number(official.type ?? 0),
          role: Number(official.role ?? 0),
          desc: official.desc ? String(official.desc) : undefined,
        }
      : undefined,
    topPhoto: toBannerUrl(d.top_photo),
    pendantUrl: pendant.image_enhance || pendant.image || undefined,
    nameplateUrl: nameplate.image ? String(nameplate.image) : undefined,
    nameplateName: nameplate.name ? String(nameplate.name) : undefined,
    fansMedal: medal.medal_name
      ? {
          name: String(medal.medal_name),
          level: Number(medal.level ?? 0),
          colorStart: toHexColor(medal.medal_color_start),
          colorEnd: toHexColor(medal.medal_color_end),
          colorBorder: toHexColor(medal.medal_color_border ?? medalDetail.medal_color_border),
        }
      : undefined,
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
  const items = raw?.data?.items ?? [];
  // Scan a few recent dynamics for the first valid decorate.
  for (const item of items.slice(0, 8)) {
    const author = item?.modules?.module_author;
    const dec = author?.decorate ?? author?.decoration_card;
    if (!dec || typeof dec !== "object" || Object.keys(dec).length === 0) continue;
    const fan = dec.fan ?? {};
    const cardUrl = dec.card_url || dec.big_card_url || dec.image_enhance;
    if (!cardUrl && !dec.name && !fan.num_str) continue;
    return {
      id: dec.id != null ? Number(dec.id) : undefined,
      name: dec.name ? String(dec.name) : undefined,
      cardUrl: cardUrl ? String(cardUrl) : undefined,
      jumpUrl: dec.jump_url ? String(dec.jump_url) : undefined,
      fanNumber: fan.number != null ? Number(fan.number) : undefined,
      fanNumberText: fan.num_str ? String(fan.num_str) : undefined,
      color: fan.color ? String(fan.color) : undefined,
    };
  }
  return null;
}
