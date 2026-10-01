export type ThemeMode = "system" | "light" | "dark";

export interface FieldVisibility {
  banner: boolean;
  avatar: boolean;
  name: boolean;
  /** 备注名 — its own switch, independent of the username. */
  remark: boolean;
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
  videoDanmaku: boolean;
  videoReply: boolean;
  growthDay: boolean;
  growthWeek: boolean;
  growthMonth: boolean;
  /** Per-column growth pills, independent of which period is selected. */
  growthFollowing: boolean;
  growthFollower: boolean;
  growthLikes: boolean;
  growthTotalViews: boolean;
  growthVideoCount: boolean;
}

/** The five profile counters that can carry a growth pill. */
export type StatKey = "following" | "follower" | "likes" | "totalViews" | "videoCount";

export const STAT_ORDER: StatKey[] = ["following", "follower", "likes", "totalViews", "videoCount"];

/** Which switch controls the growth pill of each profile counter. */
export const STAT_GROWTH_KEY: Record<StatKey, keyof FieldVisibility> = {
  following: "growthFollowing",
  follower: "growthFollower",
  likes: "growthLikes",
  totalViews: "growthTotalViews",
  videoCount: "growthVideoCount",
};

/** Which switch controls the growth pill of each video counter. */
export const VIDEO_GROWTH_KEY: Partial<Record<VideoFieldKey, keyof FieldVisibility>> = {
  view: "videoView",
  like: "videoLike",
  coin: "videoCoin",
};

/** Per-video meta columns the user can reorder in settings. */
export type VideoFieldKey = "view" | "like" | "coin" | "danmaku" | "reply" | "online" | "pubdate";

export const VIDEO_FIELD_LABELS: Record<VideoFieldKey, string> = {
  view: "播放量",
  like: "点赞量",
  coin: "投币量",
  danmaku: "弹幕量",
  reply: "评论量",
  online: "在线人数",
  pubdate: "投稿时间",
};

export const DEFAULT_VIDEO_FIELD_ORDER: VideoFieldKey[] = [
  "view",
  "like",
  "coin",
  "danmaku",
  "reply",
  "online",
  "pubdate",
];

/** The one metric pinned into the video row's own trailing slot. */
export type HighlightField = "off" | VideoFieldKey;

export interface GlobalSettings {
  videoLimit: number;
  theme: ThemeMode;
  opacity: number; // 60..100
  alwaysOnTop: boolean;
  closeToTray: boolean; // 关闭按钮：隐藏到托盘 (true) 或直接退出 (false)
  trayToastShown: boolean; // 是否已显示过“后台运行”提示
  primaryAccountMid: number | null; // 主账号（仅用于显示“投稿”入口）
  /** The UP that was on screen last time, restored on the next launch. */
  lastSelectedMid: number | null;
  /** Outer frame (physical px) restored on launch, so the window reopens on
   *  the same monitor and at the same spot it was closed on. */
  windowBounds: { x: number; y: number; w: number; h: number } | null;
  highlightField: HighlightField; // 固定蓝色高亮字段
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
  /**
   * 增长数据跟随数据更新 — 开：每次更新数据都记一次增长；关：只用已有记录算增长，
   * 不再因为刷新而写入新的记录点。
   */
  growthFollowsRefresh: boolean;
  /** 标题栏显示哪个软件名：英文名（默认）或中文名。只影响显示文本。 */
  titleName: "en" | "zh";
}

export interface PerUserSettings {
  videoLimit?: number;
  fields?: Partial<FieldVisibility>;
}

export const DEFAULT_FIELDS: FieldVisibility = {
  banner: true,
  avatar: true,
  name: true,
  remark: true,
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
  videoDanmaku: true,
  videoReply: true,
  growthDay: true,
  growthWeek: true,
  growthMonth: true,
  growthFollowing: true,
  growthFollower: true,
  growthLikes: true,
  growthTotalViews: true,
  growthVideoCount: true,
};

/** Default window transparency — 外观 的 Reset 按钮恢复到该值。 */
export const DEFAULT_OPACITY = 92;

export const DEFAULT_SETTINGS: GlobalSettings = {
  videoLimit: 20,
  theme: "system",
  opacity: DEFAULT_OPACITY,
  alwaysOnTop: false,
  closeToTray: true,
  trayToastShown: false,
  primaryAccountMid: null,
  lastSelectedMid: null,
  windowBounds: null,
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
  growthFollowsRefresh: true,
  titleName: "en",
};

/**
 * Toggle names are *purpose* names, never sample content: the preview shows an
 * example identity, but a switch always reads as what it controls.
 */
export const FIELD_LABELS: Record<keyof FieldVisibility, string> = {
  banner: "Banner",
  avatar: "头像",
  name: "用户名",
  remark: "备注",
  uid: "UID",
  sign: "简介",
  level: "等级",
  sex: "性别",
  vip: "大会员",
  official: "认证",
  pendant: "头像框",
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
  videoDanmaku: "弹幕量",
  videoReply: "评论量",
  growthDay: "日增长",
  growthWeek: "周增长",
  growthMonth: "月增长",
  growthFollowing: "关注增长",
  growthFollower: "粉丝增长",
  growthLikes: "获赞增长",
  growthTotalViews: "播放增长",
  growthVideoCount: "投稿增长",
};

/** Plain-language explanation shown as the preview tooltip (点击提示仅作次要说明). */
export const FIELD_HINTS: Record<keyof FieldVisibility, string> = {
  banner: "显示用户主页顶部的自定义横幅",
  avatar: "显示用户头像",
  name: "显示用户的 B站用户名",
  remark: "显示你为这个 UP 主设置的备注名",
  uid: "显示用户的 UID",
  sign: "显示用户简介",
  level: "显示 B站用户等级标识",
  sex: "显示用户性别标识",
  vip: "显示当前大会员状态",
  official: "显示 B站个人/机构认证",
  pendant: "显示头像挂件",
  nameplate: "显示用户的勋章",
  fansMedal: "显示用户当前佩戴的粉丝勋章",
  decoration: "显示动态页作者装扮与粉丝编号",
  following: "显示该用户的关注数",
  follower: "显示该用户的粉丝数",
  likes: "显示该用户获得的总点赞数",
  totalViews: "显示该用户作品的总播放数",
  videoCount: "显示该用户的投稿数",
  videoView: "显示每条视频的播放量",
  videoLike: "显示每条视频的点赞量",
  videoCoin: "显示每条视频的投币量",
  videoOnline: "显示每条视频当前的在线观看人数",
  videoDanmaku: "显示每条视频的弹幕数",
  videoReply: "显示每条视频的评论数",
  growthDay: "显示今天的增长量，历史不足时留空",
  growthWeek: "显示最近 7 天的增长量，历史不足时留空",
  growthMonth: "显示最近 30 天的增长量，历史不足时留空",
  growthFollowing: "显示关注数的增长量",
  growthFollower: "显示粉丝数的增长量",
  growthLikes: "显示获赞数的增长量",
  growthTotalViews: "显示播放数的增长量",
  growthVideoCount: "显示投稿数的增长量",
};

/** Options for the fixed blue highlight in 视频设置. */
export const HIGHLIGHT_OPTIONS: { value: HighlightField; label: string }[] = [
  { value: "off", label: "关闭" },
  { value: "view", label: "播放量" },
  { value: "like", label: "点赞量" },
  { value: "coin", label: "投币量" },
  { value: "online", label: "在线人数" },
  { value: "pubdate", label: "投稿时间" },
];
