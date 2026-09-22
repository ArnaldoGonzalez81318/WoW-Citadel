import { useEffect, useState } from "react";

/** Re-render cadence for relative times ("Updated N min ago"); no refetch involved. */
export const CLOCK_TICK_MS = 30_000;

/** Wall-clock `now`, ticked every 30s so relative times keep advancing. */
export const useNow = (tickMs: number = CLOCK_TICK_MS): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return now;
};

export default useNow;
