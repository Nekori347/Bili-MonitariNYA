import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useVideos, type VideoItem } from "../../queries/videos";
import { useUIStore, type SortField } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useSubscriptions } from "../../queries/subscriptions";
import { markSeen } from "../../services/database/subscriptions";
import type { FieldVisibility } from "../../types/settings";
import { videoUrl } from "../../services/bilibili/endpoints";
import { formatAgo, formatCount } from "../../utils/format";
import { useGrowthMap, type VideoGrowth } from "./useGrowthMap";
import { Clock, Coin, Eye, ListSort, Play, RefreshCw, SortAsc, SortDesc, ThumbUp } from "../../components/ui/Icons";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "pubdate", label: "发布时间" },
  { value: "view", label: "播放量" },
  { value: "like", label: "点赞量" },
  { value: "online", label: "在线人数" },
];

function onlineValue(v: VideoItem): number {
  if (v.online?.exactCount != null) return v.online.exactCount;
  if (v.online?.displayText) {
    const m = v.online.displayText.match(/([\d.]+)\s*(万|亿)?/);
    if (m) {
      const base = parseFloat(m[1]);
      if (m[2] === "亿") return base * 100_000_000;
      if (m[2] === "万") return base * 10_000;
      return base;
    }
  }
  return -1;
}

