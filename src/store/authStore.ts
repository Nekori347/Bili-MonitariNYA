import { create } from "zustand";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import { clearSession, persistSession, restoreSession } from "../services/auth/session";
import { useSettingsStore } from "./settingsStore";

export interface BiliAccount {
  mid: number;
  name: string;
  face: string;
}

type AuthStatus = "loading" | "guest" | "loggedIn";

interface AuthState {
  status: AuthStatus;
  account: BiliAccount | null;
  hydrate: () => Promise<void>;
  /** Called after a successful QR scan. */
  signIn: (cookie: string) => Promise<BiliAccount | null>;
  signOut: () => Promise<void>;
}

/**
 * Reads the logged-in account and binds it as the "primary account" (which is
 * what unlocks the upload entry and the login-only stats).
 */
async function resolveAccount(): Promise<BiliAccount | null> {
  const nav = await BilibiliAdapter.getNavInfo();
  if (!nav || !nav.isLogin) return null;
  return { mid: nav.mid, name: nav.name, face: nav.face };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  account: null,

  hydrate: async () => {
    const has = await restoreSession();
    if (!has) {
      set({ status: "guest", account: null });
      return;
    }
    const account = await resolveAccount();
    if (!account) {
      // Stored cookie is stale — drop it so we don't keep sending it.
      await clearSession();
      set({ status: "guest", account: null });
      return;
    }
    useSettingsStore.getState().updateGlobal({ primaryAccountMid: account.mid });
    set({ status: "loggedIn", account });
  },

  signIn: async (cookie) => {
    await persistSession(cookie);
    const account = await resolveAccount();
    if (!account) {
      await clearSession();
      set({ status: "guest", account: null });
      return null;
    }
    useSettingsStore.getState().updateGlobal({ primaryAccountMid: account.mid });
    set({ status: "loggedIn", account });
    return account;
  },

  signOut: async () => {
    const bound = useSettingsStore.getState().global.primaryAccountMid;
    const { account } = get();
    await clearSession();
    if (bound != null && bound === account?.mid) {
      useSettingsStore.getState().updateGlobal({ primaryAccountMid: null });
    }
    set({ status: "guest", account: null });
  },
}));
