import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useVideos, type VideoItem } from "../../queries/videos";
import { useUIStore, type SortField } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useSubscriptions } from "../../queries/subscriptions";
import { markSeen } from "../../services/database/subscriptions";
import type { FieldVisibility, VideoFieldKey } from "../../types/settings";
import { coverUrl, videoUrl } from "../../services/bilibili/endpoints";
import { formatAgo, formatAgoSpaced, formatCount } from "../../utils/format";
import { useGrowthMap, type VideoGrowth } from "./useGrowthMap";
import { Clock, Coin, Eye, ListSort, Play, RefreshCw, SortAsc, SortDesc, ThumbUp } from "../../components/ui/Icons";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "pubdate", label: "发布时间" },
  { value: "view", label: "播放量" },
  { value: "like", label: "点赞量" },
  { value: "online", label: "在线人数" },
];

/** Fixed column widths — digits must never push neighbouring columns around. */
const COL_W: Record<VideoFieldKey, { wide: number; narrow: number }> = {
  view: { wide: 46, narrow: 30 },
  like: { wide: 46, narrow: 30 },
  coin: { wide: 42, narrow: 26 },
  online: { wide: 46, narrow: 30 },
  pubdate: { wide: 52, narrow: 36 },
};

/** Column width below which the row switches to its compact presentation. */
const NARROW_AT = 380;

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

/** Tracks the rendered width so the row can compact itself when space is tight. */
function useNarrow(ref: React.RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setNarrow(w > 0 && w < NARROW_AT);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return narrow;
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

  const qc = useQueryClient();
  const setRefreshing = useUIStore((s) => s.setRefreshing);
  const [sortOpen, setSortOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(listRef);

  const videos = useVideos(mid, limit, selectedMid === mid);
  const growthMap = useGrowthMap(videos ?? []);

  // Column order: user order, with the pinned field forced to the far right.
  const columns = useMemo(() => {
    const visible = fieldOrder.filter((k) => (k === "pubdate" ? true : isVideoFieldVisible(k, fields)));
    const rest = visible.filter((k) => k !== pinnedRight);
    return visible.includes(pinnedRight) ? [...rest, pinnedRight] : rest;
  }, [fieldOrder, pinnedRight, fields]);

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

  const refresh = () => {
    setRefreshing(true);
    void qc.invalidateQueries({ queryKey: ["videos", mid] });
    void qc.invalidateQueries({ queryKey: ["videoDetail"] });
    void qc.invalidateQueries({ queryKey: ["online"] });
    setTimeout(() => setRefreshing(false), 1200);
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
            <VideoRow key={v.bvid} v={v} columns={columns} narrow={narrow}
              growth={growthMap[v.bvid]} sortField={sortField} highlightField={highlightField} period={growthPeriod} />
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

function VideoRow({ v, columns, narrow, growth, sortField, highlightField, period }: {
  v: VideoItem;
  columns: VideoFieldKey[];
  narrow: boolean;
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

  const gridTemplate = columns.map((k) => `${COL_W[k][narrow ? "narrow" : "wide"]}px`).join(" ");
  const gap = narrow ? 5 : 8;
  const iconSize = narrow ? 0 : 11;

  const cell = (k: VideoFieldKey) => {
    switch (k) {
      case "view":
        return <Cell key="view" icon={<Play size={iconSize} />} text={v.view == null ? "" : formatCount(v.view)} color={cellColor("view")} />;
      case "like":
        return <Cell key="like" icon={<ThumbUp size={iconSize} />} text={v.like == null ? "" : formatCount(v.like)} color={cellColor("like")} />;
      case "coin":
        return <Cell key="coin" icon={<Coin size={iconSize} />} text={v.coin == null ? "" : formatCount(v.coin)} color={cellColor("coin")} />;
      case "online":
        return <Cell key="online" icon={<Eye size={iconSize} />} text={v.online ? v.online.displayText : ""} color={cellColor("online")} />;
      default:
        return <Cell key="pubdate" icon={<Clock size={iconSize} />} text={`${formatAgo(v.pubdate)}前`} color={cellColor("pubdate")} />;
    }
  };

  const delta = (k: VideoFieldKey) => {
    if (k === "view") return <Delta key="dv" v={g.view[period]} />;
    if (k === "like") return <Delta key="dl" v={g.like[period]} />;
    if (k === "coin") return <Delta key="dc" v={g.coin[period]} />;
    return <span key={`d-${k}`} />;
  };

  return (
    <div
      className="flex rounded-lg cursor-pointer transition-colors"
      style={{ gap: narrow ? 8 : 10, padding: 6 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      onClick={() => void openUrl(videoUrl(v.bvid))}
      title="点击打开视频"
    >
      <img
        src={coverUrl(v.cover, narrow ? "4:3" : "16:9")}
        alt=""
        className="rounded-md object-cover flex-none self-start"
        style={narrow
          ? { width: 56, height: 42, background: "var(--surface-2)" }
          : { width: 92, height: 52, background: "var(--surface-2)" }}
        draggable={false}
        referrerPolicy="no-referrer"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {v.title}
        </div>
        {/* Fixed-width columns: values of any length stay in their own lane. */}
        <div className="grid items-center mt-1" style={{ gridTemplateColumns: gridTemplate, columnGap: gap, justifyContent: "start" }}>
          {columns.map(cell)}
          {columns.map(delta)}
        </div>
      </div>
    </div>
  );
}

function Cell({ icon, text, color }: { icon?: React.ReactNode; text: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-[3px] text-[11px] whitespace-nowrap overflow-hidden"
      style={{ color: color ?? "var(--text-2)" }} title={text || undefined}>
      {icon}{text}
    </span>
  );
}

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span />;
  const color = v > 0 ? "#22a06b" : v < 0 ? "#e5484d" : "var(--text-3)";
  return (
    <span className="inline-flex text-[10px] font-medium px-1 rounded whitespace-nowrap" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)`, width: "fit-content" }}>
      {v >= 0 ? "+" : ""}{formatCount(v)}
    </span>
  );
}
