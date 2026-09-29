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
import type { DynamicDecoration, UserProfile } from "../../services/bilibili/types";
import { Upload } from "../../components/ui/Icons";
import { LEVEL_SVGS } from "../../components/ui/levelSvgs";

/* Avatar stack geometry.
 * The pendant art is a 420×420 canvas whose inner hole measures ~200px across,
 * so the ring only sits AROUND the avatar when it is rendered at
 * avatar / 0.476 ≈ 2.1×. Anything smaller presses the frame into the avatar. */
const AVATAR = 72;
const PENDANT = Math.round(AVATAR / 0.476); // ≈ 151
const BOLT = 22;
/** Distance from the stack's bottom-right corner to the bolt's, so the bolt
 *  centre lands on the avatar circle's 45° rim point (overlapping the frame). */
const boltInset = (stack: number) => Math.round((stack - AVATAR) / 2 + AVATAR * (0.5 - Math.SQRT2 / 4) - BOLT / 2);

/**
 * The raw level SVGs all use `viewBox="0 0 30 30"`, but the badge artwork only
 * occupies x≈1..22 of that box (the hardcore variant adds a bolt up to x≈29.7).
 * Rendering the full box therefore pushes the badge left of centre — so each
 * variant is cropped to its own measured content box before display.
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

const LEVEL_H = 14;

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
  const { data: subs } = useSubscriptions();
  const remark = subs?.find((s) => s.mid === mid)?.remark;
  const { profile, stats, decoration, loading } = useProfileCard(mid, selectedMid === mid);

  // Hooks must run before any conditional return (React rules).
  const banner = useCachedAsset(profile?.topPhoto, `users/${mid}/banner`);
  const faceSrc = useCachedAsset(profile?.face, `users/${mid}/avatar`);
  const pendantSrc = useCachedAsset(profile?.pendantUrl, `users/${mid}/pendant`);
  const open = (url: string) => void openUrl(url);
  // The stack reserves the pendant's full canvas when one exists so nothing clips.
  const stackSize = fields.pendant && pendantSrc ? PENDANT : AVATAR + 20;
  const inset = boltInset(stackSize);

  if (loading && !profile) return <div className="card h-36 animate-pulse" />;
  if (!profile) {
    return <section className="card p-6 text-sm" style={{ color: "var(--text-3)" }}>用户资料加载失败，请稍后重试</section>;
  }

  return (
    <section className="card overflow-hidden relative flex-none" style={{ display: "flex", flexDirection: "column", borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}>
      {/* ===== ProfileHero (Banner background) ===== */}
      <div className="relative" style={{ minHeight: 100 }}>
        {fields.banner && banner && (
          <div className="absolute inset-0">
            <img src={banner} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center center" }} draggable={false} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 10%, transparent), color-mix(in srgb, var(--bg) 78%, transparent))" }} />
          </div>
        )}
        {fields.banner && !banner && <div className="absolute inset-0" style={{ background: "var(--accent-soft)" }} />}

        <div className="relative flex items-start gap-2.5 px-3 pt-5 pb-2">
          {/* Left avatar column — single center axis for avatar stack + level */}
          {fields.avatar && (
            <div className="flex flex-col items-center flex-none" style={{ overflow: "visible" }}>
              <div className="relative" style={{ width: stackSize, height: stackSize, overflow: "visible" }}>
                <button className="absolute inset-0 cursor-pointer flex items-center justify-center" onClick={() => open(spaceUrl(mid))} title="打开主页">
                  {/* AVATAR_LAYER (1×) — the only clipped layer */}
                  <img src={faceSrc} alt=""
                    className="rounded-full object-cover absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ width: AVATAR, height: AVATAR, background: "var(--surface-2)", outline: "2px solid var(--bg)" }}
                    draggable={false} />
                  {/* PENDENT_LAYER — Bilibili pendant art is a 420px canvas whose
                      inner hole is ~0.476 of the canvas, so the pendant must be
                      sized avatar/0.476 ≈ 2.1× for the ring to sit AROUND the
                      avatar instead of on top of it. */}
                  {fields.pendant && pendantSrc && (
                    <img src={pendantSrc} alt=""
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
                      style={{ width: PENDANT, height: PENDANT }} draggable={false} />
                  )}
                </button>
                {/* Certification bolt: on the avatar's lower-right rim, overlapping the frame */}
                {fields.official && profile.official && (
                  <CertIcon role={profile.official.role} title={profile.official.title} inset={inset} />
                )}
              </div>
              {fields.level && <LevelIcon profile={profile} />}
            </div>
          )}

          {/* Right identity column — compact 3 rows */}
          <div className="flex-1 min-w-0">
            {/* row 1: name block · sex · vip */}
            <div className="flex items-center" style={{ gap: 4 }}>
              {fields.name && (
                remark ? (
                  <div className="min-w-0 flex flex-col justify-center leading-[1.15]">
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
                  <button className="font-semibold text-[15px] leading-[1.2] truncate cursor-pointer hover:underline"
                    style={{ color: profile.nicknameColor || "var(--text)", maxWidth: "58%" }}
                    onClick={() => open(spaceUrl(mid))}>
                    {profile.name}
                  </button>
                )
              )}
              {fields.sex && profile.sex && (
                <span className="sex-chip"><SexIcon sex={profile.sex} /></span>
              )}
              {fields.vip && profile.isVip && <VipLabel profile={profile} />}
            </div>

            {/* row 2: UID · fans medal */}
            {(fields.uid || fields.fansMedal) && (
              <div className="flex items-center" style={{ gap: 5, marginTop: 3 }}>
                {fields.uid && <span className="text-[11px] leading-[1.2]" style={{ color: "var(--text-2)" }}>UID {mid}</span>}
                {fields.fansMedal && profile.fansMedal && <FansMedal profile={profile} />}
              </div>
            )}

            {/* row 3: sign */}
            {fields.sign && profile.sign && (
              <p className="text-[11.5px] leading-[1.25] break-words" style={{ color: "var(--text-2)", marginTop: 3 }}>
                {profile.sign}
              </p>
            )}
          </div>

          {/* Top-right decoration card */}
          <DecorationCard decoration={decoration} visible={fields.decoration} />
        </div>
      </div>

      {/* ===== divider ===== */}
      <div style={{ height: 1, background: "color-mix(in srgb, #fb7299 40%, transparent)", flex: "none" }} />

      {/* ===== ProfileStats (3-row grid) ===== */}
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "color-mix(in srgb, var(--surface-2) 60%, transparent)" }}>
        <div className="flex-1 grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          <StatCell value={fields.following ? (stats?.following ?? null) : null} label="关注" unavailable={false} />
          <StatCell value={fields.follower ? (stats?.follower ?? null) : null} label="粉丝" unavailable={false} />
          <StatCell value={fields.likes ? (stats?.likes ?? null) : null} label="获赞" unavailable={stats?.likes == null} />
          <StatCell value={fields.totalViews ? (stats?.totalViews ?? null) : null} label="播放" unavailable={stats?.totalViews == null} />
          <StatCell value={fields.videoCount ? (stats?.videoCount ?? null) : null} label="投稿" unavailable={stats?.videoCount == null} />
        </div>
        {primaryMid === mid && (
          <button className="btn-primary btn text-[11px] px-2 py-1 rounded-md flex-none" onClick={() => open("https://member.bilibili.com/platform/upload-manager/article")} title="上传投稿">
            <Upload size={12} /> 投稿
          </button>
        )}
      </div>
    </section>
  );
}

