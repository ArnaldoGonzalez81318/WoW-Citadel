/*
 * One cap on how many of this page's requests of a kind run at once, with a
 * queue per priority: a dialog the visitor opened goes first, then a card's
 * follow-up lookup (its set is in; its first piece finishes it), then the
 * cards' first lookups. A single FIFO put a dialog, and the top row's second
 * step, behind every card the page had queued; a separate cap per kind of
 * lookup would let several times as many requests through the proxy, which
 * shares Blizzard's quota with every visitor (and Netlify allows each IP 600
 * requests a minute).
 *
 * A fetch keeps the priority of whichever observer started it: a dialog
 * that opens on a record a card already queued shares that fetch.
 *
 * Work still waiting when its query is cancelled (a card unmounted,
 * StrictMode's simulated remount) leaves its queue at once with the abort
 * reason, so react-query drops it silently and holds no slot.
 */

export type FetchPriority = "dialog" | "followUp" | "card";

/** Highest first. */
const PRIORITY_ORDER: readonly FetchPriority[] = ["dialog", "followUp", "card"];

export type PriorityLimiter = <T>(
  task: () => Promise<T>,
  signal: AbortSignal | undefined,
  priority: FetchPriority,
) => Promise<T>;

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

export const createPriorityLimiter = (limit: number): PriorityLimiter => {
  const maxActive = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const queues: Record<FetchPriority, Array<() => void>> = {
    dialog: [],
    followUp: [],
    card: [],
  };

  const next = (): (() => void) | undefined => {
    for (const priority of PRIORITY_ORDER) {
      const start = queues[priority].shift();
      if (start) {
        return start;
      }
    }
    return undefined;
  };

  const pump = (): void => {
    while (active < maxActive) {
      const start = next();
      if (!start) {
        return;
      }
      start();
    }
  };

  const acquire = (signal: AbortSignal | undefined, priority: FetchPriority): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const queue = queues[priority];
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
          const index = queue.indexOf(start);
          if (index >= 0) {
            queue.splice(index, 1);
          }
          reject(abortReason(cancelled));
        };
        cancelled.addEventListener("abort", onAbort, { once: true });
      }

      queue.push(start);
      pump();
    });

  return async <T>(
    task: () => Promise<T>,
    signal: AbortSignal | undefined,
    priority: FetchPriority,
  ): Promise<T> => {
    await acquire(signal, priority);
    try {
      return await task();
    } finally {
      active -= 1;
      pump();
    }
  };
};
