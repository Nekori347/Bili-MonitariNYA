import { useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useVideos, type VideoItem } from "../../queries/videos";
import { useUIStore, type SortField } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { FieldVisibility } from "../../types/settings";
import { videoUrl } from "../../services/bilibili/endpoints";
import { formatCount, formatDate } from "../../utils/format";
import { useGrowthMap } from "./useGrowthMap";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "pubdate", label: "发布时间" },
  { value: "view", label: "播放量" },
  { value: "like", label: "点赞量" },
  { value: "online", label: "在线人数" },
];

function onlineValue(v: VideoItem): number {
  if (v.online?.exactCount != null) return v.online.exactCount;
  if (v.online?.displayText) {
    const s = v.online.displayText;
    const m = s.match(/([\d.]+)\s*(万|亿)?/);
    if (m) {
      const base = parseFloat(m[1]);
      if (m[2] === "亿") return base * 100_000_000;
      if (m[2] === "万") return base * 10_000;
      return base;
    }
  }
  return -1; // unknown -> sort last
}

export function VideoList({ mid }: { mid: number }) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const sortField = useUIStore((s) => s.sortField);
  const sortDirection = useUIStore((s) => s.sortDirection);
  const setSort = useUIStore((s) => s.setSort);
  const toggleSortDirection = useUIStore((s) => s.toggleSortDirection);
  const fields = useSettingsStore((s) => s.effectiveFields(mid));
  const limit = useSettingsStore((s) => s.effectiveVideoLimit(mid));

  const videos = useVideos(mid, limit, selectedMid === mid);
  const growthMap = useGrowthMap(videos ?? []);

  const sorted = useMemo(() => {
    if (!videos) return [];
    const arr = [...videos];
    const dir = sortDirection === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case "view":
          va = a.view ?? -1; vb = b.view ?? -1; break;
        case "like":
          va = a.like ?? -1; vb = b.like ?? -1; break;
        case "online":
          va = onlineValue(a); vb = onlineValue(b); break;
        default:
          va = a.pubdate; vb = b.pubdate;
      }
      return (va - vb) * dir;
    });
    return arr;
  }, [videos, sortField, sortDirection]);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
            最近投稿
          </span>
          {videos && (
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {videos.length} 条
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 no-drag">
          <select
            value={sortField}
            onChange={(e) => setSort(e.target.value as SortField, sortDirection)}
            className="text-xs"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="btn text-xs" onClick={toggleSortDirection}>
            {sortDirection === "desc" ? "倒序 ↓" : "正序 ↑"}
          </button>
        </div>
      </div>

      {!videos || videos.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>
          暂无投稿数据
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((v) => (
            <VideoRow key={v.bvid} v={v} fields={fields} growth={growthMap[v.bvid]} />
          ))}
        </div>
      )}
    </section>
  );
}

function VideoRow({
  v,
  fields,
  growth,
}: {
  v: VideoItem;
  fields: FieldVisibility;
  growth: { day: number | null; week: number | null; month: number | null };
}) {
  return (
    <div
      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
      style={{ border: "1px solid transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      onClick={() => void openUrl(videoUrl(v.bvid))}
      title="点击打开视频"
    >
      <img
        src={v.cover}
        alt={v.title}
        width={112}
        height={63}
        className="rounded-md object-cover flex-none"
        style={{ width: 112, height: 63, background: "var(--surface-2)" }}
        draggable={false}
        referrerPolicy="no-referrer"
      />
      <div className="flex-1 min-w-0">
        <div className="truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>
          {v.title}
        </div>
        <div className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
          {formatDate(v.pubdate)}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: "var(--text-2)" }}>
          {fields.videoView && <span title={v.view != null ? `${v.view}` : undefined}>▶ {v.view == null ? "…" : formatCount(v.view)}</span>}
          {fields.videoLike && <span title={v.like != null ? `${v.like}` : undefined}>👍 {v.like == null ? "…" : formatCount(v.like)}</span>}
          {fields.videoCoin && <span title={v.coin != null ? `${v.coin}` : undefined}>🪙 {v.coin == null ? "…" : formatCount(v.coin)}</span>}
          {fields.videoOnline && (
            <span style={{ color: "var(--accent)" }}>
              {v.online ? (
                `👁 ${v.online.displayText}`
              ) : v.onlineError ? (
                "👁 在线获取失败"
              ) : (
                "👁 在线获取中"
              )}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 items-end flex-none">
        {fields.growthDay && <GrowthPill delta={growth.day} label="今日" />}
        {fields.growthWeek && <GrowthPill delta={growth.week} label="本周" />}
        {fields.growthMonth && <GrowthPill delta={growth.month} label="本月" />}
      </div>
    </div>
  );
}

function GrowthPill({ delta, label }: { delta: number | null; label: string }) {
  if (delta == null) {
    return (
      <span className="pill" title="数据积累中">
        统计中 · {label}
      </span>
    );
  }
  const cls = delta > 0 ? "pos" : delta < 0 ? "neg" : "";
  return (
    <span className={`pill ${cls}`} title={`${label}增长 ${delta >= 0 ? "+" : ""}${delta}`}>
      {delta >= 0 ? "+" : ""}
      {formatCount(delta)} {label}
    </span>
  );
}