function StatCell({ value, label, unavailable }: { value: number | null; label: string; unavailable: boolean }) {
  // Fixed 3-row grid: number / label / (growth slot, empty for now).
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }} title={value != null ? String(value) : undefined}>
        {value == null ? (unavailable ? "—" : "") : formatCount(value)}
      </span>
      <span className="text-[10px]" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="text-[10px]" style={{ height: 13 }} />
    </div>
  );
}

function CertIcon({ role, title, inset }: { role: number; title: string; inset: number }) {
  const isOrg = role >= 4 && role <= 6;
  const color = isOrg ? "#00a1d6" : "#ffc21f";
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const lines = (title || "").split(/[;；、]/).map((s) => s.trim()).filter(Boolean);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setAnchor({ x: r.left + r.width / 2, y: r.top });
  };

  return (
    <>
      <span ref={ref} className="absolute rounded-full cursor-help flex items-center justify-center"
        style={{ background: "#fff", boxShadow: "0 0 0 1.5px color-mix(in srgb, var(--bg) 90%, transparent)", right: inset, bottom: inset, width: BOLT, height: BOLT }}
        onMouseEnter={show} onMouseLeave={() => setAnchor(null)}>
        <svg width={17} height={17} viewBox="0 0 24 24" fill={color}><path d="M13 2 3 14h7l-1 8 11-12h-7l1-8z" /></svg>
      </span>
      {anchor && createPortal(
        <span className="fixed -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{
            left: anchor.x,
            top: anchor.y - 6,
            zIndex: 9999,
            background: "var(--surface)",
            border: `1px solid ${isOrg ? "#00a1d6" : "#ffc21f"}`,
            color: "var(--text)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11,
            lineHeight: 1.5,
            boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
            maxWidth: 260,
          }}>
          <span className="block font-semibold mb-0.5" style={{ color: isOrg ? "#00a1d6" : "#b8860b" }}>bilibili{isOrg ? "机构" : "个人"}认证：</span>
          {lines.map((l, i) => <span key={i} className="block">{l}</span>)}
        </span>,
        document.body,
      )}
    </>
  );
}

