import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useProfileCard } from "../../queries/profile";
import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { spaceUrl } from "../../services/bilibili/endpoints";
import { formatCount } from "../../utils/format";
import type { DynamicDecoration } from "../../services/bilibili/types";

export function ProfileCard({ mid }: { mid: number }) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const fields = useSettingsStore((s) => s.effectiveFields(mid));
  const { profile, stats, decoration, loading } = useProfileCard(mid, selectedMid === mid);

  if (loading && !profile) {
    return <div className="card h-44 animate-pulse" />;
  }

  if (!profile) {
    return (
      <section className="card p-6 text-sm" style={{ color: "var(--text-3)" }}>
        用户资料加载失败，请稍后重试或检查网络
      </section>
    );
  }

  const banner = profile?.topPhoto;
  const open = (url: string) => void openUrl(url);

  return (
    <section className="card overflow-hidden relative">
      {/* Banner */}
      {fields.banner && banner && (
        <div className="h-28 w-full relative" style={{ background: "var(--surface-2)" }}>
          <img src={banner} alt="" className="w-full h-full object-cover" draggable={false} referrerPolicy="no-referrer" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05), color-mix(in srgb, var(--bg) 85%, transparent))" }} />
        </div>
      )}
      {fields.banner && !banner && <div className="h-20 w-full" style={{ background: "var(--accent-soft)" }} />}

      <div className={`px-5 ${banner ? "-mt-8" : "pt-4"} pb-4 relative`}>
        <div className="flex items-end gap-4">
          {/* Avatar */}
          {fields.avatar && (
            <button
              className="relative flex-none cursor-pointer"
              onClick={() => profile && open(spaceUrl(profile.mid))}
              title="打开主页"
            >
              <img
                src={profile?.face}
                alt={profile?.name}
                width={72}
                height={72}
                className="rounded-full border-2 object-cover"
                style={{ borderColor: "var(--bg)", width: 72, height: 72, background: "var(--surface-2)" }}
                draggable={false}
                referrerPolicy="no-referrer"
              />
              {fields.pendant && profile?.pendantUrl && (
                <img src={profile.pendantUrl} alt="" className="absolute -bottom-1 -right-1 w-8 h-8 object-contain" draggable={false} referrerPolicy="no-referrer" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {fields.name && (
                <button
                  className="text-lg font-semibold truncate cursor-pointer hover:underline"
                  style={{ color: "var(--text)" }}
                  onClick={() => profile && open(spaceUrl(profile.mid))}
                  title={profile?.name}
                >
                  {profile?.name || `UID ${mid}`}
                </button>
              )}
              {fields.level && !!profile?.level && (
                <Badge>Lv{profile.level}</Badge>
              )}
              {fields.vip && profile?.isVip && (
                <Badge pink>{profile.vipLabel ?? "大会员"}</Badge>
              )}
              {fields.official && profile?.official && (
                <Badge gold title={profile.official.desc}>
                  {profile.official.title}
                </Badge>
              )}
              {fields.fansMedal && profile?.fansMedal && (
                <Badge>
                  粉丝牌 {profile.fansMedal.name} {profile.fansMedal.level}
                </Badge>
              )}
            </div>
            {fields.uid && (
              <button
                className="text-xs cursor-pointer"
                style={{ color: "var(--text-2)" }}
                onClick={() => profile && open(spaceUrl(profile.mid))}
              >
                UID {mid}
              </button>
            )}
          </div>

          <DecorationBadge decoration={decoration} visible={fields.decoration} />
        </div>

        {/* Sign */}
        {fields.sign && profile?.sign && (
          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "var(--text-2)" }}>
            {profile.sign.length > 80 ? profile.sign.slice(0, 80) + "…" : profile.sign}
          </p>
        )}

        {/* Stats */}
        <div className="flex gap-6 mt-3 flex-wrap">
          {fields.following && <Stat label="关注" value={stats?.following} />}
          {fields.follower && <Stat label="粉丝" value={stats?.follower} />}
          {fields.likes && <Stat label="获赞" value={stats?.likes} unavailable={stats?.likes == null} />}
          {fields.totalViews && <Stat label="播放" value={stats?.totalViews} unavailable={stats?.totalViews == null} />}
          {fields.videoCount && <Stat label="投稿" value={stats?.videoCount} unavailable={stats?.videoCount == null} />}
        </div>
      </div>
    </section>
  );
}

function Badge({ children, pink, gold, title }: { children: React.ReactNode; pink?: boolean; gold?: boolean; title?: string }) {
  return (
    <span
      className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md"
      title={title}
      style={{
        background: pink ? "var(--accent)" : gold ? "rgba(212,160,23,0.15)" : "var(--surface-2)",
        color: pink ? "#fff" : gold ? "#b7791f" : "var(--text-2)",
        border: "1px solid var(--line)",
      }}
    >
      {children}
    </span>
  );
}

function Stat({ label, value, unavailable }: { label: string; value: number | null | undefined; unavailable?: boolean }) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div
      className="cursor-default"
      onMouseEnter={() => setShowRaw(true)}
      onMouseLeave={() => setShowRaw(false)}
      title={value != null ? String(value) : undefined}
    >
      <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        {unavailable ? "—" : showRaw && value != null ? value.toLocaleString() : formatCount(value ?? 0)}
      </div>
      <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
    </div>
  );
}

function DecorationBadge({ decoration, visible }: { decoration: DynamicDecoration | null | undefined; visible: boolean }) {
  if (!visible || !decoration) return null;
  return (
    <button
      className="flex flex-col items-end flex-none cursor-pointer"
      title="动态装扮编号"
      onClick={() => decoration.jumpUrl && void openUrl(decoration.jumpUrl)}
    >
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
        {decoration.cardUrl && (
          <img src={decoration.cardUrl} alt="" width={18} height={18} className="rounded object-cover" draggable={false} referrerPolicy="no-referrer" />
        )}
        <div className="text-right leading-tight">
          <div className="text-[11px]" style={{ color: "var(--text)" }}>
            {decoration.name ?? "装扮"}
          </div>
          {decoration.fanNumberText && (
            <div className="text-[10px]" style={{ color: decoration.color ?? "var(--text-3)" }}>
              {decoration.fanNumberText}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
