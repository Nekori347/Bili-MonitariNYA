import { useState } from "react";
import type { FieldVisibility, VideoFieldKey } from "../../types/settings";
import { VIDEO_FIELD_LABELS } from "../../types/settings";
import { Clock, Coin, Comment, Danmaku, Eye, Grip, Play, ThumbUp } from "../../components/ui/Icons";

const VIS_KEY: Record<VideoFieldKey, keyof FieldVisibility> = {
  view: "videoView",
  like: "videoLike",
  coin: "videoCoin",
  danmaku: "videoDanmaku",
  reply: "videoReply",
  online: "videoOnline",
  pubdate: "videoView", // 投稿时间 is always shown
};

const SAMPLE: Record<VideoFieldKey, string> = {
  view: "1.2万",
  like: "890",
  coin: "233",
  danmaku: "156",
  reply: "42",
  online: "75",
  pubdate: "3天前",
};

const SAMPLE_GROWTH: Partial<Record<VideoFieldKey, string>> = {
  view: "+320",
  like: "+18",
  coin: "+4",
  danmaku: "+9",
  reply: "+2",
};

const ICON: Record<VideoFieldKey, React.ReactNode> = {
  view: <Play size={11} />,
  like: <ThumbUp size={11} />,
  coin: <Coin size={11} />,
  danmaku: <Danmaku size={11} />,
  reply: <Comment size={11} />,
  online: <Eye size={11} />,
  pubdate: <Clock size={11} />,
};

/**
 * Video settings preview. It mirrors the real row: the visible metrics flow on
 * the left and the field pinned to the far right owns its own trailing slot, so
 * the checkbox list below is the only thing that decides what sits at the edge.
 */
export function VideoPreview({
  fields,
  onToggle,
  order,
  onOrder,
  pinnedRight,
  onPinnedRight,
}: {
  fields: FieldVisibility;
  onToggle: (k: keyof FieldVisibility, v: boolean) => void;
  order: VideoFieldKey[];
  onOrder: (next: VideoFieldKey[]) => void;
  pinnedRight: VideoFieldKey;
  onPinnedRight: (k: VideoFieldKey) => void;
}) {
  const [dragKey, setDragKey] = useState<VideoFieldKey | null>(null);

  const shown = order.filter((k) => k === "pubdate" || fields[VIS_KEY[k]]);
  const flow = shown.filter((k) => k !== pinnedRight);
  const trailing = shown.includes(pinnedRight) ? pinnedRight : null;

  const toggle = (k: VideoFieldKey) => {
    if (k === "pubdate") return;
    const key = VIS_KEY[k];
    onToggle(key, !fields[key]);
  };

  const column = (k: VideoFieldKey) => {
    const on = k === "pubdate" ? true : fields[VIS_KEY[k]];
    return (
      <span
        key={k}
        className={`pz${on ? "" : " off"}`}
        title={`${VIDEO_FIELD_LABELS[k]}：点击${on ? "隐藏" : "显示"}`}
        onClick={() => toggle(k)}
      >
        <span className="data-col" style={{ width: 58 }}>
          <span className="data-col-value">
            <span className="data-col-icon">{ICON[k]}</span>
            <span className="data-col-text">{SAMPLE[k]}</span>
          </span>
          <span className="data-col-growth">
            {SAMPLE_GROWTH[k] && (
              <span className="growth-pill" style={{ color: "#22a06b", background: "color-mix(in srgb, #22a06b 12%, transparent)" }}>
                {SAMPLE_GROWTH[k]}
              </span>
            )}
          </span>
        </span>
        <span className="pz-tag">{on ? "✓" : "✕"} {VIDEO_FIELD_LABELS[k]}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* The row itself, laid out exactly like the real one. */}
      <div className="pz-scope flex gap-2.5 p-2 rounded-lg" style={{ border: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <span className="flex-none rounded-md" style={{ width: 72, height: 42, background: "linear-gradient(135deg,#8fa2c8,#c8d4ea)" }} />
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="block text-[12px] font-medium" style={{ color: "var(--text)" }}>示例投稿标题</span>
          <div className="flex items-start gap-1.5 mt-1">
            <div className="flex flex-wrap items-start gap-1 min-w-0">{flow.map((k) => column(k))}</div>
            <span className="flex-1" />
            {trailing && column(trailing)}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[12px] mb-1.5" style={{ color: "var(--text-2)" }}>字段顺序</div>
        <div className="flex flex-col gap-1">
          {order.map((k, i) => (
            <div
              key={k}
              draggable
              onDragStart={() => setDragKey(k)}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragKey || dragKey === k) return;
                const next = order.slice();
                next.splice(next.indexOf(dragKey), 1);
                next.splice(i, 0, dragKey);
                onOrder(next);
              }}
              onDragEnd={() => setDragKey(null)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing"
              style={{ border: "1px solid var(--line)", background: "var(--surface-2)", opacity: dragKey === k ? 0.5 : 1 }}
            >
              <Grip size={13} />
              <span className="flex-1 text-[12px]" style={{ color: "var(--text)" }}>{VIDEO_FIELD_LABELS[k]}</span>
              <label className="flex items-center gap-1 text-[11px]" style={{ color: pinnedRight === k ? "var(--accent)" : "var(--text-3)" }}>
                <input
                  type="checkbox"
                  checked={pinnedRight === k}
                  onChange={() => onPinnedRight(k)}
                  className="accent-[#fb7299]"
                />
                固定到最右
              </label>
            </div>
          ))}
        </div>
        <div className="text-[11px] mt-1.5" style={{ color: "var(--text-3)" }}>
          拖动可以调整字段的先后顺序；“固定到最右”的字段会单独贴在每条投稿的右边缘。
        </div>
      </div>
    </div>
  );
}
