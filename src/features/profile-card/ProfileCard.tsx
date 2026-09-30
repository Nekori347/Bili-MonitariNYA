import { useMemo, useRef, useState } from "react";
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
import type { DynamicDecoration, UserProfile } from "../../services/bilibili/types";
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
  const { profile, stats, decoration, loading } = useProfileCard(mid, selectedMid === mid);

  // Hooks must run before any conditional return (React rules).
  const banner = useCachedAsset(profile?.topPhoto, `users/${mid}/banner`);
  const faceSrc = useCachedAsset(profile?.face, `users/${mid}/avatar`);
  const pendantSrc = useCachedAsset(profile?.pendantUrl, `users/${mid}/pendant`);
  const decorationImg = useCachedAsset(decoration?.cardUrl, `users/${mid}/decoration`);
  const growth = useStatsGrowth(mid, stats);

  const open = (url: string) => void openUrl(url);
  const stackSize = fields.pendant && pendantSrc ? PENDANT : AVATAR + 20;
  const inset = boltInset(stackSize);

  if (loading && !profile) return <div className="card h-24 animate-pulse" />;
  if (!profile) {
    return <section className="card p-6 text-sm" style={{ color: "var(--text-3)" }}>用户资料加载失败，请稍后重试</section>;
  }

  const toggleCollapsed = () => updateGlobal({ profileCollapsed: !collapsed });

  /* ---- collapsed: thin header only ---- */
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
    <section
      className="card relative flex-none overflow-hidden"
      style={{ display: "flex", flexDirection: "column", borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}
    >
      <div className="profile-hoverzone" />
      <ProfileHandle collapsed={false} onToggle={toggleCollapsed} />

      {/* ===== ProfileHero (Banner background) ===== */}
      <div className="relative">
        {fields.banner && banner && (
          <div className="absolute inset-0">
            <img src={banner} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 35%" }} draggable={false} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 6%, transparent) 30%, color-mix(in srgb, var(--bg) 82%, transparent) 100%)" }} />
          </div>
        )}
        {fields.banner && !banner && <div className="absolute inset-0" style={{ background: "var(--accent-soft)" }} />}

        {/* Grid row, bottom-aligned: the identity block settles toward the
            lower half of the hero so the banner's artwork stays visible. */}
        <div
          className="relative px-3 pt-7 pb-2"
          style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "end", columnGap: 10 }}
        >
          {/* Left: avatar stack + level */}
          {fields.avatar && (
            <div className="flex flex-col items-center flex-none" style={{ overflow: "visible" }}>
              <div className="relative" style={{ width: stackSize, height: stackSize, overflow: "visible" }}>
                <button className="absolute inset-0 cursor-pointer flex items-center justify-center" onClick={() => open(spaceUrl(mid))} title="打开主页">
                  {/* AVATAR_LAYER (1×) — the only clipped layer */}
                  <img src={faceSrc} alt=""
                    className="rounded-full object-cover absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ width: AVATAR, height: AVATAR, background: "var(--surface-2)", outline: "2px solid var(--bg)" }}
                    draggable={false} />
                  {/* PENDENT_LAYER — the ring must wrap the avatar, never clip it */}
                  {fields.pendant && pendantSrc && (
                    <img src={pendantSrc} alt=""
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
                      style={{ width: PENDANT, height: PENDANT }} draggable={false} />
                  )}
                </button>
                {fields.official && profile.official && (
                  <CertIcon role={profile.official.role} title={profile.official.title} inset={inset} />
                )}
              </div>
              {fields.level && <LevelIcon profile={profile} />}
            </div>
          )}

          {/* Middle: identity — 3 fixed rows */}
          <div className="min-w-0" style={{ paddingBottom: 7 }}>
            {/* row 1: name block · sex · vip */}
            <div className="flex items-center" style={{ gap: 4 }}>
              {fields.name && (
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
              {fields.sex && profile.sex && <SexMark sex={profile.sex} />}
              {fields.vip && profile.isVip && <VipLabel profile={profile} />}
            </div>

            {/* row 2: UID · fans medal (VIP never lives here) */}
            {(fields.uid || (fields.fansMedal && profile.fansMedal)) && (
              <div className="flex items-center" style={{ gap: 5, marginTop: 4 }}>
                {fields.uid && <span className="text-[11px] leading-none" style={{ color: "var(--text-2)" }}>UID {mid}</span>}
                {fields.fansMedal && profile.fansMedal && <FansMedal profile={profile} />}
              </div>
            )}

            {/* rows 3-4: sign (up to two lines) */}
            {fields.sign && profile.sign && (
              <p className="text-[11.5px] break-words" style={{ color: "var(--text-2)", marginTop: 4, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {profile.sign}
              </p>
            )}
          </div>

          {/* Right: real decoration card artwork */}
          {fields.decoration && decoration && <DecorationCard decoration={decoration} src={decorationImg} />}
        </div>
      </div>

      {/* ===== divider ===== */}
      <div style={{ height: 1, background: "color-mix(in srgb, #fb7299 40%, transparent)", flex: "none" }} />

      {/* ===== Stats: label / value / growth ===== */}
      <div className="flex items-center gap-2 px-3" style={{ background: "color-mix(in srgb, var(--surface-2) 60%, transparent)", paddingTop: 3, paddingBottom: 2 }}>
        <div className="flex-1 grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          <StatCell label="关注" value={fields.following ? (stats?.following ?? null) : null} growth={growth.following} on={fields.growthDay || fields.growthWeek || fields.growthMonth} />
          <StatCell label="粉丝" value={fields.follower ? (stats?.follower ?? null) : null} growth={growth.follower} on={fields.growthDay || fields.growthWeek || fields.growthMonth} />
          <StatCell label="获赞" value={fields.likes ? (stats?.likes ?? null) : null} growth={growth.likes} on={fields.growthDay || fields.growthWeek || fields.growthMonth} />
          <StatCell label="播放" value={fields.totalViews ? (stats?.totalViews ?? null) : null} growth={growth.totalViews} on={fields.growthDay || fields.growthWeek || fields.growthMonth} />
          <StatCell label="投稿" value={fields.videoCount ? (stats?.videoCount ?? null) : null} growth={growth.videoCount} on={fields.growthDay || fields.growthWeek || fields.growthMonth} />
        </div>
        <button
          className="btn-primary btn text-[11px] px-2 py-1 rounded-md flex-none"
          style={{ visibility: primaryMid === mid ? "visible" : "hidden" }}
          onClick={() => open("https://member.bilibili.com/platform/upload-manager/article")}
          title="上传投稿"
        >
          <Upload size={12} /> 投稿
        </button>
      </div>
    </section>
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

/**
 * Stats cell, three stacked rows: label / value / growth pill.
 * A missing value renders as an empty slot — never "—" or "统计中".
 */
function StatCell({
  label,
  value,
  growth,
  on,
}: {
  label: string;
  value: number | null;
  growth?: { day: number | null; week: number | null; month: number | null } | null;
  on: boolean;
}) {
  const period = useSettingsStore((s) => s.global.growthPeriod);
  const showGrowth = useSettingsStore((s) => s.global.fields.growthDay);
  const key = period === "day" ? "day" : period === "week" ? "week" : "month";
  const delta = on && showGrowth ? (growth?.[key] ?? null) : null;
  return (
    <div className="flex flex-col items-center" style={{ lineHeight: 1.1 }}>
      <span className="text-[9.5px]" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="text-[15px] font-semibold" style={{ color: "var(--text)" }} title={value != null ? String(value) : undefined}>
        {value == null ? "" : formatCount(value)}
      </span>
      <span className="flex items-center justify-center" style={{ height: 13 }}>
        {delta != null && <GrowthPill v={delta} />}
      </span>
    </div>
  );
}

function GrowthPill({ v }: { v: number }) {
  const color = v > 0 ? "#22a06b" : v < 0 ? "#e5484d" : "var(--text-3)";
  return (
    <span className="text-[9.5px] font-medium px-1 rounded" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {v > 0 ? "+" : ""}{formatCount(v)}
    </span>
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

/** Fans medal using MedalWall's v2 gradient (no hardcoded level colour table). */
function FansMedal({ profile }: { profile: UserProfile }) {
  const m = profile.fansMedal!;
  const start = m.colorStart ?? "var(--accent)";
  const end = m.colorEnd ?? start;
  const border = m.colorBorder ?? start;
  return (
    <span
      className="inline-flex items-center gap-[3px] text-[10px] font-medium px-1.5 rounded-[3px] leading-none flex-none"
      style={{
        background: `linear-gradient(90deg, ${start}, ${end})`,
        color: m.colorText ?? "#fff",
        border: `1px solid ${border}`,
        height: 16,
      }}
    >
      <span className="truncate" style={{ maxWidth: 76 }}>{m.name}</span>
      <span style={{ color: m.colorLevel ?? m.colorText ?? "#fff" }}>{m.level}</span>
    </span>
  );
}

/**
 * Real decoration artwork (`decoration_card.card_url`) with the fan number
 * overlaid. Purely informational: no click target, no mall link.
 */
function DecorationCard({ decoration, src }: { decoration: DynamicDecoration; src?: string }) {
  const url = src ?? decoration.cardUrl;
  if (!url) return null;
  const label = decoration.fanNumberText || (decoration.fanNumber != null ? String(decoration.fanNumber) : "");
  return (
    <div className="decoration-card flex-none" title={decoration.name}>
      <img src={url} alt="" className="decoration-img" draggable={false} />
      {label && <span className="decoration-num" style={{ color: decoration.color ?? "#fff" }}>{label}</span>}
    </div>
  );
}
