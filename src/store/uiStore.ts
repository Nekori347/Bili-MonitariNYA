import { create } from "zustand";

export type SortField = "view" | "like" | "online" | "pubdate";
export type SortDirection = "asc" | "desc";

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

  setSelectedMid: (mid: number | null) => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  toggleSortDirection: () => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsTab: (tab: "global" | "perUser") => void;
  openUserSettings: () => void;
  setAddOpen: (open: boolean) => void;
  setWindowVisible: (visible: boolean) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedMid: null,
  sortField: "pubdate",
  sortDirection: "desc",
  sidebarCollapsed: false,
  settingsOpen: false,
  settingsTab: "global",
  addOpen: false,
  isWindowVisible: true,
  toast: null,

  setSelectedMid: (mid) => set({ selectedMid: mid }),
  setSort: (sortField, sortDirection) => set({ sortField, sortDirection }),
  toggleSortDirection: () =>
    set((s) => ({ sortDirection: s.sortDirection === "desc" ? "asc" : "desc" })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  openUserSettings: () => set({ settingsOpen: true, settingsTab: "perUser" }),
  setAddOpen: (open) => set({ addOpen: open }),
  setWindowVisible: (visible) => set({ isWindowVisible: visible }),
  showToast: (msg) => set({ toast: msg }),
  clearToast: () => set({ toast: null }),
}));
