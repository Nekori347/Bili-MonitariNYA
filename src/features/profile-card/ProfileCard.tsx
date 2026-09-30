import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useProfileCard } from "../../queries/profile";
import { useSubscriptions } from "../../queries/subscriptions";
import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { spaceUrl } from "../../services/bilibili/endpoints";
import { formatCount } from "../../utils/format";
import { useCachedAsset } from "../../utils/useCachedAsset";
import { useStatsGrowth } from "../../queries/statsGrowth";
import { EMPTY_GROWTH, type StatsGrowthMap } from "../../utils/growth";
import type {
  DynamicDecoration,
  FansMedal as FansMedalData,
  UserProfile,
  UserStats,
} from "../../services/bilibili/types";
import type { FieldVisibility } from "../../types/settings";
import { Upload } from "../../components/ui/Icons";
import { LEVEL_SVGS } from "../../components/ui/levelSvgs";
import { certSvg, isOrgRole } from "../../components/ui/certSvgs";
import { sexSvg } from "../../components/ui/sexSvgs";

/* ---- Avatar stack geometry -------------------------------------------------
 * The pendant PNG is a 420×420 canvas whose inner hole is only ~0.476 of the
 * canvas, so `avatar / 0.476 ≈ 151px` would put the ring exactly on the avatar
 * edge. The design calls for a tighter frame: that value × 0.80 ≈ 121px, which
 * still wraps the avatar but hugs it. The avatar body itself is never resized. */
const AVATAR = 72;
const PENDANT = Math.round((AVATAR / 0.476) * 0.8); // ≈ 121
const BOLT = 22;
const LEVEL_H = 14;

/** Distance from the stack's bottom-right corner to the bolt's, placing the
 *  bolt just outside the avatar rim, sitting on the frame. */
const boltInset = (stack: number) =>
  Math.round((stack - AVATAR) / 2 + AVATAR * (0.5 - Math.SQRT2 / 4) - BOLT / 2) - 6;

/**
 * The raw level SVGs all use `viewBox="0 0 30 30"`, but the badge artwork only
 * occupies x≈1..22 of that box (the hardcore variant adds a bolt to x≈29.7).
 * Rendering the full box pushes the badge left of centre, so each variant is
 * cropped to its own measured content box before display.
 */
const LEVEL_VIEWBOX: Record<string, string> = {
  "0": "1 8.8 21.1 12.4",
  "1": "1 8.8 21.1 12.4",
  "2": "1 8.8 21.1 12.4",
  "3": "1 8.8 21.1 12.4",
  "4": "1 8.8 21.1 12.4",
  "5": "1 8.8 21.1 12.4",
  "6": "1 8.6 21.1 12.6",
  h: "0.4 7.7 29.4 14.1",
};

export interface ProfileAssets {
  banner?: string;
  face?: string;
  pendant?: string;
  decoration?: string;
}

/** Wraps one element so the settings preview can make it a click target. */
export type ZoneRenderer = (field: keyof FieldVisibility, node: ReactNode) => ReactNode;

export interface ProfileCardViewProps {
  mid: number;
  profile: UserProfile;
  stats?: UserStats;
  decoration?: DynamicDecoration | null;
  remark?: string;
  fields: FieldVisibility;
  growth: StatsGrowthMap;
  assets: ProfileAssets;
  primaryMid?: number | null;
  /** Render every element (dimmed when off) so the preview stays clickable. */
  preview?: boolean;
  zone?: ZoneRenderer;
  onOpen?: (url: string) => void;
  /** Overrides the global 增长周期 (the preview passes it explicitly). */
  period?: "day" | "week" | "month";
}

/**
 * The one and only profile card layout. The main page and 设置 → 用户名片 both
 * render this component, so the preview can never drift from the real card.
 */
