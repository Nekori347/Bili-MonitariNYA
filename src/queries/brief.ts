import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import type { Subscription } from "../services/database/subscriptions";

/**
 * Lightweight avatar lookup per subscription (card endpoint only, long stale
 * time) so the sidebar / bookmark rail can render faces without waiting for a
 * full profile fetch.
 */
export function useFaces(subs: Subscription[]): Record<number, string> {
  const queries = useQueries({
    queries: subs.map((s) => ({
      queryKey: ["brief", s.mid] as const,
      queryFn: () => BilibiliAdapter.getBriefUser(s.mid),
      staleTime: 30 * 60 * 1000,
      retry: 1,
    })),
  });

  return useMemo(() => {
    const map: Record<number, string> = {};
    subs.forEach((s, i) => {
      const face = queries[i]?.data?.face;
      if (face) map[s.mid] = face;
    });
    return map;
  }, [subs, queries]);
}