function SexIcon({ sex }: { sex: string }) {
  const isMale = sex === "男";
  const isFemale = sex === "女";
  if (!isMale && !isFemale) return null;
  const color = isMale ? "#00a1d6" : "#fb7299";
  return (
    <span className="inline-flex" title={sex}>
      {isMale ? (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
          <circle cx="10" cy="14" r="6" /><path d="M20 4 14 10" /><path d="M20 4h-5M20 4v5" />
        </svg>
      ) : (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="8" r="6" /><path d="M12 14v7M8 17h8" />
        </svg>
      )}
    </span>
  );
}

function VipLabel({ profile }: { profile: UserProfile }) {
  if (profile.vipLabelImg) {
    return <img src={profile.vipLabelImg} alt="" height={16} style={{ height: 16 }} draggable={false} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--accent)", color: "#fff" }}>
      {profile.vipLabel || "大会员"}
    </span>
  );
}

function FansMedal({ profile }: { profile: UserProfile }) {
  const m = profile.fansMedal!;
  const start = m.colorStart ?? "var(--accent)";
  const end = m.colorEnd ?? start;
  const border = m.colorBorder ?? start;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-sm mt-0.5"
      style={{ background: `linear-gradient(90deg, ${start}, ${end})`, color: "#fff", border: `1px solid ${border}` }}>
      {m.name} {m.level}
    </span>
  );
}

function DecorationCard({ decoration, visible }: { decoration: DynamicDecoration | null | undefined; visible: boolean }) {
  if (!visible || !decoration) return null;
  return (
    <button className="flex flex-none flex-col items-end cursor-pointer ml-1" title="动态装扮编号"
      onClick={() => decoration.jumpUrl && void openUrl(decoration.jumpUrl)}>
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
        {decoration.cardUrl && <img src={decoration.cardUrl} alt="" width={16} height={16} className="rounded object-cover" draggable={false} referrerPolicy="no-referrer" />}
        <div className="text-right leading-tight">
          <div className="text-[10px]" style={{ color: "var(--text)" }}>{decoration.name ?? "装扮"}</div>
          {decoration.fanNumberText && <div className="text-[9px]" style={{ color: decoration.color ?? "var(--text-3)" }}>{decoration.fanNumberText}</div>}
        </div>
      </div>
    </button>
  );
}
