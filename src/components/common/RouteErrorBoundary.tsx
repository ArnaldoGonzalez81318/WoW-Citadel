import HomeRounded from "@mui/icons-material/HomeRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SystemUpdateAltRounded from "@mui/icons-material/SystemUpdateAltRounded";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Component, useEffect } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  Link as RouterLink,
  isRouteErrorResponse,
  useRouteError,
} from "react-router-dom";

import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/** Session flag that prevents a reload loop when the new bundle also fails. */
export const CHUNK_RELOAD_KEY = "wc:chunk-reload";

const CHUNK_ERROR_PATTERN =
  /dynamically imported module|Loading chunk|Importing a module script failed/i;

/** True for the errors a stale `index.html` throws after a deploy. */
export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error && CHUNK_ERROR_PATTERN.test(error.message);

const readReloadFlag = (): boolean => {
  try {
    return window.sessionStorage.getItem(CHUNK_RELOAD_KEY) !== null;
  } catch {
    return false;
  }
};

const writeReloadFlag = (): void => {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    /* private mode: reload without the guard */
  }
};

const clearReloadFlag = (): void => {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
};

const reloadPage = (): void => {
  window.location.reload();
};

const goHomeHard = (): void => {
  window.location.assign("/");
};

type FrameProps = {
  children: ReactNode;
};

/** Full-viewport frame: the root error element renders without the app shell. */
const ErrorFrame = ({ children }: FrameProps): JSX.Element => (
  <Container
    component="main"
    id="main-content"
    maxWidth="sm"
    sx={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      paddingBlock: 6,
    }}
  >
    <Box sx={{ width: "100%" }}>{children}</Box>
  </Container>
);

const GoHomeButton = (): JSX.Element => (
  <Button
    component={RouterLink}
    to="/"
    variant="outlined"
    size="small"
    startIcon={<HomeRounded />}
  >
    Go home
  </Button>
);

/**
 * Route-level `errorElement`: recovers from stale chunks after a deploy with
 * a guarded reload, shows router responses (404s) and falls back to ErrorState.
 */
export const RouteErrorBoundary = (): JSX.Element => {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);
  const alreadyReloaded = chunkError && readReloadFlag();

  useDocumentTitle(chunkError ? "Update available" : "Something went wrong");

  useEffect(() => {
    if (!chunkError) {
      console.error(error);
    }
  }, [error, chunkError]);

  if (chunkError) {
    return (
      <ErrorFrame>
        <EmptyState
          icon={<SystemUpdateAltRounded />}
          titleAs="h1"
          title="A new version is available"
          description={
            alreadyReloaded
              ? "The page could not load part of the app even after reloading. Return to the home page to pick up the latest version."
              : "WoW Citadel was updated while this page was open. Reload to load the latest version."
          }
          action={
            alreadyReloaded ? (
              <Button
                variant="contained"
                startIcon={<HomeRounded />}
                onClick={() => {
                  clearReloadFlag();
                  goHomeHard();
                }}
              >
                Go home
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<RefreshRounded />}
                onClick={() => {
                  writeReloadFlag();
                  reloadPage();
                }}
              >
                Reload
              </Button>
            )
          }
        />
      </ErrorFrame>
    );
  }

  if (isRouteErrorResponse(error)) {
    const notFound = error.status === 404;
    return (
      <ErrorFrame>
        <EmptyState
          titleAs="h1"
          title={notFound ? "Page not found" : `${error.status} ${error.statusText}`}
          description={
            notFound
              ? "That address does not match anything in the citadel."
              : typeof error.data === "string" && error.data.length > 0
                ? error.data
                : "The request could not be completed."
          }
          action={<GoHomeButton />}
        />
      </ErrorFrame>
    );
  }

  return (
    <ErrorFrame>
      <Stack spacing={2}>
        <Typography variant="h2" component="h1">
          Something went wrong
        </Typography>
        <ErrorState
          error={error}
          title="This page failed to render"
          onRetry={reloadPage}
          retryLabel="Reload"
          secondaryAction={<GoHomeButton />}
        />
      </Stack>
    </ErrorFrame>
  );
};

/* ------------------------------------------------------------------ */
/* AppErrorBoundary                                                    */
/* ------------------------------------------------------------------ */

export type AppErrorBoundaryProps = {
  children?: ReactNode;
  /** Changing this key (e.g. the pathname) clears a caught error. */
  resetKey?: string | number;
  /** Custom fallback; receives the error and a reset callback. */
  fallback?: (error: unknown, reset: () => void) => ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
  /** Sent to ErrorState as the loading context ("this section"). */
  context?: string;
};

type AppErrorBoundaryState = {
  error: unknown;
  hasError: boolean;
};

/**
 * Class boundary for subtrees inside the shell (explorers, sections). Keeps
 * the header and footer mounted while one section fails.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null, hasError: false });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, context } = this.props;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      return fallback(error, this.reset);
    }

    if (isChunkLoadError(error)) {
      return (
        <EmptyState
          icon={<SystemUpdateAltRounded />}
          title="A new version is available"
          description="WoW Citadel was updated while this page was open. Reload to load the latest version."
          action={
            <Button
              variant="contained"
              startIcon={<RefreshRounded />}
              onClick={() => {
                writeReloadFlag();
                reloadPage();
              }}
            >
              Reload
            </Button>
          }
        />
      );
    }

    return (
      <ErrorState
        error={error}
        title="Something went wrong"
        context={context}
        onRetry={this.reset}
        retryLabel="Try again"
        secondaryAction={
          <Button
            size="small"
            variant="text"
            color="inherit"
            startIcon={<RefreshRounded />}
            onClick={reloadPage}
          >
            Reload
          </Button>
        }
      />
    );
  }
}

export default RouteErrorBoundary;
