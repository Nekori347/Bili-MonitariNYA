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
  isVip: boolean;
  vipLabel?: string;
  official?: { title: string; type: number; desc?: string };
  topPhoto?: string;
  pendantUrl?: string;
  nameplateUrl?: string;
  fansMedal?: { name: string; level: number };
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

export interface DynamicDecoration {
  id?: number;
  name?: string;
  cardUrl?: string;
  jumpUrl?: string;
  fanNumber?: number;
  fanNumberText?: string;
  color?: string;
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
