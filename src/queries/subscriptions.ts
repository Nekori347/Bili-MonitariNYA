import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  listSubscriptions,
  removeSubscription,
  removeSubscriptions,
  saveSubscriptionOrder,
  setRemark,
  upsertSubscription,
  updateSubscription,
  type Subscription,
} from "../services/database/subscriptions";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import { BiliError } from "../services/bilibili/types";
import { useUIStore } from "../store/uiStore";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
};

/** How long after the last keystroke the remark is written to SQLite. */
const REMARK_DEBOUNCE_MS = 400;

export function useSubscriptions() {
  return useQuery({
    queryKey: subscriptionKeys.all,
    queryFn: () => listSubscriptions(),
    staleTime: 30_000,
  });
}

/** Rewrite one subscription in the cache without touching the network. */
function patchCache(qc: QueryClient, mid: number, patch: Partial<Subscription>) {
  qc.setQueryData<Subscription[]>(subscriptionKeys.all, (old) =>
    old ? old.map((s) => (s.mid === mid ? { ...s, ...patch } : s)) : old,
  );
}

export function useAddSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sub: { mid: number; name: string; videoLimit?: number }) =>
      upsertSubscription(sub),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mid, patch }: { mid: number; patch: Partial<Subscription> }) =>
      updateSubscription(mid, patch),
    onMutate: ({ mid, patch }) => {
      void qc.cancelQueries({ queryKey: subscriptionKeys.all });
      patchCache(qc, mid, patch);
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useRemoveSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mid: number) => removeSubscription(mid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

/** Batch delete used by the sidebar's delete mode (awaited, all-or-nothing). */
export function useRemoveSubscriptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mids: number[]) => removeSubscriptions(mids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

/**
 * The one "add a subscription" flow, shared by the sidebar modal and
 * 设置 → 订阅. It only validates and writes — the caller decides what to
 * select afterwards.
 */
export function useAddSubscriptionFlow() {
  const { data: subs } = useSubscriptions();
  const addSub = useAddSubscription();

  return {
    busy: addSub.isPending,
    /** Resolves with the new mid, or throws a BiliError the caller can show. */
    add: async (input: string, videoLimit: number): Promise<number> => {
      const { mid } = BilibiliAdapter.resolveUser(input);
      if (subs?.some((s) => s.mid === mid)) {
        throw new BiliError("unknown", "该 UP 主已在订阅列表中");
      }
      // Fast path: confirm the user exists, then let the normal queries fill in
      // profile / banner / assets / videos in the background.
      const brief = await BilibiliAdapter.getBriefUser(mid);
      await addSub.mutateAsync({ mid, name: brief.name || `UID ${mid}`, videoLimit });
      return mid;
    },
  };
}

/** Persist a drag & drop reorder of the sidebar list. */
export function useSaveSubscriptionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mids: number[]) => saveSubscriptionOrder(mids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

/**
 * Remark editing: the sidebar, mini rail, tooltip and profile card all read the
 * subscription cache, so the keystroke is applied there first and SQLite is
 * written afterwards. A failed write reloads the stored value and reports it.
 */
export function useRemarkEditor(mid: number) {
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const timer = useRef<number | null>(null);
  const pending = useRef<string | null>(null);

  const flush = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const value = pending.current;
    pending.current = null;
    if (value == null) return;
    void setRemark(mid, value).catch(() => {
      showToast("备注保存失败，已恢复原内容");
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    });
  }, [mid, qc, showToast]);

  const set = useCallback(
    (value: string) => {
      patchCache(qc, mid, { remark: value.trim() || undefined });
      pending.current = value;
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, REMARK_DEBOUNCE_MS);
    },
    [mid, qc, flush],
  );

  // Never lose the last keystroke when the panel closes.
  useEffect(() => flush, [flush]);

  return { set, flush };
}
