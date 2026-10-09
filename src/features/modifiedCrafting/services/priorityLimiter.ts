/*
 * One cap on how many of this page's requests run at once, with two
 * queues: what the visitor is looking at (cards, a dialog) goes first, and
 * the slot-link map's 389 records fill the remaining turns. A single FIFO
 * would put a card's icon behind hundreds of records; two separate caps
 * would let twice as many requests through the proxy, which shares
 * Blizzard's quota with every visitor (and Netlify allows each IP 600
 * requests a minute).
 *
 * Work still waiting when its query is cancelled (the card or view
 * unmounted, StrictMode's simulated remount) leaves its queue at once with
 * the abort reason, so react-query drops it silently and holds no slot.
 */

export type Priority = "high" | "low";

export type PriorityLimiter = {
  <T>(
    task: () => Promise<T>,
    signal: AbortSignal | undefined,
    priority: Priority,
    /** Names the work so `promote` can find it while it waits. */
    key?: string,
  ): Promise<T>;
  /**
   * Moves low-priority work still waiting under `key` to the front queue.
   * React-query hands a card the fetch already running for its key, at
   * whatever priority that fetch was queued with, so a card that needs a
   * record the map queued promotes it rather than waiting its turn.
   */
  promote: (key: string) => void;
};

type Entry = { start: () => void; key: string | undefined };

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

export const createPriorityLimiter = (limit: number): PriorityLimiter => {
  const maxActive = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const queues: Record<Priority, Entry[]> = { high: [], low: [] };

  const pump = (): void => {
    while (active < maxActive) {
      const next = queues.high.shift() ?? queues.low.shift();
      if (!next) {
        return;
      }
      next.start();
    }
  };

  /** Takes `entry` out of whichever queue holds it (a promoted one moved). */
  const remove = (entry: Entry): void => {
    (["high", "low"] as const).forEach((priority) => {
      const index = queues[priority].indexOf(entry);
      if (index >= 0) {
        queues[priority].splice(index, 1);
      }
    });
  };

  const acquire = (
    signal: AbortSignal | undefined,
    priority: Priority,
    key: string | undefined,
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      let onAbort: (() => void) | undefined;
      const entry: Entry = {
        key,
        start: () => {
          if (signal && onAbort) {
            signal.removeEventListener("abort", onAbort);
          }
          active += 1;
          resolve();
        },
      };

      if (signal) {
        if (signal.aborted) {
          reject(abortReason(signal));
          return;
        }
        const cancelled = signal;
        onAbort = () => {
          remove(entry);
          reject(abortReason(cancelled));
        };
        cancelled.addEventListener("abort", onAbort, { once: true });
      }

      queues[priority].push(entry);
      pump();
    });

  const run = async <T>(
    task: () => Promise<T>,
    signal: AbortSignal | undefined,
    priority: Priority,
    key?: string,
  ): Promise<T> => {
    await acquire(signal, priority, key);
    try {
      return await task();
    } finally {
      active -= 1;
      pump();
    }
  };

  const promote = (key: string): void => {
    const waiting = queues.low.filter((entry) => entry.key === key);
    if (waiting.length === 0) {
      return;
    }
    queues.low = queues.low.filter((entry) => entry.key !== key);
    queues.high.push(...waiting);
    pump();
  };

  return Object.assign(run, { promote });
};
