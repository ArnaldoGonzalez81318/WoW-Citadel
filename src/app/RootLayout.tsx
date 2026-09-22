import { Box } from "@mui/material";
import { Suspense, useEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";

import {
  clearChunkReloadFlag,
  isChunkReloadPending,
  readChunkReloadAt,
} from "@/app/chunkReload";
import { AppErrorBoundary } from "@/components/common/RouteErrorBoundary";
import SkipLink from "@/components/common/SkipLink";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import AppShell from "@/components/layout/AppShell";
import { MAIN_PADDING_TOP } from "@/components/layout/layoutMetrics";
import { SearchProvider } from "@/features/search/context/SearchContext";

/** id of the skip-link target; the shell must not reuse it. */
const MAIN_CONTENT_ID = "main-content";

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
 * Root route element: search state, skip link, app shell, the page-level
 * Suspense and error boundaries, and router scroll restoration.
 *
 * `AppErrorBoundary` sits inside the shell so a page render error or a stale
 * lazy chunk keeps the header and footer mounted; it resets on navigation.
 * The router's root `errorElement` remains the fallback for errors thrown by
 * this layout itself.
 *
 * Scroll positions are keyed per history entry (the router default), so a
 * new navigation to a page always starts at the top and only Back/Forward
 * restore a saved position. Filter and query changes on the same page
 * (`?q=`, `?class=`) keep their scroll position because `useSearchParamState`
 * navigates with `preventScrollReset`; keying by pathname instead would
 * replay a stale position on every later visit to that page.
 */
const RootLayout = (): JSX.Element => {
  const { pathname } = useLocation();

  return (
    <SearchProvider>
      <SkipLink targetId={MAIN_CONTENT_ID} />
      <AppShell>
        <Box
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          sx={(theme) => ({
            minWidth: 0,
            // The skip link focuses this box; keep it clear of the sticky
            // header (plus main's top padding) when the browser scrolls to it.
            scrollMarginTop: {
              xs: `calc(${theme.wc.layout.headerHeight.xs}px + ${theme.spacing(
                MAIN_PADDING_TOP.xs,
              )})`,
              md: `calc(${theme.wc.layout.headerHeight.md}px + ${theme.spacing(
                MAIN_PADDING_TOP.md,
              )})`,
            },
            // Skip-link target only; it is never in the tab sequence.
            "&:focus, &:focus-visible": { outline: "none" },
          })}
        >
          <AppErrorBoundary resetKey={pathname} context="this page">
            <Suspense
              fallback={<LoadingSkeleton variant="page" label="Loading page" />}
            >
              <Outlet />
              <ChunkReloadReset />
            </Suspense>
          </AppErrorBoundary>
        </Box>
      </AppShell>
      <ScrollRestoration />
    </SearchProvider>
  );
};

export default RootLayout;
