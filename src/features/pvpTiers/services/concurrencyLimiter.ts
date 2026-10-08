/*
 * A first-in, first-out cap on how many fetches run at once. The PvP Tiers
 * page needs every tier's record (45 on US) before it can list the brackets
 * or fill its comparison table; started together they would burst 45
 * requests through the proxy, which shares Blizzard's per-second quota with
 * every other visitor (and Netlify allows each IP 600 a minute).
 *
 * Work still waiting for a slot when its query is cancelled (unmount,
 * StrictMode's simulated remount) leaves the queue at once with the abort
 * reason, so react-query drops it silently and no slot is held for it.
 */

export type ConcurrencyLimiter = <T>(
  task: () => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

export const createConcurrencyLimiter = (limit: number): ConcurrencyLimiter => {
  const maxActive = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const waiting: Array<() => void> = [];

  const pump = (): void => {
    while (active < maxActive && waiting.length > 0) {
      waiting.shift()?.();
    }
  };

  const acquire = (signal?: AbortSignal): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      let onAbort: (() => void) | undefined;
      const start = (): void => {
        if (signal && onAbort) {
          signal.removeEventListener("abort", onAbort);
        }
        active += 1;
        resolve();
      };

      if (signal) {
        if (signal.aborted) {
          reject(abortReason(signal));
          return;
        }
        const cancelled = signal;
        onAbort = () => {
          const index = waiting.indexOf(start);
          if (index >= 0) {
            waiting.splice(index, 1);
          }
          reject(abortReason(cancelled));
        };
        cancelled.addEventListener("abort", onAbort, { once: true });
      }

      waiting.push(start);
      pump();
    });

  return async <T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    await acquire(signal);
    try {
      return await task();
    } finally {
      active -= 1;
      pump();
    }
  };
};
