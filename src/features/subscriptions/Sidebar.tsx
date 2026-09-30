import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRemoveSubscriptions, useUpdateSubscription } from "../../queries/subscriptions";
import { markUnread, saveSubscriptionOrder, type Subscription } from "../../services/database/subscriptions";
import { useFaces } from "../../queries/brief";
import { Avatar } from "./Avatar";
import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { spaceUrl } from "../../services/bilibili/endpoints";
import { ChevronLeft, ChevronRight, ExternalLink, Gear, Grip, Plus, Trash, XIcon } from "../../components/ui/Icons";

const MIN_W = 140;
const MAX_W = 260;
export const MINI_W = 40;

interface Props {
  subs: Subscription[];
  loading: boolean;
  collapsed: boolean;
  /** True when the window is too narrow to expand the sidebar at all. */
  locked: boolean;
}

/**
 * Left column: subscription list (expanded) or avatar strip (collapsed),
 * always followed by the drag/toggle Rail that sits on the boundary.
 */
export function Sidebar({ subs, loading, collapsed, locked }: Props) {
  const faces = useFaces(subs);
  const sidebarWidth = useSettingsStore((s) => s.global.sidebarWidth);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [dragging, setDragging] = useState(false);
  const newPostBadge = useSettingsStore((s) => s.global.newPostBadge);

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
        <MiniList subs={subs} faces={faces} showDot={newPostBadge} />
      ) : (
        <FullList subs={subs} loading={loading} faces={faces} width={sidebarWidth} showDot={newPostBadge} />
      )}

      <div
        className={`side-rail${collapsed ? " is-collapsed" : ""}${dragging ? " dragging" : ""}`}
        onMouseDown={startDrag}
      >
        <span className="side-rail-line" />
        <button
          className="side-rail-btn"
          disabled={locked}
          title={locked ? "窗口过窄，无法展开侧栏" : collapsed ? "展开侧栏" : "折叠侧栏"}
          style={locked ? { opacity: 0.25, cursor: "not-allowed" } : undefined}
          onClick={locked ? undefined : toggleSidebar}
        >
          {collapsed ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Collapsed: avatars + new-post dot only (no refresh state here)
 * ------------------------------------------------------------------ */

function MiniList({ subs, faces, showDot }: { subs: Subscription[]; faces: Record<number, string>; showDot: boolean }) {
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
              onClick={() => {
                setSelectedMid(sub.mid);
                if (sub.hasUnreadUpdate) void markUnread(sub.mid, false);
              }}
            >
              <Avatar mid={sub.mid} face={faces[sub.mid]} name={sub.name} size={24} />
              {showDot && sub.hasUnreadUpdate && <span className="mini-dot-new" />}
            </button>

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
 * Expanded list
 * ------------------------------------------------------------------ */

function FullList({
  subs,
  loading,
  faces,
  width,
  showDot,
}: {
  subs: Subscription[];
  loading: boolean;
  faces: Record<number, string>;
  width: number;
  showDot: boolean;
}) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);
  const setAddOpen = useUIStore((s) => s.setAddOpen);
  const openUserSettings = useUIStore((s) => s.openUserSettings);
  const updateSub = useUpdateSubscription();
  const removeSubs = useRemoveSubscriptions();
  const qc = useQueryClient();
  const setRefreshing = useUIStore((s) => s.setRefreshing);

  /* ---- delete mode: every stage is reversible, nothing is deleted until 保存 ---- */
  const [deleteMode, setDeleteMode] = useState(false);
  const [confirmMid, setConfirmMid] = useState<number | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const exitDeleteMode = () => {
    setDeleteMode(false);
    setConfirmMid(null);
    setPending(new Set());
    setError(null);
  };

  const saveDelete = async () => {
    const mids = [...pending];
    if (mids.length === 0) return;
    setError(null);
    try {
      await removeSubs.mutateAsync(mids);
      exitDeleteMode();
    } catch (e) {
      // Keep delete mode + pending so the user can retry — never pretend success.
      setError(e instanceof Error ? e.message : "删除失败，请重试");
    }
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
      if (e.key !== "Escape" || !deleteMode) return;
      if (confirmMid != null) setConfirmMid(null);
      else if (pending.size === 0) exitDeleteMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---- drag & drop ordering ---- */
  const [order, setOrder] = useState<number[] | null>(null);
  const orderRef = useRef<number[] | null>(null);
  const draggingMid = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ids = subs.map((s) => s.mid);
  const displayIds = useMemo(() => {
    if (!order) return ids;
    const kept = order.filter((id) => ids.includes(id));
    return [...kept, ...ids.filter((id) => !kept.includes(id))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, ids.join(",")]);
  const ordered = displayIds.map((id) => subs.find((s) => s.mid === id)!).filter(Boolean);

  const beginReorder = (mid: number) => (e: React.PointerEvent) => {
    if (deleteMode) return;
    e.preventDefault();
    e.stopPropagation();
    draggingMid.current = mid;
    const start = displayIds.slice();
    orderRef.current = start;
    setOrder(start);

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest?.("[data-mid]") as HTMLElement | null;
      const overMid = row ? Number(row.dataset.mid) : null;
      const current = orderRef.current;
      if (overMid == null || !current) return;
      const from = current.indexOf(mid);
      const to = current.indexOf(overMid);
      if (from < 0 || to < 0 || from === to) return;
      const next = current.slice();
      next.splice(from, 1);
      next.splice(to, 0, mid);
      orderRef.current = next;
      setOrder(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      draggingMid.current = null;
      const final = orderRef.current;
      if (final) void saveSubscriptionOrder(final).catch(() => {});
      setOrder(null);
      orderRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /** Re-enabling auto refresh: quietly refetch now, keep the cache on screen. */
  const enableAndRefresh = (mid: number) => {
    setRefreshing(true);
    void qc.invalidateQueries({ queryKey: ["profile", mid] });
    void qc.invalidateQueries({ queryKey: ["stats", mid] });
    void qc.invalidateQueries({ queryKey: ["videos", mid] });
    window.setTimeout(() => setRefreshing(false), 1500);
  };

  const leftLabel = confirmMid != null ? "取消确认" : pending.size > 0 ? "撤销全部" : "取消";

  return (
    <aside className="flex-none flex flex-col min-h-0" style={{ width }}>
      <div className="flex items-center px-3 py-2">
        <span className="text-[12px] font-medium pl-1" style={{ color: "var(--text-2)" }}>订阅列表</span>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5"
        onClick={() => confirmMid != null && setConfirmMid(null)}
      >
        {loading && <div className="px-2 py-1 text-xs" style={{ color: "var(--text-3)" }}>加载中…</div>}
        {ordered.map((sub) => {
          const confirming = confirmMid === sub.mid;
          const toDelete = pending.has(sub.mid);
          return (
            <div
              key={sub.mid}
              data-mid={sub.mid}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{
                background: selectedMid === sub.mid ? "var(--accent-soft)" : "transparent",
                opacity: toDelete ? 0.42 : 1,
              }}
              onClick={() => {
                if (deleteMode) return;
                setSelectedMid(sub.mid);
              }}
              title={deleteMode ? undefined : sub.name}
            >
              {/* avatar doubles as the drag handle on hover */}
              <span className="relative flex-none avatar-slot">
                <span className="avatar-face">
                  <Avatar mid={sub.mid} face={faces[sub.mid]} name={sub.name} size={24} />
                </span>
                <span className="avatar-grip" onPointerDown={beginReorder(sub.mid)} title="拖动排序">
                  <Grip size={14} />
                </span>
                {showDot && sub.hasUnreadUpdate && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "#fb7299", outline: "1.5px solid var(--bg)" }} />
                )}
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
                toDelete ? (
                  <button className="btn text-[11px] px-2 py-0.5 flex-none"
                    onClick={(e) => { e.stopPropagation(); togglePending(sub.mid); }}>
                    撤销
                  </button>
                ) : (
                  <button
                    className={`delete-btn flex-none ${confirming ? "confirming" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirming) {
                        togglePending(sub.mid);
                        setConfirmMid(null);
                      } else {
                        setConfirmMid(sub.mid);
                      }
                    }}>
                    {confirming ? <span className="text-[11px] font-medium">确认删除</span> : <XIcon size={12} />}
                  </button>
                )
              ) : (
                <>
                  <button className="refresh-dot flex-none" style={{ color: sub.enabled ? "#22a06b" : "var(--text-3)" }}
                    title={sub.enabled ? "自动刷新：开启" : "自动刷新：暂停"}
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !sub.enabled;
                      updateSub.mutate({ mid: sub.mid, patch: { enabled: next } });
                      if (next) enableAndRefresh(sub.mid);
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

      {error && (
        <div className="mx-2 mb-1 text-[11px] px-2 py-1 rounded" style={{ color: "#e5484d", background: "rgba(229,72,77,0.1)" }}>
          {error}
        </div>
      )}

      {deleteMode ? (
        <div className="flex gap-1.5 m-2">
          <button
            className="btn flex-1 justify-center text-xs"
            disabled={confirmMid == null && pending.size === 0}
            style={confirmMid == null && pending.size === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            onClick={() => {
              if (confirmMid != null) setConfirmMid(null);
              else setPending(new Set());
            }}
          >
            {leftLabel}
          </button>
          {pending.size === 0 ? (
            <button className="btn flex-1 justify-center text-xs" onClick={exitDeleteMode}>退出</button>
          ) : (
            <button className="btn btn-primary flex-1 justify-center text-xs" onClick={() => void saveDelete()}>
              保存 {pending.size} 项
            </button>
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
