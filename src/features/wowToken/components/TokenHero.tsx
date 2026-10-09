import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import { Box, Button, Chip, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId, useMemo } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import MediaTile from "@/components/common/MediaTile";
import { ErrorState, LiveStatus } from "@/components/common/StateBlocks";
import TokenSparkline from "@/features/search/components/TokenSparkline";
import { TOKEN_REFRESH_MINUTES } from "@/features/search/hooks/useWowTokenPrice";
import { Fact, FactList } from "@/features/wowToken/components/Facts";
import PriceChange from "@/features/wowToken/components/PriceChange";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import {
  HOUR,
  STALE_AFTER_MS,
  formatClock,
  formatDateTime,
  formatDuration,
  pluralize,
  pointsInRange,
  previousPoint,
  summarize,
} from "@/features/wowToken/services/tokenStats";
import type { RegionPrice, TokenHistoryPoint } from "@/features/wowToken/types";
import { formatRelativeTime } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type TokenHeroProps = {
  /** The app's own region. */
  price: RegionPrice;
  history: readonly TokenHistoryPoint[];
  now: number;
  /** How often Blizzard republishes, and whether that was measured here. */
  cadenceMs: number;
  cadenceObserved: boolean;
  /** The token's name in the app locale ("WoW Token" until it loads). */
  itemName: string;
  iconUrl: string | null | undefined;
  iconLoading: boolean;
  gameTimeDays: number;
  onShowHistory: () => void;
};

/**
 * Price line + change line + timing lines, so the skeleton holds the same
 * height. On phones the change line, the timing row and the cadence note
 * each wrap to two or three lines, so the reservation grows with them.
 */
const BODY_MIN_HEIGHT = { xs: 224, sm: 168 } as const;
/** Within this, "Published 7:09 PM" needs no date. */
const CLOCK_ONLY_MS = 12 * HOUR;

/**
 * The app region's live price as the page's headline: the token's icon
 * over a blurred wash of itself, the price in large gold, how it moved
 * since the previous price this browser stored, when Blizzard published it
 * and when the next one is due. Beside it, the last day as this browser
 * saw it.
 */
