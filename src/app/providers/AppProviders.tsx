import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { BlizzardRequestError } from "@/lib/blizzardClient";
import { isAbortError } from "@/lib/errors";
import theme from "@/theme";

const STALE_TIME_MS = 5 * 60_000;
const GC_TIME_MS = 30 * 60_000;
const MAX_RETRIES = 2;
const MAX_BACKOFF_MS = 8_000;
/**
 * A `Retry-After` longer than this (hourly quota) is surfaced right away as a
 * "Rate limit reached" error instead of leaving the query pending for it.
 */
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * Retry transient failures only: network errors, timeouts (status 0), 5xx
 * and 429. Cancellations and 4xx (credentials, not found, bad request) fail
 * immediately so the UI shows the real error instead of waiting.
 */
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= MAX_RETRIES || isAbortError(error)) {
    return false;
  }

  if (error instanceof BlizzardRequestError) {
    if (error.status < 500 && error.status !== 429 && error.status !== 0) {
      return false;
    }
    if (
      error.retryAfterMs !== undefined &&
      error.retryAfterMs > MAX_RETRY_AFTER_MS
    ) {
      return false;
    }
  }

  return true;
};

/** Honour `Retry-After` when Blizzard sends one, else exponential backoff. */
const retryDelay = (failureCount: number, error: unknown): number => {
  if (error instanceof BlizzardRequestError && error.retryAfterMs) {
    return Math.min(error.retryAfterMs, MAX_RETRY_AFTER_MS);
  }
  return Math.min(1000 * 2 ** failureCount, MAX_BACKOFF_MS);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      refetchOnWindowFocus: false,
      throwOnError: false,
      retry: shouldRetry,
      retryDelay,
    },
  },
});

const AppProviders = ({ children }: PropsWithChildren): JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  </QueryClientProvider>
);

export default AppProviders;
