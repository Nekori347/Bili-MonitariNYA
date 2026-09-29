import { useEffect } from "react";
import { Providers } from "./providers";
import { useSubscriptions } from "../queries/subscriptions";
import { useUIStore } from "../store/uiStore";
import { useSettingsStore } from "../store/settingsStore";
import { Titlebar } from "../features/window-controls/Titlebar";
import { Sidebar } from "../features/subscriptions/Sidebar";
import { ProfileCard } from "../features/profile-card/ProfileCard";
import { VideoList } from "../features/video-list/VideoList";
import { AddSubscriptionModal } from "../features/subscriptions/AddSubscriptionModal";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { applyWindowEffects, setAlwaysOnTop } from "../utils/window";

function useThemeEffect() {
  const theme = useSettingsStore((s) => s.global.theme);
  const opacity = useSettingsStore((s) => s.global.opacity);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      let mode = theme;
      if (theme === "system") {
        mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      root.setAttribute("data-theme", mode);
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-opacity", String(opacity / 100));
  }, [opacity]);
}

/** Restore persisted window state (native backdrop + always-on-top) on startup. */
function useWindowStateEffect() {
  const loaded = useSettingsStore((s) => s.loaded);
  const alwaysOnTop = useSettingsStore((s) => s.global.alwaysOnTop);

  useEffect(() => {
    void applyWindowEffects();
  }, []);

  useEffect(() => {
    if (loaded) void setAlwaysOnTop(alwaysOnTop);
  }, [loaded, alwaysOnTop]);
}

function Main() {
  useThemeEffect();
  useWindowStateEffect();
  const { data: subs, isLoading } = useSubscriptions();
  const selectedMid = useUIStore((s) => s.selectedMid);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);
  const addOpen = useUIStore((s) => s.addOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  useEffect(() => {
    if (subs && subs.length > 0 && selectedMid == null) {
      setSelectedMid(subs[0].mid);
    }
    if (subs && selectedMid != null && !subs.some((s) => s.mid === selectedMid)) {
      setSelectedMid(subs[0]?.mid ?? null);
    }
  }, [subs, selectedMid, setSelectedMid]);

  const hasSubs = !!subs && subs.length > 0;

  return (
    <div className="app-shell">
      <div className="accent-bar" />
      <Titlebar />
      <div className="flex flex-1 min-h-0">
        {!sidebarCollapsed && <Sidebar subs={subs ?? []} loading={isLoading} />}
        <main className="flex-1 min-w-0 p-4 overflow-y-auto">
          {!hasSubs ? (
            <EmptyState />
          ) : selectedMid != null ? (
            <div className="flex flex-col gap-4">
              <ProfileCard mid={selectedMid} />
              <VideoList mid={selectedMid} />
            </div>
          ) : null}
        </main>
      </div>
      {addOpen && <AddSubscriptionModal />}
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}

function EmptyState() {
  const setAddOpen = useUIStore((s) => s.setAddOpen);
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
      <div className="text-4xl">📊</div>
      <div className="text-lg font-medium" style={{ color: "var(--text)" }}>
        还没有订阅任何 UP 主
      </div>
      <div style={{ color: "var(--text-2)" }}>
        添加 B 站主页链接或 UID，开始监控投稿数据与增长趋势
      </div>
      <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
        ＋ 添加 UP 主
      </button>
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <Main />
    </Providers>
  );
}
