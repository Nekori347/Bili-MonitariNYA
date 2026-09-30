// Normalized Bilibili domain types used across the app.

export interface UserIdentity {
  mid: number;
}

export interface UserProfile {
  mid: number;
  name: string;
  face: string;
  sign: string;
  level: number;
  sex: string; // "男" / "女" / "保密" / ""
  isSeniorMember: boolean; // 硬核会员 Lv6
  isVip: boolean;
  vipType: number; // 0 无 / 1 大会员 / 2 年度大会员
  vipLabel?: string;
  vipLabelImg?: string; // native VIP label image (img_label_uri_hans_static)
  vipLabelTheme?: string; // e.g. "annual_vip"
  nicknameColor?: string;
  official?: { title: string; type: number; role: number; desc?: string };
  topPhoto?: string;
  pendantUrl?: string; // avatar frame (image_enhance preferred)
  nameplateUrl?: string; // nameplate badge image
  nameplateName?: string;
  fansMedal?: FansMedal;
}

/**
 * 粉丝勋章. Colors come from MedalWall's `v2_*` fields when available (the real
 * gradient Bilibili renders); `show`/`wear` tell us whether to display at all.
 */
export interface FansMedal {
  name: string;
  level: number;
  medalId?: number;
  /**
   * MedalWall's `v2_medal_color_*` values, kept exactly as served — they are
   * 8-digit `#RRGGBBAA` hex, so the alpha is part of the design.
   */
  colorStart?: string;
  colorEnd?: string;
  colorBorder?: string;
  colorText?: string;
  /** Per-level text color (v2_medal_color_level) — used by the level number. */
  colorLevel?: string;
  /** 0 普通 / 3 舰长 / 2 提督 / 1 总督 */
  guardLevel?: number;
  /** 大航海图标，服务端直接下发时优先使用。 */
  guardIcon?: string;
  wearing?: boolean;
}

export interface UserStats {
  mid: number;
  following: number;
  follower: number;
  likes: number | null; // may be unavailable anonymously
  totalViews: number | null; // may be unavailable anonymously
  videoCount: number | null;
}

export interface VideoSummary {
  bvid: string;
  aid: number;
  title: string;
  cover: string;
  pubdate: number;
  duration: number;
  // filled by detail
  view: number | null;
  like: number | null;
  coin: number | null;
  danmaku: number | null;
  reply: number | null;
}

export interface VideoDetail {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  pic: string;
  pubdate: number;
  duration: number;
  ownerMid: number;
  ownerName: string;
  view: number;
  danmaku: number;
  reply: number;
  favorite: number;
  coin: number;
  share: number;
  like: number;
}

export interface OnlineStats {
  displayText: string;
  exactCount?: number;
  isEstimate: boolean;
}

/** `decoration_card.fan.color_format` — the real gradient behind the fan number. */
export interface DecorationColorFormat {
  colors?: string[];
  startPoint?: number;
  endPoint?: number;
  gradients?: string[];
}

export interface DynamicDecoration {
  id?: number;
  name?: string;
  cardUrl?: string;
  /** `image_enhance` — the high-resolution variant of the artwork. */
  imageEnhance?: string;
  jumpUrl?: string;
  fanNumber?: number;
  fanNumberText?: string;
  color?: string;
  colorFormat?: DecorationColorFormat;
}

export type BiliErrorType =
  | "network"
  | "rate_limit"
  | "wbi"
  | "auth"
  | "not_found"
  | "api_changed"
  | "unknown";

export class BiliError extends Error {
  type: BiliErrorType;
  code?: number;
  constructor(type: BiliErrorType, message: string, code?: number) {
    super(message);
    this.name = "BiliError";
    this.type = type;
    this.code = code;
  }
}
