import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import {
  Clock,
  Coin,
  Comment,
  Danmaku,
  Eye,
  ListSort,
  Play,
  RefreshCw,
  SortAsc,
  SortDesc,
  ThumbUp,
} from "../../components/ui/Icons";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "pubdate", label: "发布时间" },
  { value: "view", label: "播放量" },
  { value: "like", label: "点赞量" },
  { value: "coin", label: "投币量" },
  { value: "danmaku", label: "弹幕量" },
  { value: "reply", label: "评论量" },
  { value: "online", label: "在线人数" },
];

/* ------------------------------------------------------------------ *
 * Continuous compression
 *
 * The row never makes a structural jump while there is still room. As it gets
 * narrower every dimension is interpolated — first the gaps between metrics,
 * then the padding, then the cover — so the fields simply move closer together.
 * Only when the metrics' real minimum widths genuinely cannot fit does a single
 * field fold into its stacked (icon over value) form.
 * ------------------------------------------------------------------ */

/** Container width at which the row is at its tightest / roomiest. */
const TIGHT_W = 300;
const ROOMY_W = 520;

/** Never let two metrics touch, and never spend more than this between them. */
const GAP_MIN = 5;
const GAP_MAX = 10;
const COL_GAP_MIN = 4;
const COL_GAP_MAX = 8;
const PAD_MIN = 4;
const PAD_MAX = 6;
const COVER_MIN = 68;
const COVER_MAX = 92;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function rowMetrics(width: number) {
  const t = clamp01((width - TIGHT_W) / (ROOMY_W - TIGHT_W));
  const coverW = Math.round(lerp(COVER_MIN, COVER_MAX, t));
  return {
    padding: Math.round(lerp(PAD_MIN, PAD_MAX, t) * 10) / 10,
    gap: Math.round(lerp(GAP_MIN, GAP_MAX, t) * 10) / 10,
    colGap: Math.round(lerp(COL_GAP_MIN, COL_GAP_MAX, t) * 10) / 10,
    sepGap: Math.round(lerp(4, 6, t) * 10) / 10,
    coverW,
    coverH: Math.round((coverW * 9) / 16),
    iconSize: Math.round(lerp(10, 11, t)),
  };
}

