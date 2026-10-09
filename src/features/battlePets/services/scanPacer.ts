/*
 * A family filter over 2,179 pets fetches records until a page is full, and
 * counting every family fetches them all. The proxy allows each visitor 600
 * requests a minute (Netlify's edge limit, which counts every call), so a
 * scan may not simply run flat out: a token bucket lets the first records go
 * at once (a common family's first page fills in a few seconds), then holds
 * the scan to a steady rate that leaves room for everything else the page
 * loads. 150 at once plus 5 a second is at most 450 in any minute.
 *
 * Shared by every scan on the page (pets and abilities), so two running at
 * once still keep to the budget together.
 */

const BURST = 150;
const PER_SECOND = 5;

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = (): void => {
      window.clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

let tokens = BURST;
let refilledAt = Date.now();

const refill = (): void => {
  const now = Date.now();
  tokens = Math.min(BURST, tokens + ((now - refilledAt) / 1000) * PER_SECOND);
  refilledAt = now;
};

/** Resolves when the scan may start its next record fetch; rejects when `signal` aborts. */
export const paceScan = async (signal: AbortSignal): Promise<void> => {
  for (;;) {
    if (signal.aborted) {
      throw abortReason(signal);
    }
    refill();
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    await sleep(Math.ceil(((1 - tokens) / PER_SECOND) * 1000), signal);
  }
};
