export type ThemeMode = "system" | "light" | "dark";

export interface FieldVisibility {
  banner: boolean;
  avatar: boolean;
  name: boolean;
  uid: boolean;
  sign: boolean;
  level: boolean;
  sex: boolean;
  vip: boolean;
  official: boolean;
  pendant: boolean;
  nameplate: boolean;
  fansMedal: boolean;
  decoration: boolean;
  following: boolean;
  follower: boolean;
  likes: boolean;
  totalViews: boolean;
  videoCount: boolean;
  videoView: boolean;
  videoLike: boolean;
  videoCoin: boolean;
  videoOnline: boolean;
  growthDay: boolean;
  growthWeek: boolean;
  growthMonth: boolean;
}

/** Per-video meta columns the user can reorder in settings. */
export type VideoFieldKey = "view" | "like" | "coin" | "online" | "pubdate";

export const VIDEO_FIELD_LABELS: Record<VideoFieldKey, string> = {
  view: "播放量",
  like: "点赞量",
  coin: "投币量",
  online: "在线人数",
  pubdate: "投稿时间",
};

export const DEFAULT_VIDEO_FIELD_ORDER: VideoFieldKey[] = ["view", "like", "coin", "online", "pubdate"];

export interface GlobalSettings {
  videoLimit: number;
  theme: ThemeMode;
  opacity: number; // 60..100
  alwaysOnTop: boolean;
  closeToTray: boolean; // 关闭按钮：隐藏到托盘 (true) 或直接退出 (false)
  trayToastShown: boolean; // 是否已显示过“后台运行”提示
  primaryAccountMid: number | null; // 主账号（仅用于显示“投稿”入口）
  highlightField: "off" | "view" | "like" | "coin" | "online"; // 固定蓝色高亮字段
  growthPeriod: "day" | "week" | "month"; // 增长周期
  sidebarWidth: number; // 展开 Sidebar 宽度（140-260）
  fields: FieldVisibility;
  /** Video meta column order (drag & drop in settings). */
  videoFieldOrder: VideoFieldKey[];
  /** Column pinned to the far right of the video row. */
  videoPinnedRight: VideoFieldKey;
  /** Profile card collapsed to a thin header. */
  profileCollapsed: boolean;
  /** Show the pink "new post" dot. */
  newPostBadge: boolean;
  /** Check GitHub Releases for a newer version. */
  updateAutoCheck: boolean;
  /** Silently check once shortly after launch. */
  updateCheckOnStart: boolean;
}

export interface PerUserSettings {
  videoLimit?: number;
  fields?: Partial<FieldVisibility>;
}

export const DEFAULT_FIELDS: FieldVisibility = {
  banner: true,
  avatar: true,
  name: true,
  uid: true,
  sign: true,
  level: true,
  sex: true,
  vip: true,
  official: true,
  pendant: true,
  nameplate: true,
  fansMedal: true,
  decoration: true,
  following: true,
  follower: true,
  likes: true,
  totalViews: true,
  videoCount: true,
  videoView: true,
  videoLike: true,
  videoCoin: true,
  videoOnline: true,
  growthDay: true,
  growthWeek: true,
  growthMonth: true,
};

export const DEFAULT_SETTINGS: GlobalSettings = {
  videoLimit: 20,
  theme: "system",
  opacity: 92,
  alwaysOnTop: false,
  closeToTray: true,
  trayToastShown: false,
  primaryAccountMid: null,
  highlightField: "off",
  growthPeriod: "day",
  sidebarWidth: 208,
  fields: { ...DEFAULT_FIELDS },
  videoFieldOrder: [...DEFAULT_VIDEO_FIELD_ORDER],
  videoPinnedRight: "pubdate",
  profileCollapsed: false,
  newPostBadge: true,
  updateAutoCheck: true,
  updateCheckOnStart: true,
};

export const FIELD_LABELS: Record<keyof FieldVisibility, string> = {
  banner: "Banner",
  avatar: "头像",
  name: "用户名",
  uid: "UID",
  sign: "简介",
  level: "等级",
  sex: "性别",
  vip: "大会员",
  official: "官方认证",
  pendant: "头像挂件",
  nameplate: "勋章",
  fansMedal: "粉丝牌",
  decoration: "装扮编号",
  following: "关注数",
  follower: "粉丝数",
  likes: "获赞数",
  totalViews: "总播放",
  videoCount: "投稿数",
  videoView: "播放量",
  videoLike: "点赞量",
  videoCoin: "投币量",
  videoOnline: "在线人数",
  growthDay: "日增长",
  growthWeek: "周增长",
  growthMonth: "月增长",
};
