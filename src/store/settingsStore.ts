import { create } from "zustand";
import { getSetting, setSetting } from "../services/database/settings";
import {
  DEFAULT_SETTINGS,
  type GlobalSettings,
  type PerUserSettings,
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

export const useSettingsStore = create<SettingsState>((set, get) => ({
  loaded: false,
  global: { ...DEFAULT_SETTINGS },
  perUser: {},

  hydrate: async () => {
    const g = await getSetting<GlobalSettings>(SETTINGS_KEY);
    const p = await getSetting<Record<number, PerUserSettings>>(PER_USER_KEY);
    const global = g ? { ...DEFAULT_SETTINGS, ...g, fields: { ...DEFAULT_SETTINGS.fields, ...(g.fields ?? {}) } } : { ...DEFAULT_SETTINGS };
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
