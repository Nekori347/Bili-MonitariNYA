import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useVideos, type VideoItem } from "../../queries/videos";
import { useUIStore, type SortField } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useSubscriptions } from "../../queries/subscriptions";
import { markSeen } from "../../services/database/subscriptions";
import type { FieldVisibility, HighlightField, VideoFieldKey } from "../../types/settings";
import { coverUrl, videoUrl } from "../../services/bilibili/endpoints";
import { formatAgo, formatAgoSpaced, formatCount } from "../../utils/format";
import { growthFor, useGrowthMap, type VideoGrowth } from "./useGrowthMap";
import { Clock, Coin, Eye, ListSort, Play, RefreshCw, SortAsc, SortDesc, ThumbUp } from "../../components/ui/Icons";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "pubdate", label: "发布时间" },
  { value: "view", label: "播放量" },
  { value: "like", label: "点赞量" },
  { value: "online", label: "在线人数" },
];

/**
 * Minimum lane width per metric. A column is a `min-width` box, not a fixed
 * one: ordinary values keep their lane (so digits never shove a neighbour
 * around), while an unusually long value widens its own lane instead of being
 * clipped. Nothing in a video row is ever cut off.
 */
const WIDE_MIN: Record<VideoFieldKey, number> = {
  view: 58,
  like: 58,
  coin: 54,
  online: 58,
  pubdate: 66,
};

const COMPACT_MIN: Record<VideoFieldKey, number> = {
  view: 50,
  like: 50,
  coin: 46,
  online: 50,
  pubdate: 58,
};

/**
 * Presentation tiers, chosen from the row's real available width.
 *
 *   wide    — icon + value inline, full-size cover
 *   compact — icon + value inline, tighter gaps and a smaller cover
 *   narrow  — icon above value, equal flexible columns
 *
 * Icons survive every tier; only the arrangement changes.
 */
type RowMode = "wide" | "compact" | "narrow";

/** Values below are the smallest widths at which each tier still fits. */
const WIDE_AT = 452;
const COMPACT_AT = 364;

const ROW_STYLE: Record<RowMode, { padding: number; gap: number; coverW: number; coverH: number; ratio: "16:9" | "4:3"; colGap: number; sepGap: number }> = {
  wide: { padding: 6, gap: 10, coverW: 92, coverH: 52, ratio: "16:9", colGap: 8, sepGap: 6 },
  compact: { padding: 5, gap: 8, coverW: 64, coverH: 38, ratio: "16:9", colGap: 4, sepGap: 6 },
  narrow: { padding: 5, gap: 8, coverW: 44, coverH: 33, ratio: "4:3", colGap: 4, sepGap: 4 },
};

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

