import { useMemo, type ReactNode } from "react";
import { ProfileCardView } from "../profile-card/ProfileCard";
import { useCachedAsset } from "../../utils/useCachedAsset";
import { useSnapshot } from "../../store/dashboardStore";
import { useSettingsStore } from "../../store/settingsStore";
import { EMPTY_GROWTH, type StatsGrowthMap } from "../../utils/growth";
import type { UserProfile, UserStats } from "../../services/bilibili/types";
import {
  FIELD_HINTS,
  FIELD_LABELS,
  type FieldVisibility,
} from "../../types/settings";

/**
 * Used only when no subscription has been loaded yet, so the layout still has
 * something to draw. It is never the source of a setting's name — every zone is
 * labelled by what it controls (粉丝牌 / 认证 / 大会员 / 等级 …).
 */
const DEMO_PROFILE: UserProfile = {
  mid: 0,
  name: "示例用户名",
  face: "/icons/icon.png",
  sign: "这里显示 UP 主的个人简介",
  level: 6,
  sex: "男",
  isSeniorMember: false,
  isVip: true,
  vipType: 1,
  vipLabel: "大会员",
  official: { title: "bilibili 认证示例", type: 0, role: 1 },
  fansMedal: {
    name: "粉丝牌",
    level: 21,
    // Real v2 values keep their alpha byte — the same shape MedalWall returns.
    colorStart: "#5866C799",
    colorEnd: "#5866C7CC",
    colorBorder: "#FFFFFF40",
    colorText: "#FFFFFFFF",
    colorLevel: "#FFFFFFFF",
    wearing: true,
  },
};

const DEMO_STATS: UserStats = {
  mid: 0,
  following: 2676,
  follower: 11000,
  likes: 431000,
  totalViews: 3080000,
  videoCount: 98,
};

const DEMO_GROWTH: StatsGrowthMap = {
  following: { day: 2, week: 11, month: 40 },
  follower: { day: 120, week: 830, month: 3200 },
  likes: { day: 640, week: 4200, month: 16000 },
  totalViews: { day: 2100, week: 13000, month: 52000 },
  videoCount: { day: 0, week: 1, month: 3 },
} as StatsGrowthMap;

const EMPTY_GROWTH_MAP: StatsGrowthMap = {
  following: EMPTY_GROWTH,
  follower: EMPTY_GROWTH,
  likes: EMPTY_GROWTH,
  totalViews: EMPTY_GROWTH,
  videoCount: EMPTY_GROWTH,
};

/**
 * 用户名片设置 Preview. It renders the *real* profile card component, so the
 * banner, avatar stack, level, certification, name block, fans medal,
 * decoration and stats all sit exactly where they do on the main page — this
 * page never re-implements the layout.
 */
export function PreviewCard({
  mid,
  fields,
  onToggle,
}: {
  mid: number | null;
  fields: FieldVisibility;
  onToggle: (k: keyof FieldVisibility, v: boolean) => void;
}) {
  const snapshot = useSnapshot(mid ?? -1);
  const period = useSettingsStore((s) => s.global.growthPeriod);

  const profile = snapshot?.profile ?? DEMO_PROFILE;
  const stats = snapshot?.stats ?? (snapshot?.profile ? undefined : DEMO_STATS);
  const decoration = snapshot?.decoration ?? null;
  const growth = snapshot?.statsGrowth ?? (snapshot?.profile ? EMPTY_GROWTH_MAP : DEMO_GROWTH);

  const previewMid = snapshot?.profile ? (mid ?? 0) : 0;
  const banner = useCachedAsset(profile.topPhoto, `users/${previewMid}/banner`);
  const face = useCachedAsset(profile.face, `users/${previewMid}/avatar`);
  const pendant = useCachedAsset(profile.pendantUrl, `users/${previewMid}/pendant`);
  const decorationImg = useCachedAsset(
    decoration?.imageEnhance ?? decoration?.cardUrl,
    `users/${previewMid}/decoration`,
  );

  const zone = useMemo(
    () =>
      (field: keyof FieldVisibility, node: ReactNode): ReactNode => {
        const on = fields[field];
        return (
          <span
            className={`pz${on ? "" : " off"}`}
            title={`${FIELD_LABELS[field]}：${FIELD_HINTS[field]}\n点击切换显示状态`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(field, !on);
            }}
          >
            {node}
            <span className="pz-tag">
              {on ? "✓" : "✕"} {FIELD_LABELS[field]}
            </span>
          </span>
        );
      },
    [fields, onToggle],
  );

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
      <ProfileCardView
        mid={previewMid}
        profile={profile}
        stats={stats}
        decoration={decoration}
        fields={fields}
        growth={growth}
        assets={{ banner, face, pendant, decoration: decorationImg }}
        preview
        zone={zone}
        period={period}
        onOpen={() => {}}
      />
    </div>
  );
}