export function VideoList({ mid }: { mid: number }) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const sortField = useUIStore((s) => s.sortField);
  const sortDirection = useUIStore((s) => s.sortDirection);
  const setSort = useUIStore((s) => s.setSort);
  const toggleSortDirection = useUIStore((s) => s.toggleSortDirection);
  const globalFields = useSettingsStore((s) => s.global.fields);
  const perUserFields = useSettingsStore((s) => s.perUser[mid]?.fields);
  const fields = useMemo(() => ({ ...globalFields, ...(perUserFields ?? {}) }), [globalFields, perUserFields]);
  const limit = useSettingsStore((s) => s.effectiveVideoLimit(mid));
  const highlightField = useSettingsStore((s) => s.global.highlightField);
  const growthPeriod = useSettingsStore((s) => s.global.growthPeriod);

  const qc = useQueryClient();
  const setRefreshing = useUIStore((s) => s.setRefreshing);
  const [sortOpen, setSortOpen] = useState(false);

  const videos = useVideos(mid, limit, selectedMid === mid);
  const growthMap = useGrowthMap(videos ?? []);

  // Record the latest seen bvid (used for the "new post" pink dot elsewhere).
  const { data: subs } = useSubscriptions();
  const sub = subs?.find((s) => s.mid === mid);
  useEffect(() => {
    if (videos && videos.length > 0 && sub) {
      const latest = videos[0].bvid;
      if (sub.lastSeenLatestBvid !== latest) {
        void markSeen(mid, latest);
      }
    }
  }, [videos, sub, mid]);

  const latestPubdate = useMemo(() => {
    if (!videos || videos.length === 0) return null;
    return Math.max(...videos.map((v) => v.pubdate));
  }, [videos]);

  const sorted = useMemo(() => {
    if (!videos) return [];
    const arr = [...videos];
    const dir = sortDirection === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case "view": va = a.view ?? -1; vb = b.view ?? -1; break;
        case "like": va = a.like ?? -1; vb = b.like ?? -1; break;
        case "online": va = onlineValue(a); vb = onlineValue(b); break;
        default: va = a.pubdate; vb = b.pubdate;
      }
      return (va - vb) * dir;
    });
    return arr;
  }, [videos, sortField, sortDirection]);

  const refresh = () => {
    setRefreshing(true);
    void qc.invalidateQueries({ queryKey: ["videos", mid] });
    void qc.invalidateQueries({ queryKey: ["videoDetail"] });
    void qc.invalidateQueries({ queryKey: ["online"] });
    setTimeout(() => setRefreshing(false), 900);
  };

  return (
    <section className="card flex flex-col min-h-0" style={{ borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
      {/* Compact toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b" style={{ borderColor: "var(--line)" }}>
        <span className="text-[11px]" style={{ color: "var(--text-2)" }}>
          最近投稿 <b style={{ color: "var(--text)" }}>{videos ? videos.length : 0}</b>
        </span>
        {latestPubdate != null && (
          <span className="mx-auto text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
            距上次投稿 {formatAgo(latestPubdate)}
          </span>
        )}
        <div className="flex items-center gap-0.5 no-drag relative">
          <button className="titlebar-btn" style={{ width: 24, height: 24 }} title="刷新" onClick={refresh}>
            <RefreshCw size={13} />
          </button>
          <button className="titlebar-btn" style={{ width: 24, height: 24 }} title="排序字段" onClick={() => setSortOpen((v) => !v)}>
            <ListSort size={14} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-7 z-20 card p-1 flex flex-col min-w-28 shadow-lg">
              {SORT_OPTIONS.map((o) => (
                <button key={o.value}
                  className="px-2.5 py-1.5 rounded-md text-left text-[12px] hover:bg-[var(--hover)]"
                  style={{ color: sortField === o.value ? "var(--accent)" : "var(--text)" }}
                  onClick={() => { setSort(o.value, sortDirection); setSortOpen(false); }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <button className="titlebar-btn" style={{ width: 24, height: 24 }} title={sortDirection === "desc" ? "倒序" : "正序"} onClick={toggleSortDirection}>
            {sortDirection === "desc" ? <SortDesc size={14} /> : <SortAsc size={14} />}
          </button>
        </div>
      </div>

      {!videos || videos.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>暂无投稿数据</div>
      ) : (
        <div className="flex flex-col p-1.5 gap-0.5 overflow-y-auto">
          {sorted.map((v) => (
            <VideoRow key={v.bvid} v={v} fields={fields} growth={growthMap[v.bvid]} sortField={sortField} highlightField={highlightField} period={growthPeriod} />
          ))}
        </div>
      )}
    </section>
  );
}

function VideoRow({ v, fields, growth, sortField, highlightField, period }: {
  v: VideoItem;
  fields: FieldVisibility;
  growth: VideoGrowth | undefined;
  sortField: SortField;
  highlightField: string;
  period: "day" | "week" | "month";
}) {
  const g = growth ?? { view: { day: null, week: null, month: null }, like: { day: null, week: null, month: null }, coin: { day: null, week: null, month: null } };
  const cellColor = (key: string): string | undefined => {
    if (sortField === key) return "#fb7299";
    if (highlightField === key) return "#00aeec";
    return undefined;
  };

  return (
    <div
      className="flex gap-2.5 p-1.5 rounded-lg cursor-pointer transition-colors"
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      onClick={() => void openUrl(videoUrl(v.bvid))}
      title="点击打开视频"
    >
      <img src={v.cover} alt="" width={92} height={52}
        className="rounded-md object-cover flex-none self-start"
        style={{ width: 92, height: 52, background: "var(--surface-2)" }}
        draggable={false} referrerPolicy="no-referrer" />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {v.title}
        </div>
        <div className="grid items-center gap-x-3 gap-y-0.5 mt-1" style={{ gridTemplateColumns: "auto auto auto auto auto", justifyContent: "start" }}>
          {/* row 1: play / like / coin / online / time (time rightmost) */}
          {fields.videoView && <Cell icon={<Play size={11} />} text={v.view == null ? "…" : formatCount(v.view)} color={cellColor("view")} />}
          {fields.videoLike && <Cell icon={<ThumbUp size={11} />} text={v.like == null ? "…" : formatCount(v.like)} color={cellColor("like")} />}
          {fields.videoCoin && <Cell icon={<Coin size={11} />} text={v.coin == null ? "…" : formatCount(v.coin)} color={cellColor("coin")} />}
          {fields.videoOnline && <Cell icon={<Eye size={11} />} text={v.online ? v.online.displayText : v.onlineError ? "失败" : "…"} color={cellColor("online")} />}
          <Cell icon={<Clock size={11} />} text={formatAgo(v.pubdate) + "前"} color={cellColor("pubdate")} />
          {/* row 2: growth deltas aligned under each data col */}
          {fields.videoView && <Delta v={g.view[period]} />}
          {fields.videoLike && <Delta v={g.like[period]} />}
          {fields.videoCoin && <Delta v={g.coin[period]} />}
          {fields.videoOnline && <span />}
          <span />
        </div>
      </div>
    </div>
  );
}

function Cell({ icon, text, color, style }: { icon: React.ReactNode; text: string; color?: string; style?: React.CSSProperties }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] whitespace-nowrap" style={{ color: color ?? "var(--text-2)", ...style }} title={text}>
      {icon}{text}
    </span>
  );
}

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span />;
  const color = v > 0 ? "#22a06b" : v < 0 ? "#e5484d" : "var(--text-3)";
  return (
    <span className="inline-flex text-[10px] font-medium px-1 rounded" style={{ color, background: "color-mix(in srgb, " + color + " 12%, transparent)", width: "fit-content" }}>
      {v >= 0 ? "+" : ""}{formatCount(v)}
    </span>
  );
}