const TokenHero = ({
  price,
  history,
  now,
  cadenceMs,
  cadenceObserved,
  itemName,
  iconUrl,
  iconLoading,
  gameTimeDays,
  onShowHistory,
}: TokenHeroProps): JSX.Element => {
  const titleId = useId();
  const { token, tag, name } = price;
  const data = token.data;
  const error = useStickyError(token);

  const current = data ? { t: data.lastUpdated.getTime(), price: data.price } : null;
  const previous = current ? previousPoint(history, current.t) : undefined;
  const lastDay = useMemo(() => pointsInRange(history, "24h", now), [history, now]);
  const dayStats = useMemo(() => summarize(lastDay), [lastDay]);

  const renderPrice = (): JSX.Element => {
    if (!data) {
      if (error) {
        return (
          <ErrorState
            compact
            error={error}
            context={`the ${tag} WoW Token price`}
            onRetry={() => void token.refetch()}
          />
        );
      }
      return (
        <Stack spacing={1.25} role="status" aria-label={`Loading the ${tag} price`} aria-busy="true">
          <Skeleton width="62%" sx={{ fontSize: { xs: "2.25rem", md: "3rem" } }} />
          <Skeleton width="48%" sx={{ fontSize: "0.9375rem" }} />
          <Skeleton width="70%" sx={{ fontSize: "0.875rem" }} />
          <Skeleton width="56%" sx={{ fontSize: "0.75rem" }} />
        </Stack>
      );
    }

    const published = data.lastUpdated.getTime();
    const updatedAt = Math.min(published, now);
    const isStale = now - updatedAt > STALE_AFTER_MS;
    const expected = published + cadenceMs;

    return (
      <Stack spacing={1.25} sx={{ minWidth: 0 }}>
        <LiveStatus component="p" busy={token.isFetching} sx={{ color: "text.primary" }}>
          <Box component="span" sx={visuallyHidden}>
            {`${tag} price: `}
          </Box>
          <GoldAmount
            copper={data.price}
            size="large"
            sx={{
              fontSize: { xs: "2.25rem", md: "3rem" },
              fontWeight: 700,
              lineHeight: 1.1,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              // A standalone figure reads better with proportional digits.
              fontVariantNumeric: "normal",
            }}
          />
        </LiveStatus>

        {previous && current ? (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
            <PriceChange from={previous.price} to={current.price} />{" "}
            {`since the previous stored price, ${formatDuration(current.t - previous.t)} earlier`}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
            The first price this browser has stored for {tag}; the change shows from the next one.
          </Typography>
        )}

        <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={1.5} rowGap={0.5} alignItems="center">
          {/* The clock time in plain text, not a hover tooltip, so keyboard and touch users get it too. */}
          <Typography
            variant="body2"
            component="time"
            dateTime={data.lastUpdated.toISOString()}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {`Published ${
              now - updatedAt < CLOCK_ONLY_MS ? formatClock(published) : formatDateTime(published)
            } (${formatRelativeTime(updatedAt, now)})`}
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
            {now < expected ? (
              <>
                {"Next expected around "}
                <time dateTime={new Date(expected).toISOString()}>{formatClock(expected)}</time>
              </>
            ) : (
              "Next price due any minute"
            )}
          </Typography>
          {isStale ? (
            <Chip size="small" color="warning" variant="outlined" label="Stale" />
          ) : null}
        </Stack>

        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          {cadenceObserved
            ? `Blizzard republished about every ${formatDuration(cadenceMs)} in the prices stored here; this page checks every ${TOKEN_REFRESH_MINUTES} minutes.`
            : `Blizzard republishes roughly every ${formatDuration(cadenceMs)} (it publishes no schedule); this page checks every ${TOKEN_REFRESH_MINUTES} minutes.`}
          {isStale
            ? ` No new price for ${formatDuration(now - updatedAt)}, longer than usual.`
            : ""}
        </Typography>

        {/* A failed poll keeps the last price on screen; say so once. */}
        {token.isError ? (
          <ErrorState
            compact
            error={token.error}
            context={`a newer ${tag} price`}
            onRetry={() => void token.refetch()}
          />
        ) : null}
      </Stack>
    );
  };

  const renderLastDay = (): JSX.Element => {
    if (dayStats && lastDay.length >= 2) {
      return (
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <TokenSparkline points={[...lastDay]} height={72} />
          <FactList columns={{ xs: 2 }}>
            <Fact
              label="Low"
              value={<GoldAmount copper={dayStats.low.price} size="large" />}
              note={formatClock(dayStats.low.t)}
            />
            <Fact
              label="High"
              value={<GoldAmount copper={dayStats.high.price} size="large" />}
              note={formatClock(dayStats.high.t)}
            />
          </FactList>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            {`${pluralize(dayStats.count, "price", "prices")} since ${formatDateTime(dayStats.first.t)}.`}
          </Typography>
        </Stack>
      );
    }
    return (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        {history.length > 0
          ? `${pluralize(history.length, "price", "prices")} stored so far. A trend shows here once this browser has two from the last 24 hours.`
          : "A trend shows here once this browser has stored two prices from the last 24 hours."}
      </Typography>
    );
  };

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={titleId}
      sx={(theme) => ({
        position: "relative",
        overflow: "hidden",
        minWidth: 0,
        borderRadius: `${theme.wc.radius.lg}px`,
        borderColor: theme.palette.border.gold,
        backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${alpha(
          theme.palette.secondary.main,
          0.1,
        )}, transparent 60%)`,
      })}
    >
      {iconUrl ? (
        // Blizzard's icons top out at 56px: blurred, it still lends the card its colour.
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: -48,
            right: -48,
            width: 280,
            height: 280,
            pointerEvents: "none",
            maskImage: "radial-gradient(circle, #000 0%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 70%)",
          }}
        >
          <Box
            component="img"
            src={iconUrl}
            alt=""
            decoding="async"
            sx={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(32px) saturate(1.3)", opacity: 0.35 }}
          />
        </Box>
      ) : null}

      <Box
        sx={{
          position: "relative",
          display: "grid",
          gap: { xs: 3, md: 4 },
          p: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 3fr) minmax(0, 2fr)" },
        }}
      >
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={2} useFlexGap alignItems="center" sx={{ minWidth: 0 }}>
            <MediaTile
              size={56}
              src={iconUrl}
              alt=""
              fallbackLabel={itemName}
              loading={iconLoading}
              radius="md"
              sx={(theme) => ({ boxShadow: theme.palette.glow.card, borderColor: theme.palette.border.gold })}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                component="p"
                sx={{ m: 0, lineHeight: 1.5, color: "secondary.main" }}
              >
                {itemName}
              </Typography>
              <Typography id={titleId} variant="h5" component="h2" sx={{ m: 0, overflowWrap: "anywhere" }}>
                {`Price in ${name ?? tag}`}
              </Typography>
            </Box>
            <Chip
              size="small"
              color="primary"
              label="This site's region"
              sx={{ ml: "auto", display: { xs: "none", sm: "inline-flex" }, flexShrink: 0 }}
            />
          </Stack>

          <Box sx={{ minHeight: BODY_MIN_HEIGHT, minWidth: 0 }}>{renderPrice()}</Box>

          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              endIcon={<ArrowDownwardRoundedIcon />}
              onClick={onShowHistory}
            >
              Price history
              <Box component="span" sx={visuallyHidden}>
                {` for ${tag}`}
              </Box>
            </Button>
            {data ? (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                {"About "}
                <GoldAmount copper={Math.round(data.price / gameTimeDays)} size="small" />
                {" per day of game time"}
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        <Box
          sx={(theme) => ({
            minWidth: 0,
            alignSelf: "start",
            p: 2,
            borderRadius: `${theme.wc.radius.md}px`,
            border: `1px solid ${theme.palette.border.subtle}`,
            backgroundColor: alpha(theme.palette.background.default, 0.55),
          })}
        >
          <Typography variant="overline" component="h3" color="text.secondary" sx={{ m: 0, lineHeight: 1.6 }}>
            Last 24 hours in this browser
          </Typography>
          <Box sx={{ mt: 1 }}>{renderLastDay()}</Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default TokenHero;
