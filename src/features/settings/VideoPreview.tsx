import { useState } from "react";
import type { FieldVisibility, VideoFieldKey } from "../../types/settings";
import { VIDEO_FIELD_LABELS } from "../../types/settings";
import { Grip } from "../../components/ui/Icons";

const VIS_KEY: Record<VideoFieldKey, keyof FieldVisibility> = {
  view: "videoView",
  like: "videoLike",
  coin: "videoCoin",
  online: "videoOnline",
  pubdate: "videoView", // 投稿时间 is always shown
};

/**
 * Video settings preview: click a metric cell to toggle it, drag the list to
 * choose the column order, and pick the one pinned to the far right.
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

  const value: Record<VideoFieldKey, string> = {
    view: "1.2万",
    like: "890",
    coin: "233",
    online: "75",
    pubdate: "3天前",
  };

  const toggle = (k: VideoFieldKey) => {
    if (k === "pubdate") return;
    const key = VIS_KEY[k];
    onToggle(key, !fields[key]);
  };

  const shown = order.filter((k) => k === "pubdate" || fields[VIS_KEY[k]]);

  return (
    <div className="flex flex-col gap-3">
      <div className="pz-scope flex gap-2.5 p-2 rounded-lg" style={{ border: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <span className="flex-none rounded-md" style={{ width: 68, height: 38, background: "linear-gradient(135deg,#8fa2c8,#c8d4ea)" }} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <span className="block text-[12px] font-medium" style={{ color: "var(--text)" }}>示例投稿标题</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {shown.map((k) => {
              const key = VIS_KEY[k];
              const on = k === "pubdate" ? true : fields[key];
              return (
                <span
                  key={k}
                  className={`pz${on ? "" : " off"}`}
                  title={`${VIDEO_FIELD_LABELS[k]}：点击${on ? "隐藏" : "显示"}`}
                  onClick={() => toggle(k)}
                >
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--text-2)" }}>
                    {VIDEO_FIELD_LABELS[k]} {value[k]}
                  </span>
                  <span className="pz-badge">{on ? "✓" : "✕"}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[12px] mb-1.5" style={{ color: "var(--text-2)" }}>字段顺序（拖动排序）</div>
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
          每列宽度固定，数字位数变化不会推动其它字段。
        </div>
      </div>
    </div>
  );
}
