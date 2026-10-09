import MonetizationOnRounded from "@mui/icons-material/MonetizationOnRounded";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import StripCard, {
  StripCardError,
  StripCardSkeleton,
} from "@/features/home/components/StripCard";
import { HOME_PATHS } from "@/features/home/config/homeLinks";
import { regionTokenQuery } from "@/features/regions/hooks/regionQueries";
import TokenSparkline from "@/features/search/components/TokenSparkline";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import {
  useRecordTokenSamples,
  useTokenHistories,
} from "@/features/wowToken/hooks/useTokenHistories";
import {
  STALE_AFTER_MS,
  changeRatio,
  formatSignedPercent,
  pointsInRange,
} from "@/features/wowToken/services/tokenStats";
import { env } from "@/lib/env";
import { formatRelativeTime } from "@/lib/format";

const ID = "home-week-token";
const TAG = env.region.toUpperCase();
const OVERLINE = `WoW Token · ${TAG}`;
const SPARKLINE_HEIGHT = 32;
/** A small Chip's height (theme): the Stale chip's row keeps it, shown or not. */
const CHIP_ROW_HEIGHT = 24;

/**
 * The configured region's WoW Token price. It reads the Regions and WoW
 * Token pages' own entry (`["wow-token-price", region]`, one 0.15 KB
 * request polled every few minutes), and records each new Blizzard sample
 * into the history the token page charts, so home visits grow it too.
 *
 * The price is deliberately not a live region: a poll that announced
 * itself unprompted on a landing page would be noise, and the WoW Token
 * page is where people watch it. A failed poll keeps the last price, under
 * the Stale chip once it is old enough.
 */
const TokenCard = ({ now }: { now: number }): JSX.Element => {
  const token = useQuery({ ...regionTokenQuery(env.region), refetchOnWindowFocus: true });
  const tokenError = useStickyError(token);
  const histories = useTokenHistories();
  // Same shape as the WoW Token page's list; the store dedupes on Blizzard's timestamp.
  useRecordTokenSamples([
    { region: env.region, isHome: true, tag: TAG, name: null, token },
  ]);

  const lastDay = useMemo(
    () => pointsInRange(histories[env.region], "24h", now),
    [histories, now],
  );

  const data = token.data;
  if (!data) {
    if (tokenError) {
      return (
        <StripCardError
          id={ID}
          icon={<MonetizationOnRounded />}
          overline={OVERLINE}
          tone="gold"
          error={tokenError}
          context="the WoW Token price"
          onRetry={() => void token.refetch()}
          linkLabel="Open WoW Token"
          to={HOME_PATHS.wowToken}
        />
      );
    }
    return <StripCardSkeleton label="Loading the WoW Token price" />;
  }

  const published = data.lastUpdated.getTime();
  // Never "in 1 minute" when this machine's clock runs a little slow.
  const updatedAt = Math.min(published, now);
  const isStale = now - updatedAt > STALE_AFTER_MS;
  const first = lastDay[0];
  const last = lastDay[lastDay.length - 1];
  const ratio = lastDay.length >= 2 ? changeRatio(first.price, last.price) : null;

  return (
    <StripCard
      id={ID}
      icon={<MonetizationOnRounded />}
      overline={OVERLINE}
      tone="gold"
      wrapTitle
      title={
        <GoldAmount
          copper={data.price}
          size="large"
          sx={{
            fontSize: { xs: "1.5rem", md: "1.75rem" },
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}
        />
      }
      details={
        // Every row is reserved whether or not it has anything yet (the
        // chip, the line), so the card is one height on a first visit and a
        // return one, and the strip's frames can match it (StripCard).
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
            sx={{ minHeight: CHIP_ROW_HEIGHT }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              component="time"
              dateTime={data.lastUpdated.toISOString()}
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {`Published ${formatRelativeTime(updatedAt, now)}`}
            </Typography>
            {isStale ? (
              <Chip size="small" color="warning" variant="outlined" label="Stale" />
            ) : null}
          </Stack>
          {lastDay.length >= 2 ? (
            <>
              {/* The line is decoration; the change it shows is the text under it. */}
              <Box aria-hidden="true" sx={{ minWidth: 0 }}>
                <TokenSparkline points={[...lastDay]} height={SPARKLINE_HEIGHT} />
              </Box>
              <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>
                {`Last 24 h in this browser${ratio !== null ? `: ${formatSignedPercent(ratio)}` : ""}`}
              </Typography>
            </>
          ) : (
            <>
              {/* Where the line will be drawn: a faint rule, decoration only. */}
              <Box
                aria-hidden="true"
                sx={{ height: SPARKLINE_HEIGHT, display: "flex", alignItems: "center" }}
              >
                <Box sx={{ width: "100%", borderTop: "1px dashed", borderColor: "divider" }} />
              </Box>
              <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>
                Trend builds as this browser records prices
              </Typography>
            </>
          )}
        </Stack>
      }
      cue="Price history"
      to={HOME_PATHS.wowToken}
    />
  );
};

export default TokenCard;
