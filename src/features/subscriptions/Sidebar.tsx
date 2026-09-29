import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRemoveSubscription, useUpdateSubscription } from "../../queries/subscriptions";
import type { Subscription } from "../../services/database/subscriptions";
import { useFaces } from "../../queries/brief";
import { Avatar } from "./Avatar";
import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { spaceUrl } from "../../services/bilibili/endpoints";
import { ChevronLeft, ChevronRight, ExternalLink, Gear, Plus, Trash, XIcon } from "../../components/ui/Icons";

const MIN_W = 140;
const MAX_W = 260;
export const MINI_W = 40;

interface Props {
  subs: Subscription[];
  loading: boolean;
  collapsed: boolean;
}

/**
 * Left column: subscription list (expanded) or avatar strip (collapsed),
 * always followed by the drag/toggle Rail that sits on the boundary.
 */
export function Sidebar({ subs, loading, collapsed }: Props) {
  const faces = useFaces(subs);
  const sidebarWidth = useSettingsStore((s) => s.global.sidebarWidth);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [dragging, setDragging] = useState(false);

  const startDrag = (e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      updateGlobal({ sidebarWidth: Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX)) });
    };
    const onUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex flex-none min-h-0">
      {collapsed ? (
        <MiniList subs={subs} faces={faces} />
      ) : (
        <FullList subs={subs} loading={loading} faces={faces} width={sidebarWidth} />
      )}

      <div
        className={`side-rail${collapsed ? " is-collapsed" : ""}${dragging ? " dragging" : ""}`}
        onMouseDown={startDrag}
      >
        <span className="side-rail-line" />
        <button
          className="side-rail-btn"
          title={collapsed ? "展开侧栏" : "折叠侧栏"}
          onClick={toggleSidebar}
        >
          {collapsed ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Collapsed: avatar strip only (avatar + refresh state + new-post dot)
 * ------------------------------------------------------------------ */

function MiniList({ subs, faces }: { subs: Subscription[]; faces: Record<number, string> }) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);

  return (
    <div className="mini-side" style={{ width: MINI_W }}>
      <div className="mini-list">
        {subs.map((sub) => (
          <div key={sub.mid} className="mini-item">
            <button
              className="mini-btn"
              style={selectedMid === sub.mid ? { borderColor: "var(--accent)" } : undefined}
              onClick={() => setSelectedMid(sub.mid)}
            >
              <Avatar mid={sub.mid} face={faces[sub.mid]} name={sub.name} size={24} />
              <span
                className="mini-dot-refresh"
                style={{ background: sub.enabled ? "#22a06b" : "var(--text-3)" }}
              />
              {sub.hasUnreadUpdate && <span className="mini-dot-new" />}
            </button>

            {/* App-rendered tooltip (no HTML title attribute) */}
            <div className="mini-tip" role="tooltip">
              {sub.remark ? (
                <>
                  <div className="mini-tip-1">{sub.remark}</div>
                  <div className="mini-tip-2">{sub.name}</div>
                </>
              ) : (
                <div className="mini-tip-1">{sub.name || `UID ${sub.mid}`}</div>
              )}
              <div className="mini-tip-3">UID {sub.mid}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Expanded: full subscription rows (unchanged behaviour)
 * ------------------------------------------------------------------ */

function FullList({
  subs,
  loading,
  faces,
  width,
}: {
  subs: Subscription[];
  loading: boolean;
  faces: Record<number, string>;
  width: number;
}) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);
  const setAddOpen = useUIStore((s) => s.setAddOpen);
  const openUserSettings = useUIStore((s) => s.openUserSettings);
  const updateSub = useUpdateSubscription();
  const removeSub = useRemoveSubscription();
  const qc = useQueryClient();

  const [deleteMode, setDeleteMode] = useState(false);
  const [confirmMid, setConfirmMid] = useState<number | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());

  const exitDeleteMode = () => {
    setDeleteMode(false);
    setConfirmMid(null);
    setPending(new Set());
  };

  const saveDelete = () => {
    pending.forEach((mid) => removeSub.mutate(mid));
    exitDeleteMode();
  };

  const togglePending = (mid: number) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid);
      else next.add(mid);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmMid != null) setConfirmMid(null);
      else if (deleteMode) exitDeleteMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <aside className="flex-none flex flex-col min-h-0" style={{ width }}>
      <div className="flex items-center px-3 py-2">
        <span className="text-[12px] font-medium pl-1" style={{ color: "var(--text-2)" }}>订阅列表</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5" onClick={() => confirmMid != null && setConfirmMid(null)}>
        {loading && <div className="px-2 py-1 text-xs" style={{ color: "var(--text-3)" }}>加载中…</div>}
        {subs.map((sub) => {
          const confirming = confirmMid === sub.mid;
          const toDelete = pending.has(sub.mid);
          return (
            <div
              key={sub.mid}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ background: selectedMid === sub.mid ? "var(--accent-soft)" : "transparent", opacity: toDelete ? 0.45 : 1 }}
              onClick={() => {
                if (deleteMode) return;
                setSelectedMid(sub.mid);
              }}
              title={sub.name}>
              <span className="relative flex-none">
                <Avatar mid={sub.mid} face={faces[sub.mid]} name={sub.name} size={24} />
                {sub.hasUnreadUpdate && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "#fb7299", outline: "1.5px solid var(--bg)" }} />}
              </span>
              {sub.remark ? (
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block truncate text-[12px]" style={{ color: selectedMid === sub.mid ? "var(--accent)" : "var(--text)" }}>{sub.remark}</span>
                  <span className="block truncate text-[10px]" style={{ color: "var(--text-3)" }}>{sub.name}</span>
                </span>
              ) : (
                <span className="flex-1 truncate text-[12px]" style={{ color: selectedMid === sub.mid ? "var(--accent)" : "var(--text)" }}>
                  {sub.name || `UID ${sub.mid}`}
                </span>
              )}

              {deleteMode ? (
                <button
                  className={`delete-btn flex-none ${confirming ? "confirming" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirming) togglePending(sub.mid);
                    else setConfirmMid(sub.mid);
                  }}>
                  {confirming ? <span className="text-[11px] font-medium">确认</span> : <XIcon size={12} />}
                </button>
              ) : (
                <>
                  <button className="refresh-dot flex-none" style={{ color: sub.enabled ? "#22a06b" : "var(--text-3)" }}
                    title={sub.enabled ? "自动刷新：开启" : "自动刷新：暂停"}
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !sub.enabled;
                      updateSub.mutate({ mid: sub.mid, patch: { enabled: next } });
                      if (next) {
                        void qc.invalidateQueries({ queryKey: ["profile", sub.mid] });
                        void qc.invalidateQueries({ queryKey: ["stats", sub.mid] });
                        void qc.invalidateQueries({ queryKey: ["videos", sub.mid] });
                      }
                    }}>
                    <span className="dot" />
                  </button>
                  <div className="hidden group-hover:flex items-center gap-0.5 no-drag">
                    <button className="titlebar-btn" style={{ width: 22, height: 22 }} title="该 UP 主独立设置"
                      onClick={(e) => { e.stopPropagation(); setSelectedMid(sub.mid); openUserSettings(); }}>
                      <Gear size={12} />
                    </button>
                  </div>
                  <button className="titlebar-btn flex-none" style={{ width: 22, height: 22 }} title="打开主页"
                    onClick={(e) => { e.stopPropagation(); void openUrl(spaceUrl(sub.mid)); }}>
                    <ExternalLink size={12} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {deleteMode ? (
        <div className="flex gap-1.5 m-2">
          <button className="btn flex-1 justify-center text-xs" disabled={confirmMid == null} style={confirmMid == null ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            onClick={() => setConfirmMid(null)}>
            取消
          </button>
          {pending.size === 0 ? (
            <button className="btn flex-1 justify-center text-xs" onClick={exitDeleteMode}>退出</button>
          ) : (
            <button className="btn btn-primary flex-1 justify-center text-xs" onClick={saveDelete}>保存</button>
          )}
        </div>
      ) : (
        <div className="flex gap-1.5 m-2 items-stretch">
          <button className="btn justify-center text-xs flex-none px-2" title="删除订阅" onClick={() => setDeleteMode(true)}>
            <Trash size={13} />
          </button>
          <button className="btn flex-1 justify-center text-xs" onClick={() => setAddOpen(true)}>
            <Plus size={13} /> 添加订阅
          </button>
        </div>
      )}
    </aside>
  );
}
