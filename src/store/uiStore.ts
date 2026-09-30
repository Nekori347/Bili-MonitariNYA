import { create } from "zustand";

export type SortField = "view" | "like" | "coin" | "danmaku" | "reply" | "online" | "pubdate";
export type SortDirection = "asc" | "desc";

/**
 * The window's four states, cycled from the single titlebar control.
 * The two `*Through` modes forward mouse input from the content area to what is
 * behind the window; the titlebar strip always stays clickable.
 */
export type WindowMode = "normal" | "onTop" | "onTopThrough" | "through";

export const WINDOW_MODE_ORDER: WindowMode[] = ["normal", "onTop", "onTopThrough", "through"];

export const WINDOW_MODE_LABEL: Record<WindowMode, string> = {
  normal: "正常窗口",
  onTop: "置顶",
  onTopThrough: "置顶 · 鼠标穿透",
  through: "鼠标穿透",
};

export const isOnTop = (m: WindowMode) => m === "onTop" || m === "onTopThrough";
export const isThrough = (m: WindowMode) => m === "through" || m === "onTopThrough";

interface UIState {
  selectedMid: number | null;
  sortField: SortField;
  sortDirection: SortDirection;
  sidebarCollapsed: boolean;
  settingsOpen: boolean;
  settingsTab: "global" | "perUser";
  addOpen: boolean;
  isWindowVisible: boolean;
  toast: string | null;
  toastMs: number;
  refreshing: boolean;
  /** True while the sidebar is managing subscriptions; the main pane dims. */
  managingSubscriptions: boolean;
  windowMode: WindowMode;

  setSelectedMid: (mid: number | null) => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  toggleSortDirection: () => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsTab: (tab: "global" | "perUser") => void;
  openUserSettings: () => void;
  setAddOpen: (open: boolean) => void;
  setWindowVisible: (visible: boolean) => void;
  showToast: (msg: string, ms?: number) => void;
  clearToast: () => void;
  setRefreshing: (v: boolean) => void;
  setManagingSubscriptions: (v: boolean) => void;
  setWindowMode: (m: WindowMode) => void;
  cycleWindowMode: () => WindowMode;
}

export const useUIStore = create<UIState>((set, get) => ({
  selectedMid: null,
  sortField: "pubdate",
  sortDirection: "desc",
  sidebarCollapsed: false,
  settingsOpen: false,
  settingsTab: "global",
  addOpen: false,
  isWindowVisible: true,
  toast: null,
  toastMs: 4000,
  refreshing: false,
  managingSubscriptions: false,
  windowMode: "normal",

  setSelectedMid: (mid) => set({ selectedMid: mid }),
  setSort: (sortField, sortDirection) => set({ sortField, sortDirection }),
  toggleSortDirection: () =>
    set((s) => ({ sortDirection: s.sortDirection === "desc" ? "asc" : "desc" })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  // The titlebar gear always opens the global defaults, never the last UP's page.
  setSettingsOpen: (open) =>
    set(open ? { settingsOpen: true, settingsTab: "global" } : { settingsOpen: false }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  openUserSettings: () => set({ settingsOpen: true, settingsTab: "perUser" }),
  setAddOpen: (open) => set({ addOpen: open }),
  setWindowVisible: (visible) => set({ isWindowVisible: visible }),
  showToast: (msg, ms = 4000) => set({ toast: msg, toastMs: ms }),
  clearToast: () => set({ toast: null }),
  setRefreshing: (v) => set({ refreshing: v }),
  setManagingSubscriptions: (v) => set({ managingSubscriptions: v }),
  setWindowMode: (m) => set({ windowMode: m }),
  cycleWindowMode: () => {
    const cur = get().windowMode;
    const next = WINDOW_MODE_ORDER[(WINDOW_MODE_ORDER.indexOf(cur) + 1) % WINDOW_MODE_ORDER.length];
    set({ windowMode: next });
    return next;
  },
}));