export function ProfileCardView({
  mid,
  profile,
  stats,
  decoration,
  remark,
  fields,
  growth,
  assets,
  primaryMid,
  preview = false,
  zone,
  onOpen,
  period: periodProp,
}: ProfileCardViewProps) {
  const storePeriod = useSettingsStore((s) => s.global.growthPeriod);
  const period = periodProp ?? storePeriod;
  const open = onOpen ?? ((url: string) => void openUrl(url));
  // In preview mode an element is always rendered; `zone` dims the disabled ones.
  const shown = (f: keyof FieldVisibility) => preview || fields[f];
  const z = (f: keyof FieldVisibility, node: ReactNode): ReactNode =>
    preview && zone ? zone(f, node) : node;

  const stackSize = fields.pendant && assets.pendant ? PENDANT : AVATAR + 20;
  const inset = boltInset(stackSize);

  return (
    <section
      className={`card relative flex-none overflow-hidden${preview ? " pz-scope" : ""}`}
      style={{ display: "flex", flexDirection: "column", borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}
    >
      {/* ===== ProfileHero (Banner background) ===== */}
      <div className="relative">
        {/* The banner layer is never wrapped by a preview zone: it needs the
            hero itself as its containing block, so the preview adds a separate
            click surface on top of it instead. */}
        {shown("banner") && (assets.banner ? (
          <div className="absolute inset-0">
            <img src={assets.banner} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 35%" }} draggable={false} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 6%, transparent) 30%, color-mix(in srgb, var(--bg) 82%, transparent) 100%)" }} />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--accent-soft)" }} />
        ))}
        {preview && zone && (
          <div className="absolute inset-0" style={{ zIndex: 1 }}>
            {zone("banner", <span className="absolute inset-0" />)}
          </div>
        )}

        {/* 装扮编号 — Profile Hero 的右上角，永不作为可点击入口。 */}
        {shown("decoration") && (decoration || preview) && (
          <div className="absolute" style={{ top: 4, right: 8, zIndex: 6 }}>
            {z("decoration", decoration
              ? <Ornament decoration={decoration} src={assets.decoration} />
              : <span className="ornament-placeholder" />)}
          </div>
        )}

        <div
          className="relative px-3 pb-2"
          style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", alignItems: "end", columnGap: 10, zIndex: 2, paddingTop: shown("decoration") && (decoration || preview) ? 34 : 28 }}
        >
          {/* Left: avatar stack + level */}
          {shown("avatar") && (
            <div className="flex flex-col items-center flex-none" style={{ overflow: "visible" }}>
              <div className="relative" style={{ width: stackSize, height: stackSize, overflow: "visible" }}>
                <button className="absolute inset-0 cursor-pointer flex items-center justify-center" onClick={() => open(spaceUrl(mid))} title="打开主页">
                  {/* AVATAR_LAYER (1×) — the only clipped layer */}
                  <img src={assets.face} alt=""
                    className="rounded-full object-cover absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ width: AVATAR, height: AVATAR, background: "var(--surface-2)", outline: "2px solid var(--bg)" }}
                    draggable={false} />
                  {/* PENDENT_LAYER — the ring must wrap the avatar, never clip it */}
                  {shown("pendant") && assets.pendant && (
                    <img src={assets.pendant} alt=""
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
                      style={{ width: PENDANT, height: PENDANT }} draggable={false} />
                  )}
                  {/* Preview only: keep the frame's slot visible (and clickable)
                      when there is no artwork yet, at the exact same size. */}
                  {preview && shown("pendant") && !assets.pendant && (
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                      style={{ width: PENDANT, height: PENDANT, border: "2px dashed var(--accent-ring)" }} />
                  )}
                </button>
                {shown("official") && profile.official && (
                  <CertIcon role={profile.official.role} title={profile.official.title} inset={inset} />
                )}
              </div>
              {shown("level") && <LevelIcon profile={profile} />}
            </div>
          )}

          {/* Middle: identity — 3 fixed rows */}
          <div className="min-w-0" style={{ paddingBottom: 7 }}>
            {/* row 1: name block · sex · vip */}
            <div className="flex items-center" style={{ gap: 4 }}>
              {shown("name") && (
                remark ? (
                  <div className="min-w-0 flex flex-col justify-center" style={{ lineHeight: 1.15 }}>
                    <button className="block truncate text-left font-semibold text-[14px] cursor-pointer hover:underline"
                      style={{ color: profile.nicknameColor || "var(--text)" }}
                      onClick={() => open(spaceUrl(mid))}>
                      {remark}
                    </button>
                    <button className="block truncate text-left text-[10.5px] cursor-pointer hover:underline"
                      style={{ color: "var(--text-3)" }}
                      onClick={() => open(spaceUrl(mid))}>
                      {profile.name}
                    </button>
                  </div>
                ) : (
                  <button className="font-semibold text-[15px] truncate cursor-pointer hover:underline"
                    style={{ color: profile.nicknameColor || "var(--text)", maxWidth: 150 }}
                    onClick={() => open(spaceUrl(mid))}>
                    {profile.name}
                  </button>
                )
              )}
              {shown("sex") && profile.sex && z("sex", <SexMark sex={profile.sex} />)}
              {shown("vip") && profile.isVip && z("vip", <VipLabel profile={profile} />)}
            </div>

            {/* row 2: UID · fans medal (VIP never lives here) */}
            {(shown("uid") || (shown("fansMedal") && profile.fansMedal)) && (
              <div className="flex items-center" style={{ gap: 5, marginTop: 4 }}>
                {shown("uid") && z("uid", <span className="text-[11px] leading-none" style={{ color: "var(--text-2)" }}>UID {mid}</span>)}
                {shown("fansMedal") && profile.fansMedal && z("fansMedal", <FanMedal medal={profile.fansMedal} />)}
              </div>
            )}

            {/* rows 3-4: sign (up to two lines) */}
            {shown("sign") && profile.sign && z("sign", (
              <p className="text-[11.5px] break-words" style={{ color: "var(--text-2)", marginTop: 4, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {profile.sign}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* ===== divider ===== */}
      <div style={{ height: 1, background: "color-mix(in srgb, #fb7299 40%, transparent)", flex: "none" }} />

      {/* ===== Stats: only visible columns exist, so the row fills evenly ===== */}
      <ProfileStats
        fields={fields}
        stats={stats}
        growth={growth}
        period={period}
        primaryMid={primaryMid}
        mid={mid}
        preview={preview}
        zone={zone}
        shown={shown}
      />
    </section>
  );
}

type StatKey = "following" | "follower" | "likes" | "totalViews" | "videoCount";

const STAT_LABELS: Record<StatKey, string> = {
  following: "关注",
  follower: "粉丝",
  likes: "获赞",
  totalViews: "播放",
  videoCount: "投稿",
};

const STAT_ORDER: StatKey[] = ["following", "follower", "likes", "totalViews", "videoCount"];

function ProfileStats({
  fields, stats, growth, period, primaryMid, mid, preview, zone, shown,
}: {
  fields: FieldVisibility;
  stats?: UserStats;
  growth: StatsGrowthMap;
  period: "day" | "week" | "month";
  primaryMid?: number | null;
  mid: number;
  preview: boolean;
  zone?: ZoneRenderer;
  shown: (f: keyof FieldVisibility) => boolean;
}) {
  const open = (url: string) => void openUrl(url);
  const growthSwitch: keyof FieldVisibility =
    period === "day" ? "growthDay" : period === "week" ? "growthWeek" : "growthMonth";
  const growthOn = shown(growthSwitch);
  const visible = preview ? STAT_ORDER : STAT_ORDER.filter((k) => fields[k]);

  return (
    <div className="flex items-center gap-2 px-3" style={{ background: "color-mix(in srgb, var(--surface-2) 60%, transparent)", paddingTop: 3, paddingBottom: 2 }}>
      {visible.length > 0 && (
        /* Columns are re-derived from what is on, so hiding one never leaves a gap. */
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
          {visible.map((k) => {
            const g = growth[k] ?? EMPTY_GROWTH;
            const delta = growthOn ? (period === "day" ? g.day : period === "week" ? g.week : g.month) : null;
            const cell = <StatCell label={STAT_LABELS[k]} value={stats?.[k] ?? null} delta={delta ?? null} />;
            return (
              <span key={k} style={{ display: "contents" }}>
                {preview && zone ? zone(k, cell) : cell}
              </span>
            );
          })}
        </div>
      )}
      {visible.length === 0 && <span className="flex-1" />}
      <button
        className="btn-primary btn text-[11px] px-2 py-1 rounded-md flex-none"
        style={{ visibility: primaryMid === mid ? "visible" : "hidden" }}
        onClick={() => open("https://member.bilibili.com/platform/upload-manager/article")}
        title="上传投稿"
      >
        <Upload size={12} /> 投稿
      </button>
    </div>
  );
}

/**
 * Stats cell, three stacked rows: label / value / growth pill.
 * A missing value renders as an empty slot — never "—" or "统计中".
 */
function StatCell({
  label,
  value,
  delta,
}: {
  label: string;
  value: number | null;
  delta: number | null;
}) {
  return (
    <span className="flex flex-col items-center" style={{ lineHeight: 1.1, minWidth: 0 }}>
      <span className="text-[9.5px] whitespace-nowrap" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="text-[15px] font-semibold whitespace-nowrap" style={{ color: "var(--text)" }} title={value != null ? String(value) : undefined}>
        {value == null ? "" : formatCount(value)}
      </span>
      <span className="flex items-center justify-center" style={{ height: 13 }}>
        {delta != null && <GrowthPill v={delta} />}
      </span>
    </span>
  );
}

function GrowthPill({ v }: { v: number }) {
  const color = v > 0 ? "#22a06b" : v < 0 ? "#e5484d" : "var(--text-3)";
  return (
    <span className="text-[9.5px] font-medium px-1 rounded whitespace-nowrap" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {v > 0 ? "+" : ""}{formatCount(v)}
    </span>
  );
}

function LevelIcon({ profile }: { profile: UserProfile }) {
  const key = profile.level === 6 && profile.isSeniorMember ? "h" : String(profile.level);
  const raw = LEVEL_SVGS[key];
  if (!raw) return null;
  const svg = raw.replace(/viewBox="[^"]*"/, `viewBox="${LEVEL_VIEWBOX[key] ?? LEVEL_VIEWBOX["0"]}"`);
  return (
    <span
      className="lv-badge flex-none"
      style={{ height: LEVEL_H }}
      title={profile.isSeniorMember ? `硬核会员 Lv${profile.level}` : `Lv${profile.level}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CertIcon({ role, title, inset }: { role: number; title: string; inset: number }) {
  const isOrg = isOrgRole(role);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const lines = (title || "").split(/[;；、]/).map((s) => s.trim()).filter(Boolean);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setAnchor({ x: r.left + r.width / 2, y: r.top });
  };

  return (
    <>
      <span
        ref={ref}
        className="absolute cursor-help"
        style={{ right: inset, bottom: inset, width: BOLT, height: BOLT, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.22))" }}
        onMouseEnter={show}
        onMouseLeave={() => setAnchor(null)}
        // Real Bilibili badge artwork: white ring + coloured disc + white bolt.
        // The white ring lives in the SVG, so the dark theme must not tint it.
        dangerouslySetInnerHTML={{ __html: certSvg(role) }}
      />
      {anchor && createPortal(
        <span className="fixed -translate-x-1/2 -translate-y-full pointer-events-none cert-tip"
          style={{ left: anchor.x, top: anchor.y - 6, borderColor: isOrg ? "#4AC7FF" : "#FFC62E" }}>
          <span className="block font-semibold mb-0.5" style={{ color: isOrg ? "#2b9fd0" : "#b8860b" }}>
            bilibili{isOrg ? "机构" : "个人"}认证：
          </span>
          {lines.map((l, i) => <span key={i} className="block">{l}</span>)}
        </span>,
        document.body,
      )}
    </>
  );
}

/** Small round gender mark in Bilibili's style (solid disc + white symbol). */
function SexMark({ sex }: { sex: string }) {
  const svg = sexSvg(sex);
  if (!svg) return null;
  return (
    <span
      className="sex-chip flex-none"
      title={sex}
      style={{ width: 14, height: 14 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function VipLabel({ profile }: { profile: UserProfile }) {
  if (profile.vipLabelImg) {
    return <img src={profile.vipLabelImg} alt="" height={15} style={{ height: 15 }} draggable={false} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-[1px] rounded-md flex-none" style={{ background: "var(--accent)", color: "#fff" }}>
      {profile.vipLabel || "大会员"}
    </span>
  );
}

/**
 * 粉丝牌 — MedalWall's own design, not an approximation.
 *
 * DOM:  FanMedal › MedalName + LevelCircle
 * The name and the level number deliberately use different fonts and sizes,
 * and every colour (including its alpha) comes straight from
 * `uinfo_medal.v2_medal_color_*`. There is no per-level colour table.
 */
function FanMedal({ medal }: { medal: FansMedalData }) {
  const start = medal.colorStart ?? "var(--accent)";
  const end = medal.colorEnd ?? start;
  const border = medal.colorBorder ?? start;
  const text = medal.colorText ?? "#fff";
  const level = medal.colorLevel ?? text;

  return (
    <span
      className="fan-medal flex-none"
      title={medal.guardLevel ? `${medal.name} · ${GUARD_NAME[medal.guardLevel] ?? "大航海"}` : medal.name}
      style={{
        background: `linear-gradient(90deg, ${start}, ${end})`,
        borderColor: border,
        color: text,
      }}
    >
      <span className="fm-name">
        <span>{medal.name}</span>
      </span>
      <span className="fm-level" style={{ color: level }}>
        <span>{medal.level}</span>
      </span>
      {medal.guardIcon && <img className="fm-guard" src={medal.guardIcon} alt="" draggable={false} referrerPolicy="no-referrer" />}
    </span>
  );
}

/** guard_level = 0 普通 / 3 舰长 / 2 提督 / 1 总督 */
const GUARD_NAME: Record<number, string> = { 1: "总督", 2: "提督", 3: "舰长" };

/**
 * 动态装扮 — `decoration_card`. The number is an *overlay* on the artwork's
 * reserved area, never a caption underneath it, and the whole thing is inert.
 */
function Ornament({ decoration, src }: { decoration: DynamicDecoration; src?: string }) {
  const url = decoration.imageEnhance || src || decoration.cardUrl;
  const label = decoration.fanNumberText;
  const numStyle = useMemo(() => ornamentNumberStyle(decoration), [decoration]);
  if (!url) return null;
  return (
    <div className="ornament" title={decoration.name}>
      <img src={url} alt="" className="ornament-img" draggable={false} referrerPolicy="no-referrer" />
      {label && <span className="ornament-num" style={numStyle}>{label}</span>}
    </div>
  );
}

/** `color_format` wins over the flat `fan.color`; gradients become text fills. */
function ornamentNumberStyle(d: DynamicDecoration): CSSProperties {
  const cf = d.colorFormat;
  const colors = (cf?.colors ?? []).filter((c): c is string => !!c);
  if (colors.length >= 2) {
    const angle = Number.isFinite(cf?.startPoint) ? Number(cf?.startPoint) : 90;
    return {
      backgroundImage: `linear-gradient(${angle}deg, ${colors.join(", ")})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  }
  if (colors.length === 1) return { color: colors[0] };
  if (d.color) return { color: d.color };
  return { color: "#fff" };
}

/** Level badge, reused by the collapsed header. */
export { LevelIcon, SexMark, VipLabel };

export function ProfileCard({ mid }: { mid: number }) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const globalFields = useSettingsStore((s) => s.global.fields);
  const perUserFields = useSettingsStore((s) => s.perUser[mid]?.fields);
  const fields = useMemo(() => ({ ...globalFields, ...(perUserFields ?? {}) }), [globalFields, perUserFields]);
  const primaryMid = useSettingsStore((s) => s.global.primaryAccountMid);
  const collapsed = useSettingsStore((s) => s.global.profileCollapsed);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const { data: subs } = useSubscriptions();
  const remark = subs?.find((s) => s.mid === mid)?.remark;
  const { profile, stats, decoration } = useProfileCard(mid, selectedMid === mid);

  // Hooks must run before any conditional return (React rules).
  const banner = useCachedAsset(profile?.topPhoto, `users/${mid}/banner`);
  const faceSrc = useCachedAsset(profile?.face, `users/${mid}/avatar`);
  const pendantSrc = useCachedAsset(profile?.pendantUrl, `users/${mid}/pendant`);
  const decorationImg = useCachedAsset(decoration?.imageEnhance ?? decoration?.cardUrl, `users/${mid}/decoration`);
  const growth = useStatsGrowth(mid);

  if (!profile) return <div className="card h-24 animate-pulse" />;

  const toggleCollapsed = () => updateGlobal({ profileCollapsed: !collapsed });

  if (collapsed) {
    return (
      <section className="card relative flex-none overflow-hidden">
        <div className="profile-hoverzone" />
        <ProfileHandle collapsed onToggle={toggleCollapsed} />
        <div className="flex items-center gap-2 px-3 py-1.5">
          <img src={faceSrc ?? undefined} alt="" width={22} height={22}
            className="rounded-full object-cover flex-none" style={{ background: "var(--surface-2)" }} draggable={false} />
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>
            {remark || profile.name}
          </span>
          {fields.sex && profile.sex && <SexMark sex={profile.sex} />}
          {fields.vip && profile.isVip && <VipLabel profile={profile} />}
          {fields.level && <LevelIcon profile={profile} />}
          <span className="flex-1" />
          {fields.follower && stats?.follower != null && (
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{formatCount(stats.follower)} 粉丝</span>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="relative flex-none">
      <div className="profile-hoverzone" />
      <ProfileHandle collapsed={false} onToggle={toggleCollapsed} />
      <ProfileCardView
        mid={mid}
        profile={profile}
        stats={stats}
        decoration={decoration}
        remark={remark}
        fields={fields}
        growth={growth}
        assets={{ banner, face: faceSrc, pendant: pendantSrc, decoration: decorationImg }}
        primaryMid={primaryMid}
      />
    </div>
  );
}

/** Slim control handle that slides down from the card's top edge on hover. */
function ProfileHandle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button className="profile-handle no-drag" onClick={onToggle}>
      {collapsed ? "展开名片" : "收起名片"}
    </button>
  );
}
