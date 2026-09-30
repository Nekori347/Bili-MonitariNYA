import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { BilibiliAdapter } from "../services/bilibili/adapter";
import { getCaches } from "../services/database/usersCache";
import type { Subscription } from "../services/database/subscriptions";

/** Gap between two background avatar lookups, so startup never bursts. */
const STEP_MS = 1800;

/**
 * Avatar lookup per subscription.
 *
 * A face we already stored is read from SQLite and needs no request at all;
 * the remaining ones are paced out one at a time instead of firing a request
 * per subscription the moment the window opens.
 */
export function useFaces(subs: Subscription[]): Record<number, string> {
  const mids = useMemo(() => subs.map((s) => s.mid), [subs]);
  const key = mids.join(",");
  const [stored, setStored] = useState<Record<number, string>>({});
  const [allowed, setAllowed] = useState(0);

  useEffect(() => {
    let on = true;
    void getCaches(mids)
      .then((rows) => {
        if (!on) return;
        const map: Record<number, string> = {};
        for (const row of rows) {
          if (row.profile?.face) map[row.mid] = row.profile.face;
        }
        setStored(map);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const pending = useMemo(() => mids.filter((mid) => !stored[mid]), [mids, stored]);

  // Let the lookups drip in: one now, one more every STEP_MS.
  useEffect(() => {
    if (pending.length === 0) {
      setAllowed(0);
      return;
    }
    setAllowed(1);
    const t = window.setInterval(() => {
      setAllowed((a) => {
        if (a >= pending.length) {
          window.clearInterval(t);
          return a;
        }
        return a + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(t);
  }, [pending.length, key]);

  const quota = new Map(pending.map((mid, i) => [mid, i < allowed]));

  const queries = useQueries({
    queries: subs.map((s) => ({
      queryKey: ["brief", s.mid] as const,
      queryFn: () => BilibiliAdapter.getBriefUser(s.mid),
      staleTime: 30 * 60 * 1000,
      retry: 1,
      enabled: !stored[s.mid] && quota.get(s.mid) === true,
    })),
  });

  return useMemo(() => {
    const map: Record<number, string> = { ...stored };
    subs.forEach((s, i) => {
      const face = queries[i]?.data?.face;
      if (face) map[s.mid] = face;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subs, stored, queries.map((q) => q.data?.face).join(",")]);
}
