import { useEffect, useRef, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Providers } from "./providers";
import { useSubscriptions } from "../queries/subscriptions";
import { useUIStore, isOnTop, isThrough } from "../store/uiStore";
import { useSettingsStore } from "../store/settingsStore";
import { useAuthStore } from "../store/authStore";
import { useDashboardStore } from "../store/dashboardStore";
import { Titlebar } from "../features/window-controls/Titlebar";
import { Sidebar } from "../features/subscriptions/Sidebar";
import { ProfileCard } from "../features/profile-card/ProfileCard";
import { VideoList } from "../features/video-list/VideoList";
import { AddSubscriptionModal } from "../features/subscriptions/AddSubscriptionModal";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { useBackgroundRefresh } from "../queries/background";
import { APP_NAME_ZH } from "../config/app";
import {
  applyWindowEffects,
  applyWindowBounds,
  appWindow,
  readWindowBounds,
  setAlwaysOnTop,
  setClickThrough,
  setCloseBehavior,
  onWindowHidden,
  onWindowShown,
  onTrayRefresh,
} from "../utils/window";

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

/**
 * Window state: native backdrop, the four-state mode (always-on-top × mouse
 * pass-through) and the saved frame, so the app reopens on the monitor and at
 * the spot it was last closed on.
 */
function useWindowStateEffect() {
  const loaded = useSettingsStore((s) => s.loaded);
  const closeToTray = useSettingsStore((s) => s.global.closeToTray);
  const savedBounds = useSettingsStore((s) => s.global.windowBounds);
  const windowMode = useUIStore((s) => s.windowMode);

  useEffect(() => {
    void applyWindowEffects();
  }, []);

  // Restore the last frame once, after settings are readable.
  const restored = useRef(false);
  useEffect(() => {
    if (!loaded || restored.current) return;
    restored.current = true;
    if (savedBounds) void applyWindowBounds(savedBounds);
  }, [loaded, savedBounds]);

  // Persist the frame whenever a move/resize settles.
  useEffect(() => {
    if (!loaded) return;
    let timer: number | null = null;
    const save = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void readWindowBounds().then((b) => {
          if (b) useSettingsStore.getState().updateGlobal({ windowBounds: b });
        });
      }, 600);
    };
    const unlisten = [appWindow.onMoved(save), appWindow.onResized(save)];
    return () => {
      if (timer != null) window.clearTimeout(timer);
      for (const p of unlisten) void p.then((f) => f());
    };
  }, [loaded]);

  // The mode drives both the always-on-top flag and the pass-through watcher.
  // The initial mode comes from the persisted always-on-top setting; mouse
  // pass-through itself is session-only, so a launch never starts click-through.
  const applied = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    if (!applied.current) {
      applied.current = true;
      const initial = useSettingsStore.getState().global.alwaysOnTop ? "onTop" : "normal";
      if (useUIStore.getState().windowMode !== initial) {
        useUIStore.getState().setWindowMode(initial);
        return; // re-runs with the resolved mode
      }
    }
    void setAlwaysOnTop(isOnTop(windowMode));
    void setClickThrough(isThrough(windowMode));
  }, [loaded, windowMode]);

  // Sync the close-button behavior to the Rust layer whenever it changes.
  useEffect(() => {
    if (loaded) void setCloseBehavior(closeToTray);
  }, [loaded, closeToTray]);
}

/** Silent update check shortly after launch (never blocks or interrupts). */
function useUpdateCheck() {
  const loaded = useSettingsStore((s) => s.loaded);
  const enabled = useSettingsStore((s) => s.global.updateCheckOnStart);
  const autoCheck = useSettingsStore((s) => s.global.updateAutoCheck);
  const showToast = useUIStore((s) => s.showToast);
  const ran = useRef(false);

  useEffect(() => {
    if (!loaded || ran.current || !enabled || !autoCheck) return;
    ran.current = true;
    const t = window.setTimeout(() => {
      void import("../services/updater")
        .then(({ checkForUpdate }) => checkForUpdate())
        .then((info) => {
          if (info) showToast(`发现新版本 ${info.version}，可在 设置 → 系统 → 自动更新 中安装`);
        })
        .catch(() => {
          /* offline / not configured — stay quiet */
        });
    }, 8000);
    return () => window.clearTimeout(t);
  }, [loaded, enabled, autoCheck, showToast]);
}

/** Restore the DPAPI-encrypted Bilibili session once settings are ready. */
function useAuthEffect() {
  const loaded = useSettingsStore((s) => s.loaded);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (loaded) void hydrate();
  }, [loaded, hydrate]);
}

/** Startup stage B: paint the whole dashboard from SQLite before any request. */
function useDashboardHydration() {
  const loaded = useSettingsStore((s) => s.loaded);
  const { data: subs } = useSubscriptions();
  const hydrate = useDashboardStore((s) => s.hydrate);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !loaded || !subs) return;
    ran.current = true;
    const store = useSettingsStore.getState();
    const limits: Record<number, number> = {};
    for (const s of subs) limits[s.mid] = store.effectiveVideoLimit(s.mid);
    void hydrate(limits);
  }, [loaded, subs, hydrate]);
}

