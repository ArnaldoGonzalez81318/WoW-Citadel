/**
 * Stale-chunk recovery shared by `main.tsx` (the `vite:preloadError`
 * listener), `RouteErrorBoundary` / `AppErrorBoundary` (the Reload buttons)
 * and `RootLayout` (clearing the guard once a page has rendered).
 *
 * Value-only module so the component files that use it stay Fast Refresh
 * boundaries.
 */

/** Session flag that prevents a reload loop when the new bundle also fails. */
export const CHUNK_RELOAD_KEY = "wc:chunk-reload";

/**
 * A second chunk failure this soon after an automatic reload means the fresh
 * bundle is broken too: stop reloading and let `RouteErrorBoundary` offer a
 * hard "Go home" instead. Nested lazy explorers fail *after* their parent
 * page has rendered, which is why the guard is time-based rather than
 * "cleared once anything rendered".
 */
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

const CHUNK_ERROR_PATTERN =
  /dynamically imported module|Loading chunk|Importing a module script failed/i;

/** True for the errors a stale `index.html` throws after a deploy. */
export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error && CHUNK_ERROR_PATTERN.test(error.message);

/** Timestamp of the last guarded reload; `null` when no reload is recorded. */
export const readChunkReloadAt = (): number | null => {
  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    // "1" (written by a manual Reload button) reads as long ago.
    return Number.isFinite(value) ? value : 0;
  } catch {
    return null;
  }
};

/** True while any reload flag is present (used by the error boundaries). */
export const hasChunkReloadFlag = (): boolean => readChunkReloadAt() !== null;

/** True while the last automatic reload is younger than the cooldown. */
export const isChunkReloadPending = (now: number = Date.now()): boolean => {
  const reloadedAt = readChunkReloadAt();
  return reloadedAt !== null && now - reloadedAt < CHUNK_RELOAD_COOLDOWN_MS;
};

/**
 * Records a reload. Returns false when storage is unavailable so the caller
 * never reloads without the guard.
 */
export const markChunkReload = (now: number = Date.now()): boolean => {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
};

export const clearChunkReloadFlag = (): void => {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
};