/** Live width of the scrolling list, which is what a row actually gets. */
function useContainerWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const decide = (w: number) => w > 0 && setWidth(w);
    decide(el.clientWidth - 12); // minus the list's own padding
    const ro = new ResizeObserver((entries) => decide(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

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
  const fieldOrder = useSettingsStore((s) => s.global.videoFieldOrder);
  const pinnedRight = useSettingsStore((s) => s.global.videoPinnedRight);

  const setRefreshing = useUIStore((s) => s.setRefreshing);
  const qc = useQueryClient();
  const [sortOpen, setSortOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(listRef);
  const metrics = useMemo(() => rowMetrics(width || ROOMY_W), [width]);

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
        case "coin": va = a.coin ?? -1; vb = b.coin ?? -1; break;
        case "danmaku": va = a.danmaku ?? -1; vb = b.danmaku ?? -1; break;
        case "reply": va = a.reply ?? -1; vb = b.reply ?? -1; break;
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
            <VideoRow key={v.bvid} v={v} metrics={metrics}
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
    case "danmaku": return fields.videoDanmaku;
    case "reply": return fields.videoReply;
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

type Metrics = ReturnType<typeof rowMetrics>;

/** Natural width of a `nowrap` label, independent of how it is constrained. */
function contentWidth(el: HTMLElement | null): number {
  if (!el) return 0;
  return Math.max(el.scrollWidth, el.offsetWidth);
}

function VideoRow({ v, metrics, statsColumns, trailing, growth, sortField, highlightField, period }: {
  v: VideoItem;
  metrics: Metrics;
  statsColumns: VideoFieldKey[];
  trailing: VideoFieldKey | null;
  growth: VideoGrowth;
  sortField: SortField;
  highlightField: HighlightField;
  period: "day" | "week" | "month";
}) {
  /* Stacked is a measured fallback, not a breakpoint: this row only folds a
     field once its own metrics genuinely no longer fit side by side.
     The requirement is computed from the icon and the text widths — never from
     the row's current layout — so the two states cannot chase each other. */
  const statsRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const cols = Array.from(el.children) as HTMLElement[];
    if (cols.length === 0) return;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    // `el` is the flex-1 lane, so its clientWidth is already the space left
    // over once the trailing slot has taken its share.
    const available = el.clientWidth;
    if (available <= 0) return;

    let required = gap * (cols.length - 1);
    for (const col of cols) {
      const icon = col.querySelector<HTMLElement>(".data-col-icon");
      const text = col.querySelector<HTMLElement>(".data-col-text");
      required += (icon?.offsetWidth ?? 0) + 3 + contentWidth(text);
    }
    const next = required > available + 1;
    if (next !== stacked) setStacked(next);
  });

  const renderCell = (k: VideoFieldKey, key: string) => {
    const color = fieldColor(k, sortField, highlightField);
    const i = metrics.iconSize;
    switch (k) {
      case "view":
        return <DataColumn key={key} stacked={stacked} icon={<Play size={i} />}
          text={v.view == null ? "" : formatCount(v.view)} color={color} growth={growth.view[period]} />;
      case "like":
        return <DataColumn key={key} stacked={stacked} icon={<ThumbUp size={i} />}
          text={v.like == null ? "" : formatCount(v.like)} color={color} growth={growth.like[period]} />;
      case "coin":
        return <DataColumn key={key} stacked={stacked} icon={<Coin size={i} />}
          text={v.coin == null ? "" : formatCount(v.coin)} color={color} growth={growth.coin[period]} />;
      case "danmaku":
        return <DataColumn key={key} stacked={stacked} icon={<Danmaku size={i} />}
          text={v.danmaku == null ? "" : formatCount(v.danmaku)} color={color} growth={growth.danmaku[period]} />;
      case "reply":
        return <DataColumn key={key} stacked={stacked} icon={<Comment size={i} />}
          text={v.reply == null ? "" : formatCount(v.reply)} color={color} growth={growth.reply[period]} />;
      case "online":
        return <DataColumn key={key} stacked={stacked} icon={<Eye size={i} />}
          text={v.online ? v.online.displayText : ""} color={color} growth={null} />;
      default:
        // 投稿时间 carries no growth pill — it is not a counter.
        return <DataColumn key={key} stacked={stacked} icon={<Clock size={i} />}
          text={`${formatAgo(v.pubdate)}前`} color={color} growth={null} />;
    }
  };

  return (
    <div
      className="flex rounded-lg cursor-pointer transition-colors"
      style={{ gap: metrics.gap, padding: metrics.padding, alignItems: "flex-start" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      onClick={() => void openUrl(videoUrl(v.bvid))}
      title="点击打开视频"
    >
      <img
        src={coverUrl(v.cover, "16:9")}
        alt=""
        className="rounded-md object-cover flex-none self-start"
        style={{ width: metrics.coverW, height: metrics.coverH, background: "var(--surface-2)", flexShrink: 0 }}
        draggable={false}
        referrerPolicy="no-referrer"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {v.title}
        </div>
        {/* The metrics share the whole line between the first field and the
            trailing slot, so they spread out instead of bunching on the left. */}
        <div className="flex items-start" style={{ gap: metrics.sepGap, marginTop: 4 }}>
          {statsColumns.length > 0 && (
            <div
              ref={statsRef}
              className="flex items-start flex-1 min-w-0"
              style={{ gap: metrics.colGap }}
            >
              {statsColumns.map((k) => renderCell(k, k))}
            </div>
          )}
          <div className="video-trailing flex-none" style={{ minWidth: 0 }}>
            {trailing ? renderCell(trailing, "trailing") : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One metric: icon + value on top, growth pill centered underneath.
 *
 * The lane is `flex: 1 1 auto` with `min-width: max-content` — it takes an equal
 * share of the free width so the row spreads evenly, but it is always at least
 * as wide as its own formatted text, so 9 / 999 / 1.2万 / 9999万 are measured by
 * CSS rather than guessed. Nothing is ever ellipsised.
 */
function DataColumn({ stacked, icon, text, color, growth }: {
  stacked: boolean;
  icon: React.ReactNode;
  text: string;
  color?: string;
  growth: number | null;
}) {
  return (
    <span className="data-col" style={{ color: color ?? "var(--text-2)" }}>
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