/** React to tray / window-visibility events from the Rust layer. */
function useTrayEvents() {
  const setWindowVisible = useUIStore((s) => s.setWindowVisible);
  const showToast = useUIStore((s) => s.showToast);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const trayToastShown = useSettingsStore((s) => s.global.trayToastShown);
  const qc = useQueryClient();

  useEffect(() => {
    const refreshCurrentUp = () => {
      const mid = useUIStore.getState().selectedMid;
      if (mid != null) {
        void qc.invalidateQueries({ queryKey: ["profile", mid] });
        void qc.invalidateQueries({ queryKey: ["stats", mid] });
        void qc.invalidateQueries({ queryKey: ["videos", mid] });
        void qc.invalidateQueries({ queryKey: ["online"] });
      }
    };

    const un1 = onWindowHidden(() => {
      setWindowVisible(false);
      if (!useSettingsStore.getState().global.trayToastShown) {
        showToast(`${APP_NAME_ZH} 仍在后台运行，可从系统托盘重新打开。`);
        updateGlobal({ trayToastShown: true });
      }
    });
    const un2 = onWindowShown(() => {
      setWindowVisible(true);
      refreshCurrentUp();
    });
    const un3 = onTrayRefresh(() => {
      refreshCurrentUp();
    });

    return () => {
      void un1.then((f) => f());
      void un2.then((f) => f());
      void un3.then((f) => f());
    };
  }, [setWindowVisible, showToast, updateGlobal, trayToastShown, qc]);
}

function ToastHost() {
  const toast = useUIStore((s) => s.toast);
  const toastMs = useUIStore((s) => s.toastMs);
  const clearToast = useUIStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => clearToast(), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs, clearToast]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]">
      <div
        className="px-4 py-2.5 rounded-lg text-[13px]"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)", color: "var(--text)" }}
      >
        {toast}
      </div>
    </div>
  );
}

/** Window width below which the sidebar is forced into its mini form. An
 *  expanded 208px sidebar plus the video row's metric lanes need this much
 *  room, otherwise the row would have to fall back to its narrowest tier. */
const AUTO_MINI_BELOW = 520;

function useWindowWidth(): number {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 800 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

function Main() {
  useThemeEffect();
  useWindowStateEffect();
  useAuthEffect();
  useUpdateCheck();
  useTrayEvents();
  useDashboardHydration();
  useBackgroundRefresh();
  const { data: subs, isSuccess } = useSubscriptions();
  const selectedMid = useUIStore((s) => s.selectedMid);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const addOpen = useUIStore((s) => s.addOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const sidebarCollapsedState = useUIStore((s) => s.sidebarCollapsed);
  const windowWidth = useWindowWidth();
  const locked = windowWidth < AUTO_MINI_BELOW;
  const sidebarCollapsed = sidebarCollapsedState || locked;

  // Restore the UP that was open last time; fall back to the first one.
  useEffect(() => {
    if (!subs) return;
    const known = (mid: number | null) => mid != null && subs.some((s) => s.mid === mid);
    if (known(selectedMid)) return;
    const remembered = useSettingsStore.getState().global.lastSelectedMid;
    setSelectedMid(known(remembered) ? remembered : (subs[0]?.mid ?? null));
  }, [subs, selectedMid, setSelectedMid]);

  useEffect(() => {
    if (selectedMid != null) updateGlobal({ lastSelectedMid: selectedMid });
  }, [selectedMid, updateGlobal]);

  const hasSubs = !!subs && subs.length > 0;

  return (
    <div className="app-root">
      <div className="app-shell">
        <div className="accent-bar" />
        <Titlebar />
        <div className="flex flex-1 min-h-0 relative">
          <Sidebar subs={subs ?? []} loading={!isSuccess} collapsed={sidebarCollapsed} locked={locked} />
          <main className="flex-1 min-w-0 p-2.5 flex flex-col min-h-0 relative">
            {!hasSubs ? (
              <EmptyState />
            ) : selectedMid != null ? (
              <div className="flex flex-col flex-1 min-h-0" style={{ gap: 3 }}>
                <ProfileCard mid={selectedMid} />
                <RefreshProgress />
                <VideoList mid={selectedMid} />
              </div>
            ) : null}
            <ManageScrim />
          </main>
        </div>
        {addOpen && <AddSubscriptionModal />}
        {settingsOpen && <SettingsPanel />}
        <ToastHost />
      </div>
    </div>
  );
}

/**
 * The single 2px progress line between the profile card and the video list.
 * It only ever reports a refresh the user asked for — background polling,
 * a subscription switch or a startup revalidate stay invisible.
 */
function RefreshProgress() {
  const refreshing = useUIStore((s) => s.refreshing);
  const setRefreshing = useUIStore((s) => s.setRefreshing);
  const isFetching = useIsFetching();
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (refreshing) {
      shownAt.current = Date.now();
      setVisible(true);
      return;
    }
    if (!visible) return;
    // Let the sweep complete at least one pass so it never just blinks.
    const wait = Math.max(0, 650 - (Date.now() - shownAt.current));
    const t = window.setTimeout(() => setVisible(false), wait);
    return () => window.clearTimeout(t);
  }, [refreshing, visible]);

  // A user-requested refresh ends once its requests have settled.
  useEffect(() => {
    if (!refreshing || isFetching > 0) return;
    const t = window.setTimeout(() => setRefreshing(false), 250);
    return () => window.clearTimeout(t);
  }, [refreshing, isFetching, setRefreshing]);

  // Safety valve: never leave the line running if a request hangs.
  useEffect(() => {
    if (!refreshing) return;
    const t = window.setTimeout(() => setRefreshing(false), 20_000);
    return () => window.clearTimeout(t);
  }, [refreshing, setRefreshing]);

  return (
    <div className="flex-none refresh-line" style={{ height: 2 }}>
      <div className={`refresh-fill${visible ? " on" : ""}`} />
    </div>
  );
}

/**
 * While the sidebar is managing subscriptions the main pane is not usable.
 * A light scrim says so, and it swallows every pointer event so the content
 * underneath cannot be clicked. The titlebar stays fully interactive.
 */
function ManageScrim() {
  const managing = useUIStore((s) => s.managingSubscriptions);
  if (!managing) return null;
  return (
    <div className="main-scrim" aria-hidden>
      <span className="main-scrim-hint">删除模式</span>
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
