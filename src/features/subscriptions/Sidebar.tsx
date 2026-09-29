import { openUrl } from "@tauri-apps/plugin-opener";
import { useRemoveSubscription, useUpdateSubscription } from "../../queries/subscriptions";
import type { Subscription } from "../../services/database/subscriptions";
import { useUIStore } from "../../store/uiStore";
import { spaceUrl } from "../../services/bilibili/endpoints";

interface Props {
  subs: Subscription[];
  loading: boolean;
}

export function Sidebar({ subs, loading }: Props) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);
  const setAddOpen = useUIStore((s) => s.setAddOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openUserSettings = useUIStore((s) => s.openUserSettings);
  const updateSub = useUpdateSubscription();
  const removeSub = useRemoveSubscription();

  return (
    <aside className="w-56 flex-none flex flex-col border-r" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-medium" style={{ color: "var(--text-2)" }}>
          订阅列表
        </span>
        <button className="titlebar-btn" title="折叠侧栏" onClick={toggleSidebar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1">
        {loading && <div className="px-3 py-2 text-xs" style={{ color: "var(--text-3)" }}>加载中…</div>}
        {subs.map((sub) => (
          <div
            key={sub.mid}
            className="group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors"
            style={{
              background: selectedMid === sub.mid ? "var(--accent-soft)" : "transparent",
            }}
            onClick={() => setSelectedMid(sub.mid)}
            title={sub.name}
          >
            <span
              className="w-2 h-2 rounded-full flex-none"
              style={{ background: sub.enabled ? "#22a06b" : "var(--text-3)" }}
            />
            <span
              className="flex-1 truncate text-[13px]"
              style={{ color: selectedMid === sub.mid ? "var(--accent)" : "var(--text)" }}
            >
              {sub.name || `UID ${sub.mid}`}
            </span>
            <div className="hidden group-hover:flex items-center gap-0.5 no-drag">
              <button
                className="titlebar-btn"
                style={{ width: 24, height: 24 }}
                title="该 UP 主独立设置"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMid(sub.mid);
                  openUserSettings();
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <button
                className="titlebar-btn"
                style={{ width: 24, height: 24 }}
                title={sub.enabled ? "暂停刷新" : "恢复刷新"}
                onClick={(e) => {
                  e.stopPropagation();
                  updateSub.mutate({ mid: sub.mid, patch: { enabled: !sub.enabled } });
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {sub.enabled ? <path d="M10 9v6M14 9v6" /> : <path d="M8 5v14l11-7z" />}
                </svg>
              </button>
              <button
                className="titlebar-btn"
                style={{ width: 24, height: 24 }}
                title="打开主页"
                onClick={(e) => {
                  e.stopPropagation();
                  void openUrl(spaceUrl(sub.mid));
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                </svg>
              </button>
              <button
                className="titlebar-btn"
                style={{ width: 24, height: 24 }}
                title="删除订阅"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`删除订阅「${sub.name || sub.mid}」及其历史快照？`)) {
                    removeSub.mutate(sub.mid);
                  }
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn m-2 justify-center" onClick={() => setAddOpen(true)}>
        ＋ 添加订阅
      </button>
    </aside>
  );
}
