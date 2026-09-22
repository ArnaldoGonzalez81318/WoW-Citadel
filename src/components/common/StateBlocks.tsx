import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchOffRounded from "@mui/icons-material/SearchOffRounded";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useMemo } from "react";
import type { ElementType, ReactNode } from "react";

import {
  GRID_PRESETS,
  gridTemplateColumnsSx,
} from "@/components/common/gridColumns";
import type { GridColumns, GridPresetKey } from "@/components/common/gridColumns";
import { describeBlizzardError } from "@/lib/errors";
import { toSxArray } from "@/lib/sx";
import type { SxArrayEntry } from "@/lib/sx";
import { visuallyHidden as visuallyHiddenMixin } from "@/theme";

/* ------------------------------------------------------------------ */
/* LoadingSkeleton                                                     */
/* ------------------------------------------------------------------ */

export type LoadingSkeletonVariant = "grid" | "rows" | "block" | "text" | "page";

export type LoadingSkeletonProps = {
  variant: LoadingSkeletonVariant;
  /** Grid variant: the same columns as the grid it stands in for. */
  columns?: GridColumns | GridPresetKey;
  /** Grid / rows variants: the same cell height as the real items. */
  itemHeight?: number;
  /** Number of cells (grid / rows) or lines (text). */
  count?: number;
  /** Gap between cells in px. */
  gap?: number;
  /** Block variant height in px. */
  height?: number;
  /** Accessible label, announced by the status region. */
  label?: string;
  /**
   * Page variant: reserve the breadcrumb caption row that `PageHeader`
   * renders on category routes, so the swap causes no vertical shift.
   */
  breadcrumbs?: boolean;
  sx?: SxProps<Theme>;
};

const DEFAULT_GRID_COUNT = 12;
const DEFAULT_TEXT_LINES = 3;
const DEFAULT_ROW_HEIGHT = 96;
const DEFAULT_TILE_HEIGHT = 288;
const DEFAULT_BLOCK_HEIGHT = 240;
const PAGE_TILE_COUNT = 8;

const cardSkeletonSx =
  (height: number): SxArrayEntry =>
  (theme: Theme) => ({
  height,
  width: "100%",
  borderRadius: `${theme.wc.radius.lg}px`,
});

const SkeletonCells = ({
  count,
  height,
}: {
  count: number;
  height: number;
}): JSX.Element => (
  <>
    {Array.from({ length: count }, (_, index) => (
      <Skeleton
        key={index}
        variant="rectangular"
        sx={[cardSkeletonSx(height)]}
      />
    ))}
  </>
);

const TextLines = ({ count }: { count: number }): JSX.Element => (
  <Stack spacing={1}>
    {Array.from({ length: count }, (_, index) => (
      <Skeleton
        key={index}
        variant="text"
        sx={{
          fontSize: "1rem",
          width: index === count - 1 && count > 1 ? "60%" : "100%",
        }}
      />
    ))}
  </Stack>
);

/**
 * Placeholder that matches the shape of what it replaces. Grids receive the
 * same `columns`, `itemHeight` and first-page `count` as the real grid so the
 * swap causes no layout shift.
 */
export const LoadingSkeleton = ({
  variant,
  columns = GRID_PRESETS.tiles,
  itemHeight,
  count,
  gap = 16,
  height,
  label,
  breadcrumbs = false,
  sx,
}: LoadingSkeletonProps): JSX.Element => {
  const statusProps = {
    role: "status",
    "aria-label": label ?? "Loading",
    "aria-busy": true,
    "aria-live": "polite",
  } as const;

  if (variant === "grid") {
    return (
      <Box
        {...statusProps}
        sx={[
          {
            display: "grid",
            gap: `${gap}px`,
            ...gridTemplateColumnsSx(columns),
          },
          ...toSxArray(sx),
        ]}
      >
        <SkeletonCells
          count={count ?? DEFAULT_GRID_COUNT}
          height={itemHeight ?? DEFAULT_TILE_HEIGHT}
        />
      </Box>
    );
  }

  if (variant === "rows") {
    return (
      <Box
        {...statusProps}
        sx={[
          { display: "flex", flexDirection: "column", gap: `${gap}px` },
          ...toSxArray(sx),
        ]}
      >
        <SkeletonCells
          count={count ?? DEFAULT_GRID_COUNT}
          height={itemHeight ?? DEFAULT_ROW_HEIGHT}
        />
      </Box>
    );
  }

  if (variant === "text") {
    return (
      <Box {...statusProps} sx={sx}>
        <TextLines count={count ?? DEFAULT_TEXT_LINES} />
      </Box>
    );
  }

  if (variant === "page") {
    return (
      <Box
        {...statusProps}
        sx={[
          (theme) => ({
            display: "flex",
            flexDirection: "column",
            gap: {
              xs: theme.spacing(theme.wc.layout.sectionGap.xs),
              md: theme.spacing(theme.wc.layout.sectionGap.md),
            },
          }),
          ...toSxArray(sx),
        ]}
      >
        <Stack spacing={1.5}>
          {breadcrumbs ? (
            <Skeleton variant="text" sx={{ fontSize: "0.75rem", width: 180 }} />
          ) : null}
          <Skeleton variant="text" sx={{ fontSize: "0.6875rem", width: 96 }} />
          <Skeleton
            variant="text"
            sx={{ fontSize: { xs: "2rem", md: "2.75rem" }, width: "45%" }}
          />
          <Skeleton
            variant="text"
            sx={{ fontSize: "1rem", width: "min(72ch, 70%)" }}
          />
        </Stack>
        <Skeleton
          variant="rectangular"
          sx={(theme) => ({
            height: 48,
            width: "100%",
            borderRadius: `${theme.wc.radius.md}px`,
          })}
        />
        <Box
          sx={{
            display: "grid",
            gap: `${gap}px`,
            ...gridTemplateColumnsSx(columns),
          }}
        >
          <SkeletonCells
            count={count ?? PAGE_TILE_COUNT}
            height={itemHeight ?? DEFAULT_TILE_HEIGHT}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Skeleton
      {...statusProps}
      variant="rectangular"
      sx={[cardSkeletonSx(height ?? DEFAULT_BLOCK_HEIGHT), ...toSxArray(sx)]}
    />
  );
};

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export type EmptyStateProps = {
  /** A 40px icon element; defaults to a "search off" glyph. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Exactly one action (a Button or Link). */
  action?: ReactNode;
  compact?: boolean;
  /** Element for the title; `p` by default so heading levels never skip. */
  titleAs?: "h1" | "h2" | "h3" | "h4" | "p";
  sx?: SxProps<Theme>;
};

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  compact = false,
  titleAs = "p",
  sx,
}: EmptyStateProps): JSX.Element => (
  <Box
    sx={[
      (theme) => ({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1,
        minHeight: compact ? 160 : 240,
        padding: compact ? 2 : 3,
        border: `1px dashed ${theme.palette.border.default}`,
        borderRadius: `${theme.wc.radius.lg}px`,
        backgroundColor: theme.palette.surface.inset,
      }),
      ...toSxArray(sx),
    ]}
  >
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        display: "flex",
        color: theme.palette.text.secondary,
        marginBottom: 0.5,
        "& svg": { fontSize: 40 },
      })}
    >
      {icon ?? <SearchOffRounded />}
    </Box>
    <Typography variant="h5" component={titleAs} sx={{ margin: 0 }}>
      {title}
    </Typography>
    {description ? (
      <Typography
        variant="body2"
        color="text.secondary"
        component="div"
        sx={{ maxWidth: "48ch" }}
      >
        {description}
      </Typography>
    ) : null}
    {action ? <Box sx={{ marginTop: 1 }}>{action}</Box> : null}
  </Box>
);

