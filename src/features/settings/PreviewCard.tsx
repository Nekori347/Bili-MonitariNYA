import { useMemo, type CSSProperties, type ReactNode } from "react";
import { ProfileCardView } from "../profile-card/ProfileCard";
import { useCachedAsset } from "../../utils/useCachedAsset";
import { useSettingsStore } from "../../store/settingsStore";
import { EMPTY_GROWTH, type StatsGrowthMap } from "../../utils/growth";
import type { UserProfile, UserStats } from "../../services/bilibili/types";
import {
  FIELD_HINTS,
  FIELD_LABELS,
  type FieldVisibility,
} from "../../types/settings";

/**
 * A deliberately anonymous identity.
 *
 * 全局设置的 Preview 说明的是「这个模板长什么样」，不是「当前 UP 会变成什么
 * 样」。它必须永远是这一个中性样本：没有真实订阅数据，没有真实用户名、UID、
 * 认证文案或装扮编号，每个可点区域只由用途名（粉丝牌 / 认证 / 等级 …）标识。
 */
const NEUTRAL_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">' +
      '<rect width="72" height="72" fill="#c7ccd6"/>' +
      '<circle cx="36" cy="27" r="13" fill="#eef0f4"/>' +
      '<path d="M8 72c0-15.5 12.5-25 28-25s28 9.5 28 25z" fill="#eef0f4"/>' +
      "</svg>",
  );

const SIMPLE_USER: UserProfile = {
  mid: 123456,
  name: "用户名",
  face: NEUTRAL_AVATAR,
  sign: "用户简介",
  level: 5,
  sex: "男",
  isSeniorMember: false,
  isVip: true,
  vipType: 1,
  vipLabel: "大会员",
  official: { title: "个人认证", type: 0, role: 1 },
  nameplateName: "勋章",
  fansMedal: {
    name: "粉丝牌",
    level: 12,
    // Real v2 values keep their alpha byte — the same shape MedalWall returns.
    colorStart: "#5866C799",
    colorEnd: "#5866C7CC",
    colorBorder: "#FFFFFF40",
    colorText: "#FFFFFFFF",
    colorLevel: "#FFFFFFFF",
    wearing: true,
  },
};

const SIMPLE_STATS: UserStats = {
  mid: 123456,
  following: 1200,
  follower: 34000,
  likes: 120000,
  totalViews: 2400000,
  videoCount: 56,
};

const SIMPLE_GROWTH: StatsGrowthMap = {
  following: { day: 2, week: 11, month: 40 },
  follower: { day: 120, week: 830, month: 3200 },
  likes: { day: 640, week: 4200, month: 16000 },
  totalViews: { day: 2100, week: 13000, month: 52000 },
  videoCount: { day: null, week: 1, month: 3 },
};

/**
 * 用户名片设置 Preview. It renders the *real* profile card component, so the
 * banner, avatar stack, level, certification, name block, fans medal,
 * nameplate, decoration and stats all sit exactly where they do on the main
 * page — this page never re-implements the layout.
 *
 * `neutral` forces the anonymous sample (全局设置永远用它)；单个 UP 的设置则显示
 * 该 UP 的真实数据，因为它说明的正是「这个 UP 会被改成什么样」。
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
  // Always the anonymous sample: a settings preview explains what the template
  // looks like, never what the currently selected UP would become.
  const period = useSettingsStore((s) => s.global.growthPeriod);
  const profile = SIMPLE_USER;
  const stats = SIMPLE_STATS;
  const growth = SIMPLE_GROWTH;
  void mid;

  const banner = useCachedAsset(profile.topPhoto, "users/0/banner");
  const face = useCachedAsset(profile.face, "users/0/avatar");
  const pendant = useCachedAsset(profile.pendantUrl, "users/0/pendant");

  const zone = useMemo(
    () =>
      (field: keyof FieldVisibility, node: ReactNode, style?: CSSProperties): ReactNode => {
        const on = fields[field];
        const banner = field === "banner";
        return (
          <span
            className={`pz${on ? "" : " off"}${banner ? " banner-zone" : ""}`}
            // A zone may position itself so it stays the element's own hit area
            // (the banner fills the hero, the avatar frame overlays the avatar).
            style={banner ? { position: "absolute", inset: 0, display: "block", ...style } : style}
            title={`${FIELD_LABELS[field]}：${FIELD_HINTS[field]}\n点击切换显示状态`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(field, !on);
            }}
          >
            {node}
            <span className={`pz-tag${banner ? " inside" : ""}`}>
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
        mid={0}
        profile={profile}
        stats={stats}
        /* No decoration on purpose: the anonymous sample must not carry a real
           装扮编号. The preview shows the placeholder slot instead. */
        decoration={null}
        remark="备注名"
        fields={fields}
        growth={growth}
        assets={{ banner, face, pendant }}
        preview
        zone={zone}
        period={period}
        onOpen={() => {}}
      />
    </div>
  );
}

export { EMPTY_GROWTH };
