import { useEffect, useState } from "react";

/**
 * Returns false initially, then true after `ms`.
 * Used to defer secondary data fetches so the (risk-control sensitive)
 * video-list request goes out first at startup.
 */
export function useDelayedReady(ms: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return ready;
}