/* ------------------------------------------------------------------ */
/* ErrorState                                                          */
/* ------------------------------------------------------------------ */

export type ErrorStateProps = {
  error: unknown;
  /** Overrides the title derived from the error. */
  title?: string;
  /** What was being loaded, e.g. "items" → "We couldn't load items." */
  context?: string;
  /** Wired to the query's `refetch`. */
  onRetry?: () => void;
  retryLabel?: string;
  /** A secondary Button or Link (e.g. "Go home"). */
  secondaryAction?: ReactNode;
  compact?: boolean;
  sx?: SxProps<Theme>;
};

export const ErrorState = ({
  error,
  title,
  context,
  onRetry,
  retryLabel = "Retry",
  secondaryAction,
  compact = false,
  sx,
}: ErrorStateProps): JSX.Element => {
  const description = useMemo(
    () => describeBlizzardError(error, context),
    [error, context],
  );
  const showRetry = Boolean(onRetry) && description.retryable;
  const hasActions = showRetry || Boolean(secondaryAction);

  return (
    <Alert
      role="alert"
      severity={description.severity}
      variant="standard"
      sx={[
        {
          padding: compact ? "8px 12px" : "12px 16px",
          "& .MuiAlert-message": { minWidth: 0, flex: 1 },
        },
        ...toSxArray(sx),
      ]}
    >
      <AlertTitle
        sx={{
          fontWeight: 700,
          marginBottom: compact ? 0.25 : 0.5,
          fontSize: compact ? "0.875rem" : "1rem",
        }}
      >
        {title ?? description.title}
      </AlertTitle>
      <Typography variant="body2" component="p" sx={{ maxWidth: "72ch" }}>
        {description.message}
      </Typography>
      {hasActions ? (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ marginTop: compact ? 1 : 1.5 }}
        >
          {showRetry ? (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<RefreshRounded />}
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          ) : null}
          {secondaryAction}
        </Stack>
      ) : null}
    </Alert>
  );
};

/* ------------------------------------------------------------------ */
/* LiveStatus                                                          */
/* ------------------------------------------------------------------ */

export type LiveStatusProps = {
  children: ReactNode;
  /** Marks the region busy while a refetch is in flight. */
  busy?: boolean;
  /** Keep the text for assistive tech only. */
  visuallyHidden?: boolean;
  component?: ElementType;
  sx?: SxProps<Theme>;
};

/** Polite live region for result summaries and infinite-scroll status. */
export const LiveStatus = ({
  children,
  busy = false,
  visuallyHidden = false,
  component = "p",
  sx,
}: LiveStatusProps): JSX.Element => (
  <Typography
    component={component}
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-busy={busy || undefined}
    variant="body2"
    color="text.secondary"
    sx={[
      { margin: 0, fontVariantNumeric: "tabular-nums" },
      visuallyHidden ? visuallyHiddenMixin : {},
      ...toSxArray(sx),
    ]}
  >
    {children}
  </Typography>
);

/* ------------------------------------------------------------------ */
/* InlineProgress                                                      */
/* ------------------------------------------------------------------ */

export type InlineProgressProps = {
  active: boolean;
  label?: string;
  sx?: SxProps<Theme>;
};

/**
 * 2px progress bar that stays in layout (visibility toggles, not mount) so
 * refetches never cause reflow.
 */
export const InlineProgress = ({
  active,
  label = "Loading",
  sx,
}: InlineProgressProps): JSX.Element => (
  <LinearProgress
    variant={active ? "indeterminate" : "determinate"}
    value={active ? undefined : 0}
    aria-label={label}
    aria-hidden={!active}
    sx={[
      {
        height: 2,
        visibility: active ? "visible" : "hidden",
      },
      ...toSxArray(sx),
    ]}
  />
);