/** Pick the presentation tier from the measured width of the list viewport. */
function useRowMode(ref: React.RefObject<HTMLElement | null>): RowMode {
  const [mode, setMode] = useState<RowMode>("wide");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const decide = (w: number) => {
      if (w <= 0) return;
      setMode(w >= WIDE_AT ? "wide" : w >= COMPACT_AT ? "compact" : "narrow");
    };
    // contentRect excludes padding, so it matches the row's own width exactly.
    decide(el.clientWidth - 12);
    const ro = new ResizeObserver((entries) => decide(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return mode;
}

function minWidthFor(k: VideoFieldKey, mode: RowMode): number | undefined {
  if (mode === "narrow") return undefined; // equal flex columns instead
  return (mode === "wide" ? WIDE_MIN : COMPACT_MIN)[k];
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
  const fieldOrder = useSettingsStore((s) => s.global.videoFieldOrder);
  const pinnedRight = useSettingsStore((s) => s.global.videoPinnedRight);

  const setRefreshing = useUIStore((s) => s.setRefreshing);
  const qc = useQueryClient();
  const [sortOpen, setSortOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const mode = useRowMode(listRef);

  const videos = useVideos(mid, limit, selectedMid === mid);
  const growthMap = useGrowthMap(mid, videos ?? []);

  // The stats line keeps only the fields that flow; 固定到最右 gets its own slot.
  const statsColumns = useMemo(() => {
    const visible = fieldOrder.filter((k) => (k === "pubdate" ? true : isVideoFieldVisible(k, fields)));
    return visible.filter((k) => k !== pinnedRight);
  }, [fieldOrder, pinnedRight, fields]);

  // A pinned field that the user has hidden simply is not rendered anywhere.
  const trailing = pinnedRight === "pubdate" || isVideoFieldVisible(pinnedRight, fields) ? pinnedRight : null;

  const { data: subs } = useSubscriptions();
  const sub = subs?.find((s) => s.mid === mid);
  useEffect(() => {
    if (videos && videos.length > 0 && sub) {
      const latest = videos[0].bvid;
      if (sub.lastSeenLatestBvid !== latest) void markSeen(mid, latest);
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

  /**
   * The only place besides 设置 → 刷新全部数据 that raises the progress line.
   * Background polling never touches `refreshing`.
   */
  const refresh = () => {
    setRefreshing(true);
    void Promise.all([
      qc.invalidateQueries({ queryKey: ["videos", mid] }),
      qc.invalidateQueries({ queryKey: ["videoDetail"] }),
      qc.invalidateQueries({ queryKey: ["online"] }),
    ]);
  };

  return (
    <section className="card flex flex-col min-h-0 overflow-hidden" style={{ borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
      <div className="flex items-center gap-2 px-3 py-1 border-b" style={{ borderColor: "var(--line)" }}>
        <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--text-2)" }}>
          最近投稿 <b style={{ color: "var(--text)" }}>{videos ? videos.length : 0}</b>
        </span>
        {latestPubdate != null && (
          <span className="mx-auto text-[11.5px] font-semibold truncate" style={{ color: "var(--accent)" }}>
            距离上次更新已过去 {formatAgoSpaced(latestPubdate)}
          </span>
        )}
        <div className="flex items-center gap-0.5 no-drag relative flex-none">
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

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5 flex flex-col gap-0.5">
        {!videos || videos.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>暂无投稿数据</div>
        ) : (
          sorted.map((v) => (
            <VideoRow key={v.bvid} v={v} mode={mode}
              statsColumns={statsColumns} trailing={trailing}
              growth={growthFor(growthMap, v.bvid)}
              sortField={sortField} highlightField={highlightField} period={growthPeriod} />
          ))
        )}
      </div>
    </section>
  );
}

function isVideoFieldVisible(k: VideoFieldKey, fields: FieldVisibility): boolean {
  switch (k) {
    case "view": return fields.videoView;
    case "like": return fields.videoLike;
    case "coin": return fields.videoCoin;
    case "online": return fields.videoOnline;
    default: return true;
  }
}

/** Pink marks the active sort field; blue marks the user's fixed highlight. */
function fieldColor(k: VideoFieldKey, sortField: SortField, highlightField: HighlightField): string | undefined {
  if (sortField === k) return "#fb7299";
  if (highlightField === k) return "#00aeec";
  return undefined;
}

function VideoRow({ v, mode, statsColumns, trailing, growth, sortField, highlightField, period }: {
  v: VideoItem;
  mode: RowMode;
  statsColumns: VideoFieldKey[];
  trailing: VideoFieldKey | null;
  growth: VideoGrowth;
  sortField: SortField;
  highlightField: HighlightField;
  period: "day" | "week" | "month";
}) {
  const style = ROW_STYLE[mode];
  const iconSize = mode === "narrow" ? 10 : 11;

  const renderCell = (k: VideoFieldKey, key: string) => {
    const color = fieldColor(k, sortField, highlightField);
    const width = minWidthFor(k, mode);
    switch (k) {
      case "view":
        return <DataColumn key={key} mode={mode} minWidth={width} icon={<Play size={iconSize} />}
          text={v.view == null ? "" : formatCount(v.view)} color={color} growth={growth.view[period]} />;
      case "like":
        return <DataColumn key={key} mode={mode} minWidth={width} icon={<ThumbUp size={iconSize} />}
          text={v.like == null ? "" : formatCount(v.like)} color={color} growth={growth.like[period]} />;
      case "coin":
        return <DataColumn key={key} mode={mode} minWidth={width} icon={<Coin size={iconSize} />}
          text={v.coin == null ? "" : formatCount(v.coin)} color={color} growth={growth.coin[period]} />;
      case "online":
        return <DataColumn key={key} mode={mode} minWidth={width} icon={<Eye size={iconSize} />}
          text={v.online ? v.online.displayText : ""} color={color} growth={null} />;
      default:
        // 投稿时间 carries no growth pill — it is not a counter.
        return <DataColumn key={key} mode={mode} minWidth={width} icon={<Clock size={iconSize} />}
          text={`${formatAgo(v.pubdate)}前`} color={color} growth={null} />;
    }
  };

  return (
    <div
      className="flex rounded-lg cursor-pointer transition-colors"
      style={{ gap: style.gap, padding: style.padding, alignItems: "flex-start" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      onClick={() => void openUrl(videoUrl(v.bvid))}
      title="点击打开视频"
    >
      <img
        src={coverUrl(v.cover, style.ratio)}
        alt=""
        className="rounded-md object-cover flex-none self-start"
        style={{ width: style.coverW, height: style.coverH, background: "var(--surface-2)", flexShrink: 0 }}
        draggable={false}
        referrerPolicy="no-referrer"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {v.title}
        </div>
        {/* Stats flow on the left; 固定到最右 owns the row's trailing edge. */}
        <div className="flex items-start" style={{ gap: style.sepGap, marginTop: 4 }}>
          {statsColumns.length > 0 && (
            <div
              className={`flex items-start${mode === "narrow" ? " is-narrow" : ""}`}
              style={{ gap: style.colGap, minWidth: 0 }}
            >
              {statsColumns.map((k) => renderCell(k, k))}
            </div>
          )}
          <span className="flex-1" />
          {trailing && <div className="video-trailing">{renderCell(trailing, "trailing")}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * One metric: icon + value on top, growth pill centered underneath. The pill is
 * its own child of the column, so it always lines up with the number above it.
 */
function DataColumn({ mode, minWidth, icon, text, color, growth }: {
  mode: RowMode;
  minWidth?: number;
  icon: React.ReactNode;
  text: string;
  color?: string;
  growth: number | null;
}) {
  const stacked = mode === "narrow";
  return (
    <span className="data-col" style={{ minWidth, color: color ?? "var(--text-2)" }}>
      <span className={`data-col-value${stacked ? " stacked" : ""}`} title={text || undefined}>
        <span className="data-col-icon">{icon}</span>
        <span className="data-col-text">{text}</span>
      </span>
      <span className="data-col-growth">
        {growth != null && <GrowthPill v={growth} />}
      </span>
    </span>
  );
}

function GrowthPill({ v }: { v: number }) {
  const color = v > 0 ? "#22a06b" : v < 0 ? "#e5484d" : "var(--text-3)";
  return (
    <span className="growth-pill" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {v > 0 ? "+" : ""}{formatCount(v)}
    </span>
  );
}
