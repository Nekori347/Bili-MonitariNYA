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
import { assetImgHandlers } from "../../utils/assetCache";
import { useStatsGrowth } from "../../queries/statsGrowth";
import { EMPTY_GROWTH, type StatsGrowthMap } from "../../utils/growth";
import type {
  DynamicDecoration,
  FansMedal as FansMedalData,
  UserProfile,
  UserStats,
} from "../../services/bilibili/types";
import {
  STAT_GROWTH_KEY,
  STAT_ORDER,
  type FieldVisibility,
  type StatKey,
} from "../../types/settings";
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

/**
 * Wraps one element so the settings preview can make it a click target.
 * `style` lets a zone position itself (the banner fills the hero, the avatar
 * frame overlays the avatar) while still being the element's own click area.
 */
export type ZoneRenderer = (
  field: keyof FieldVisibility,
  node: ReactNode,
  style?: CSSProperties,
) => ReactNode;

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
 * The one and only profile card layout. The main page and both settings
 * previews render this component, so a preview can never drift from the card.
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

  // In preview an element is always rendered; `zone` dims the disabled ones.
  const shown = (f: keyof FieldVisibility) => preview || fields[f];
  const z = (f: keyof FieldVisibility, node: ReactNode, style?: CSSProperties): ReactNode =>
    preview && zone ? zone(f, node, style) : node;

  const stackSize = shown("pendant") && (assets.pendant || preview) ? PENDANT : AVATAR + 20;
  const inset = boltInset(stackSize);

  /* The hero's own geometry is fixed: nothing here depends on whether the
     decoration exists, so showing or hiding it can never resize the banner,
     move the avatar or change the card's height. */
  const HERO_PAD_TOP = 28;

  const bannerLayer = assets.banner ? (
    <div className="absolute inset-0">
      <img src={assets.banner} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 35%" }} draggable={false} {...assetImgHandlers()} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 6%, transparent) 30%, color-mix(in srgb, var(--bg) 82%, transparent) 100%)" }} />
    </div>
  ) : (
    <div className="absolute inset-0" style={{ background: "var(--accent-soft)" }} />
  );

  const pendantZoneStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    display: "block",
    zIndex: 4,
  };

  return (
    <section
      className={`card relative flex-none overflow-hidden${preview ? " pz-scope" : ""}`}
      style={{ display: "flex", flexDirection: "column", borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}
    >
      {/* ===== ProfileHero (Banner background) ===== */}
      <div className="relative">
        {preview && zone
          ? zone("banner", bannerLayer, { position: "absolute", inset: 0, display: "block" })
          : shown("banner") ? bannerLayer : null}

        {/* 装扮编号 — Profile Hero 的右上角，永不作为可点击入口。 */}
        {shown("decoration") && (decoration || preview) && (
          <div className="absolute" style={{ top: 4, right: 8, zIndex: 6 }}>
            {z(
              "decoration",
              decoration
                ? <Ornament decoration={decoration} src={assets.decoration} />
                : <span className="ornament-placeholder" />,
            )}
          </div>
        )}

        <div
          className={`relative px-3 pb-2${preview ? " pz-hero-grid" : ""}`}
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr)",
            alignItems: "end",
            columnGap: 10,
            zIndex: 2,
            paddingTop: HERO_PAD_TOP,
          }}
        >
          {/* Left: avatar stack + level */}
          {shown("avatar") && (
            <div className="flex flex-col items-center flex-none" style={{ overflow: "visible" }}>
              <div className="relative" style={{ width: stackSize, height: stackSize, overflow: "visible" }}>
                {/* The avatar's zone is the avatar's own 72px box, set above the
                    frame — not the whole 121px stack. Sizing it to the stack made
                    the frame's zone cover it completely, so 头像 could never be
                    switched without switching 头像框 too. The frame keeps the
                    ring around it. */}
                {z(
                  "avatar",
                  <button className="absolute inset-0 cursor-pointer flex items-center justify-center" onClick={() => open(spaceUrl(mid))} title="打开主页">
                    <img src={assets.face} alt=""
                      className="rounded-full object-cover absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ width: AVATAR, height: AVATAR, background: "var(--surface-2)", outline: "2px solid var(--bg)" }}
                      draggable={false} {...assetImgHandlers()} />
                  </button>,
                  {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: AVATAR,
                    height: AVATAR,
                    display: "block",
                    zIndex: 5,
                  },
                )}

                {/* PENDENT_LAYER — the ring must wrap the avatar, never clip it.
                    Its centring lives in the element's own classes so it is
                    correct in the live card too; the zone style only matters
                    while previewing. */}
                {shown("pendant") && (assets.pendant || preview) && z(
                  "pendant",
                  assets.pendant ? (
                    <img src={assets.pendant} alt=""
                      className="pointer-events-none object-contain absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ width: PENDANT, height: PENDANT }} draggable={false} {...assetImgHandlers()} />
                  ) : (
                    /* Preview keeps the frame's exact slot visible and clickable. */
                    <span className="block rounded-full"
                      style={{ width: PENDANT, height: PENDANT, border: "2px dashed var(--accent-ring)" }} />
                  ),
                  pendantZoneStyle,
                )}

                {/* Certification bolt: the wrapper owns the position, so the
                    zone can be a plain wrapper in preview and the badge still
                    lands on the avatar's rim in the live card. The zone is given
                    the bolt's box explicitly — `CertIcon` is sized with
                    `width: 100%`, so a content-sized zone would collapse to 0 and
                    the badge would stop being clickable in the preview. */}
                {shown("official") && profile.official && (
                  <div
                    className="absolute"
                    style={{ right: inset, bottom: inset, width: BOLT, height: BOLT, zIndex: 5 }}
                  >
                    {z(
                      "official",
                      <CertIcon role={profile.official.role} title={profile.official.title} />,
                      { position: "absolute", inset: 0, display: "block" },
                    )}
                  </div>
                )}
              </div>
              {shown("level") && z("level", <LevelIcon profile={profile} />)}
            </div>
          )}

          {/* Middle: identity — 3 fixed rows */}
          <div className="min-w-0" style={{ paddingBottom: 7 }}>
            {/* row 1: name block · sex · vip */}
            <div className="flex items-center" style={{ gap: 4 }}>
              {/* 备注 and 用户名 are separate switches: the remark is its own
                  line, the account name its own, and each is its own preview
                  zone. With no remark the name simply takes the whole line and
                  grows back to its single-line size. */}
              {(shown("name") || (remark && shown("remark"))) && (
                <div className="min-w-0 flex flex-col justify-center" style={{ lineHeight: 1.15 }}>
                  {remark && shown("remark") && z(
                    "remark",
                    <button className="block truncate text-left font-semibold text-[14px] cursor-pointer hover:underline"
                      style={{ color: "var(--text)" }}
                      onClick={() => open(spaceUrl(mid))}>
                      {remark}
                    </button>,
                  )}
                  {shown("name") && z(
                    "name",
                    remark && shown("remark") ? (
                      <button className="block truncate text-left text-[10.5px] cursor-pointer hover:underline"
                        style={{ color: "var(--text-3)" }}
                        onClick={() => open(spaceUrl(mid))}>
                        {profile.name}
                      </button>
                    ) : (
                      <button className="block truncate text-left font-semibold text-[15px] cursor-pointer hover:underline"
                        style={{ color: profile.nicknameColor || "var(--text)", maxWidth: 150 }}
                        onClick={() => open(spaceUrl(mid))}>
                        {profile.name}
                      </button>
                    ),
                  )}
                </div>
              )}
              {shown("sex") && profile.sex && z("sex", <SexMark sex={profile.sex} />)}
              {shown("vip") && profile.isVip && z("vip", <VipLabel profile={profile} />)}
            </div>

            {/* row 2: UID · fans medal · nameplate */}
            {(shown("uid") || (shown("fansMedal") && profile.fansMedal) || (shown("nameplate") && (profile.nameplateUrl || profile.nameplateName))) && (
              <div className="flex items-center" style={{ gap: 5, marginTop: 4 }}>
                {shown("uid") && z("uid", <span className="text-[11px] leading-none" style={{ color: "var(--text-2)" }}>UID {mid}</span>)}
                {shown("fansMedal") && profile.fansMedal && z("fansMedal", <FanMedal medal={profile.fansMedal} />)}
                {shown("nameplate") && (profile.nameplateUrl || profile.nameplateName) && z(
                  "nameplate",
                  <Nameplate profile={profile} />,
                )}
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

const STAT_LABELS: Record<StatKey, string> = {
  following: "关注",
  follower: "粉丝",
  likes: "获赞",
  totalViews: "播放",
  videoCount: "投稿",
};

/**
 * The profile counters. Hiding one removes its whole column (name, value and
 * growth) so the remaining columns redistribute evenly across the row instead
 * of leaving a gap.
 *
 * 数据栏 and 增长胶囊 are two SEPARATE things and are never nested: in the live
 * card each pill sits under its own value, but the preview lifts the pills into
 * their own row of switches. Nesting them made the pill's hit area part of the
 * value's hit area, so a single click region owned two switches and neither
 * could be hovered, tooltipped or turned off on its own.
 */
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

  // The period switch is the master; each column's own switch refines it. It is
  // read straight from `fields`, so turning 日/周/月增长 off is visible in the
  // preview instead of the sample always looking enabled.
  const periodKey: keyof FieldVisibility =
    period === "day" ? "growthDay" : period === "week" ? "growthWeek" : "growthMonth";
  const periodOn = fields[periodKey];

  const visible = preview ? STAT_ORDER : STAT_ORDER.filter((k) => fields[k]);

  const deltaOf = (k: StatKey): number | null => {
    if (!periodOn || !shown(STAT_GROWTH_KEY[k])) return null;
    const g = growth[k] ?? EMPTY_GROWTH;
    return period === "day" ? g.day : period === "week" ? g.week : g.month;
  };

  /* `empty` is what a missing delta falls back to: nothing in the live card (the
     slot just stays blank) and a dashed placeholder in the preview, so the switch
     is still reachable before any history exists. */
  const pill = (k: StatKey, empty?: ReactNode): ReactNode => {
    const d = deltaOf(k);
    return d != null ? <GrowthPill v={d} /> : empty;
  };

  const background = "color-mix(in srgb, var(--surface-2) 60%, transparent)";
  const columns = { gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` };

  return (
    <div className="flex flex-col" style={{ background }}>
      <div className="flex items-center gap-2 px-3" style={{ paddingTop: 3, paddingBottom: preview ? 1 : 2 }}>
        {visible.length > 0 ? (
          <div className="flex-1 grid" style={columns}>
            {visible.map((k) => {
              const cell = (
                <StatCell
                  label={STAT_LABELS[k]}
                  value={stats?.[k] ?? null}
                  deltaNode={preview ? undefined : pill(k)}
                />
              );
              return (
                <span key={k} style={{ display: "contents" }}>
                  {preview && zone ? zone(k, cell) : cell}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="flex-1" />
        )}
        {/* Low-weight entry point: icon only, hairline outline, accent on hover. */}
        <button
          className="upload-btn flex-none"
          style={{ visibility: primaryMid === mid ? "visible" : "hidden" }}
          onClick={() => open("https://member.bilibili.com/platform/upload-manager/article")}
          title="投稿"
        >
          <Upload size={12} />
        </button>
      </div>

      {/* 增长胶囊 — its own row, aligned under the same columns, each pill its own
          switch. Preview only: the live card keeps the pills inline with values. */}
      {preview && zone && visible.length > 0 && (
        <div className="flex items-center gap-2 px-3" style={{ paddingBottom: 3 }}>
          <div className="flex-1 grid" style={columns}>
            {visible.map((k) => (
              <span key={k} className="flex justify-center">
                {zone(STAT_GROWTH_KEY[k], pill(k, <span className="growth-pill empty">—</span>))}
              </span>
            ))}
          </div>
          {/* Reserves the 投稿 button's column so the grid stays aligned above. */}
          <span className="flex-none" style={{ width: 22 }} />
        </div>
      )}
    </div>
  );
}

/**
 * Stats cell, three stacked rows: label / value / growth pill.
 *
 * All three rows have a fixed height, so a column with no value (获赞 needs a
 * login) keeps exactly the same shape as its neighbours and the label never
 * drifts toward or away from the number. `deltaNode` is supplied by the caller
 * so the pill can be its own preview zone (显示字段 与 显示增长 相互独立).
 */
function StatCell({ label, value, deltaNode }: { label: string; value: number | null; deltaNode?: ReactNode }) {
  return (
    <span className="stat-cell">
      <span className="stat-cell-label">{label}</span>
      <span className="stat-cell-value" title={value != null ? String(value) : undefined}>
        {/* A non-breaking space keeps the row's box when there is no data. */}
        {value == null ? " " : formatCount(value)}
      </span>
      <span className="stat-cell-growth">{deltaNode}</span>
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

/** Fills the positioned wrapper the caller provides. */
function CertIcon({ role, title }: { role: number; title: string }) {
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
      {/* Positioned by the caller so the preview can use it as its own zone. */}
      <span
        ref={ref}
        className="cursor-help block w-full h-full"
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
    return <img src={profile.vipLabelImg} alt="" height={15} style={{ height: 15 }} draggable={false} referrerPolicy="no-referrer" {...assetImgHandlers()} />;
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-[1px] rounded-md flex-none" style={{ background: "var(--accent)", color: "#fff" }}>
      {profile.vipLabel || "大会员"}
    </span>
  );
}

/** 勋章 / Nameplate — the small badge Bilibili shows beside the username. */
function Nameplate({ profile }: { profile: UserProfile }) {
  if (profile.nameplateUrl) {
    return (
      <img
        src={profile.nameplateUrl}
        alt=""
        className="nameplate-img flex-none"
        title={profile.nameplateName}
        draggable={false}
        referrerPolicy="no-referrer"
        {...assetImgHandlers()}
      />
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-[1px] rounded flex-none" style={{ background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--line)" }}>
      {profile.nameplateName}
    </span>
  );
}

/**
 * 粉丝牌 — MedalWall's own design, not an approximation.
 *
 * DOM:  FanMedal › MedalName + LevelCircle
 * The name and the level digit deliberately use different fonts, and every
 * colour (including its alpha) comes straight from
 * `uinfo_medal.v2_medal_color_*`. There is no per-level colour table.
 *
 * Layout is deliberately boring, because "boring" is what makes it stable:
 *   `.fan-medal`  a non-shrinking inline-flex row
 *   `.fm-name`    flex: 0 0 auto — its width is its text and nothing else, so a
 *                 long UID beside it can never shift it
 *   `.fm-level`   a FIXED 16px disc, flex-centring a full-width inner span, so
 *                 1 / 8 / 18 / 21 / 99 all land on the same optical centre
 * Neither `zoom` nor `overflow: hidden` is used anywhere here: a scaled scroll
 * box was what sliced glyphs in half.
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
 * 动态装扮 — `decoration_card`. Image and number are ONE unit: the number is
 * overlaid inside the artwork's own reserved plate, never parked beside it.
 * The whole thing stays inert.
 */
function Ornament({ decoration, src }: { decoration: DynamicDecoration; src?: string }) {
  const url = decoration.imageEnhance || src || decoration.cardUrl;
  const label = decoration.fanNumberText;
  if (!url) return null;
  // The digits keep the decoration's own theme colour — never forced to white.
  // The 1px white stroke and the soft shadow are the entire adjustment; there is
  // no capsule, no card and no plate of ours anywhere in this ornament.
  const digitColor =
    decoration.colorFormat?.colors?.[0] ?? decoration.themeColor ?? decoration.color ?? "#fff";
  return (
    <div className="ornament" title={decoration.name}>
      <img src={url} alt="" className="ornament-img" draggable={false} referrerPolicy="no-referrer" {...assetImgHandlers()} />
      {label && (
        <span className="ornament-num" style={{ color: digitColor }}>
          {label}
        </span>
      )}
    </div>
  );
}

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

export { LevelIcon, SexMark, VipLabel };
