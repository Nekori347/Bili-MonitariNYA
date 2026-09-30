import { create } from "zustand";
import { getSetting, setSetting } from "../services/database/settings";
import {
  DEFAULT_SETTINGS,
  DEFAULT_VIDEO_FIELD_ORDER,
  type GlobalSettings,
  type PerUserSettings,
  type VideoFieldKey,
} from "../types/settings";

interface SettingsState {
  loaded: boolean;
  global: GlobalSettings;
  perUser: Record<number, PerUserSettings>;

  hydrate: () => Promise<void>;
  updateGlobal: (patch: Partial<GlobalSettings>) => void;
  updateField: (field: keyof GlobalSettings["fields"], value: boolean) => void;
  setPerUser: (mid: number, patch: PerUserSettings) => void;
  clearPerUser: (mid: number) => void;
  effectiveVideoLimit: (mid: number) => number;
  effectiveFields: (mid: number) => GlobalSettings["fields"];
}

const SETTINGS_KEY = "global_settings_v1";
const PER_USER_KEY = "per_user_settings_v1";

/**
 * Fold a saved column order into the current default order.
 *
 * The user's own ordering is preserved exactly, and a column that did not
 * exist when the save was written (弹幕量 / 评论量 arrived later) is slotted in
 * next to its nearest default neighbour instead of being appended — so the
 * layout keeps reading 播放 · 点赞 · 投币 · 弹幕 · 评论 · 在线 · 时间.
 * Nothing already chosen by the user is ever reordered or reset.
 */
function mergeFieldOrder(saved: unknown): VideoFieldKey[] {
  const stored = Array.isArray(saved) ? (saved as VideoFieldKey[]) : [];
  const kept = stored.filter((k) => DEFAULT_VIDEO_FIELD_ORDER.includes(k));
  const order: VideoFieldKey[] = [];
  for (const def of DEFAULT_VIDEO_FIELD_ORDER) {
    if (kept.includes(def)) {
      order.push(def);
      continue;
    }
    const idx = DEFAULT_VIDEO_FIELD_ORDER.indexOf(def);
    const anchor = DEFAULT_VIDEO_FIELD_ORDER.slice(0, idx)
      .reverse()
      .find((k) => kept.includes(k));
    const at = anchor ? order.indexOf(anchor) + 1 : 0;
    order.splice(at, 0, def);
  }
  return order;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  loaded: false,
  global: { ...DEFAULT_SETTINGS },
  perUser: {},

  hydrate: async () => {
    const g = await getSetting<GlobalSettings>(SETTINGS_KEY);
    const p = await getSetting<Record<number, PerUserSettings>>(PER_USER_KEY);
    const merged = g ? { ...DEFAULT_SETTINGS, ...g, fields: { ...DEFAULT_SETTINGS.fields, ...(g.fields ?? {}) } } : { ...DEFAULT_SETTINGS };
    const global: GlobalSettings = {
      ...merged,
      videoFieldOrder: mergeFieldOrder(merged.videoFieldOrder),
    };
    set({ loaded: true, global, perUser: p ?? {} });
  },

  updateGlobal: (patch) => {
    const global = { ...get().global, ...patch };
    set({ global });
    void setSetting(SETTINGS_KEY, global);
  },

  updateField: (field, value) => {
    const fields = { ...get().global.fields, [field]: value };
    get().updateGlobal({ fields });
  },

  setPerUser: (mid, patch) => {
    const perUser = { ...get().perUser, [mid]: { ...get().perUser[mid], ...patch } };
    set({ perUser });
    void setSetting(PER_USER_KEY, perUser);
  },

  clearPerUser: (mid) => {
    const perUser = { ...get().perUser };
    delete perUser[mid];
    set({ perUser });
    void setSetting(PER_USER_KEY, perUser);
  },

  effectiveVideoLimit: (mid) => {
    const { global, perUser } = get();
    return perUser[mid]?.videoLimit ?? global.videoLimit;
  },

  effectiveFields: (mid) => {
    const { global, perUser } = get();
    return { ...global.fields, ...(perUser[mid]?.fields ?? {}) };
  },
}));
