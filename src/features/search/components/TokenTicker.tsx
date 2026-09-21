import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import MonetizationOnRounded from "@mui/icons-material/MonetizationOnRounded";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import GoldAmount from "@/components/common/GoldAmount";
import {
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import {
  TOKEN_REFRESH_MINUTES,
  useWowTokenPrice,
} from "@/features/search/hooks/useWowTokenPrice";
import { env } from "@/lib/env";
import { formatRelativeTime } from "@/lib/format";

export interface TokenTickerProps {
  /** Home variant: smaller padding, a "Price history" link, fewer chips. */
  compact?: boolean;
  /**
   * Element for the "WoW Token" label: a section heading on the home page,
   * a plain paragraph on /category/wow-token where the route's h1 already
   * says the same thing.
   */
  titleAs?: "h2" | "h3" | "p";
}

const WOW_TOKEN_PATH = "/category/wow-token";
/** Re-render cadence for "Updated N min ago" (no refetch involved). */
const CLOCK_TICK_MS = 30_000;
/** Blizzard publishes roughly every 20 minutes; past this the price is suspect. */
const STALE_AFTER_MS = 30 * 60_000;

/** Wall-clock `now`, ticked every 30s so relative times keep advancing. */
const useNow = (): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return now;
};

/**
 * The live regional WoW Token price: whole gold via GoldAmount, Blizzard's
 * own "last updated" time as a live relative label, and the refresh cadence
 * read from the query config so the copy can never drift.
 */
const TokenTicker = ({
  compact = false,
  titleAs = "h2",
}: TokenTickerProps): JSX.Element => {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useWowTokenPrice();
  const now = useNow();

  const isStale =
    data !== undefined && now - data.lastUpdated.getTime() > STALE_AFTER_MS;

  const renderBody = (): JSX.Element => {
    if (isLoading) {
      return (
        <LoadingSkeleton
          variant="block"
          height={compact ? 96 : 140}
          label="Loading WoW Token price"
        />
      );
    }

    if (isError || !data) {
      return (
        <ErrorState
          compact
          error={error}
          context="WoW Token"
          onRetry={() => {
            void refetch();
          }}
        />
      );
    }

    const iso = data.lastUpdated.toISOString();

    return (
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        <LiveStatus
          component="p"
          busy={isFetching}
          sx={{ color: "text.primary" }}
        >
          <GoldAmount
            copper={data.price}
            size="large"
            sx={{
              fontSize: { xs: "1.75rem", md: "2rem" },
              fontWeight: 700,
              lineHeight: 1.15,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
            }}
          />
        </LiveStatus>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
        >
          <Tooltip title={data.lastUpdated.toLocaleString()}>
            <Typography
              variant="body2"
              color="text.secondary"
              component="time"
              dateTime={iso}
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              Updated {formatRelativeTime(data.lastUpdated, now)}
            </Typography>
          </Tooltip>
          {isStale ? (
            <Chip size="small" color="warning" variant="outlined" label="Stale" />
          ) : null}
          {compact ? null : (
            <>
              <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
              <Chip
                size="small"
                variant="outlined"
                label={`Auto-refreshes every ${TOKEN_REFRESH_MINUTES} min`}
              />
            </>
          )}
        </Stack>
      </Stack>
    );
  };

  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        borderRadius: `${theme.wc.radius.lg}px`,
        p: compact ? 2 : 2.5,
      })}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={(theme) => ({
                width: theme.wc.layout.iconTile,
                height: theme.wc.layout.iconTile,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: `${theme.wc.radius.md}px`,
                bgcolor: alpha(theme.palette.secondary.main, 0.12),
                border: `1px solid ${theme.palette.border.gold}`,
                "& svg": { fontSize: 28 },
              })}
            >
              <MonetizationOnRounded color="secondary" />
            </Box>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                component={titleAs}
                sx={{ color: "secondary.main", margin: 0, lineHeight: 1.4 }}
              >
                WoW Token
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Live regional price from Blizzard&apos;s game-data API.
              </Typography>
            </Stack>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            {compact ? (
              <Button
                component={RouterLink}
                to={WOW_TOKEN_PATH}
                variant="text"
                size="small"
                endIcon={<ArrowForwardRounded />}
              >
                Price history
              </Button>
            ) : null}
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                void refetch();
              }}
              loading={isFetching}
              loadingPosition="start"
              startIcon={<AutorenewRounded />}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        {renderBody()}
      </Stack>
    </Paper>
  );
};

export default TokenTicker;
