import { Box } from "@mui/material";
import { Suspense, useEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import type { Location } from "react-router-dom";

import { CHUNK_RELOAD_KEY } from "@/components/common/RouteErrorBoundary";
import SkipLink from "@/components/common/SkipLink";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import AppShell from "@/components/layout/AppShell";
import { SearchProvider } from "@/features/search/context/SearchContext";

/** id of the skip-link target; the shell must not reuse it. */
export const MAIN_CONTENT_ID = "main-content";

/* ------------------------------------------------------------------ */
/* Chunk-reload guard                                                  */
/* ------------------------------------------------------------------ */

/**
 * A second chunk failure this soon after an automatic reload means the fresh
 * bundle is broken too: stop reloading and let `RouteErrorBoundary` offer a
 * hard "Go home" instead. Nested lazy explorers fail *after* their parent
 * page has rendered, which is why the guard is time-based rather than
 * "cleared once anything rendered".
 */
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

const readChunkReloadAt = (): number | null => {
  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    // "1" (written by RouteErrorBoundary's Reload button) reads as long ago.
    return Number.isFinite(value) ? value : 0;
  } catch {
    return null;
  }
};

/** True while the last automatic reload is younger than the cooldown. */
export const isChunkReloadPending = (now: number = Date.now()): boolean => {
  const reloadedAt = readChunkReloadAt();
  return reloadedAt !== null && now - reloadedAt < CHUNK_RELOAD_COOLDOWN_MS;
};

/**
 * Records an automatic reload. Returns false when storage is unavailable so
 * the caller never reloads without the guard.
 */
export const markChunkReload = (now: number = Date.now()): boolean => {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
};

const clearChunkReloadFlag = (): void => {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
};

/**
 * Mounted inside the route Suspense boundary, so it runs after a page has
 * actually rendered. Once the cooldown has passed it clears the guard, so the
 * next deploy gets one automatic reload again and RouteErrorBoundary offers
 * "Reload" rather than "Go home".
 */
const ChunkReloadReset = (): null => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (readChunkReloadAt() !== null && !isChunkReloadPending()) {
      clearChunkReloadFlag();
    }
  }, [pathname]);

  return null;
};

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * Scroll positions are keyed by pathname, so filter and query changes on the
 * same page (`?q=`, `?class=`) keep their scroll position while a different
 * page restores its own.
 */
const getScrollKey = (location: Location): string => location.pathname;

/**
 * Root route element: search state, skip link, app shell, the page-level
 * Suspense boundary and router scroll restoration.
 */
const RootLayout = (): JSX.Element => (
  <SearchProvider>
    <SkipLink targetId={MAIN_CONTENT_ID} />
    <AppShell>
      <Box
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        sx={{
          minWidth: 0,
          // Skip-link target only; it is never in the tab sequence.
          "&:focus, &:focus-visible": { outline: "none" },
        }}
      >
        <Suspense
          fallback={<LoadingSkeleton variant="page" label="Loading page" />}
        >
          <Outlet />
          <ChunkReloadReset />
        </Suspense>
      </Box>
    </AppShell>
    <ScrollRestoration getKey={getScrollKey} />
  </SearchProvider>
);

export default RootLayout;
