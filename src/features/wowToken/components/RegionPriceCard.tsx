import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import { Box, Button, Card, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import { ErrorState } from "@/components/common/StateBlocks";
import TokenSparkline from "@/features/search/components/TokenSparkline";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import {
  STALE_AFTER_MS,
  changeRatio,
  formatSignedPercent,
  pluralize,
  pointsInRange,
} from "@/features/wowToken/services/tokenStats";
import type { RegionPrice, TokenHistoryPoint } from "@/features/wowToken/types";
import { formatRelativeTime } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type RegionRank = "lowest" | "highest" | null;

export type RegionPriceCardProps = {
  price: RegionPrice;
  history: readonly TokenHistoryPoint[];
  now: number;
  /** The dearest loaded price, which fills the bar; undefined until one loads. */
  maxPrice: number | undefined;
  /** The app region's price and tag, for the "vs US" line. */
  homePrice: number | undefined;
  homeTag: string;
  rank: RegionRank;
  /** The region on the history chart below. */
  selected: boolean;
  onShowHistory: (price: RegionPrice) => void;
};

const SPARKLINE_HEIGHT = 40;

/**
 * One region's token: its tag and name, the price, a bar against the
 * dearest region, how it compares with the app's own region, and the last
 * day of prices this browser stored for it. Each card loads and fails on
 * its own, with its own Retry.
 */
const RegionPriceCard = ({
  price,
  history,
  now,
  maxPrice,
  homePrice,
  homeTag,
  rank,
  selected,
  onShowHistory,
}: RegionPriceCardProps): JSX.Element => {
  const titleId = useId();
  const { tag, name, isHome, token } = price;
  const data = token.data;
  const error = useStickyError(token);
  const lastDay = pointsInRange(history, "24h", now);

  const updatedAt = data ? Math.min(data.lastUpdated.getTime(), now) : 0;
  const isStale = data !== undefined && now - updatedAt > STALE_AFTER_MS;
  const share = data && maxPrice ? Math.min(1, data.price / maxPrice) : 0;
  const versusHome =
    data && homePrice !== undefined && !isHome ? changeRatio(homePrice, data.price) : null;

  return (
    <Card
      component="article"
      variant="outlined"
      aria-labelledby={titleId}
      sx={(theme) => ({
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        // A border, not a glow ring: a ring would read as keyboard focus.
        borderColor: selected ? theme.palette.primary.main : undefined,
        transition: theme.transitions.create("border-color"),
      })}
    >
      <Stack spacing={1.75} useFlexGap sx={{ p: 2, flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1.5} useFlexGap alignItems="center" sx={{ minWidth: 0 }}>
          {/* The heading names the region; the tag tile is decoration. */}
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              flexShrink: 0,
              width: 48,
              height: 48,
              display: "grid",
              placeItems: "center",
              borderRadius: `${theme.wc.radius.md}px`,
              fontWeight: 800,
              fontSize: "1.0625rem",
              letterSpacing: "0.06em",
              color: isHome ? theme.palette.primary.light : theme.palette.text.primary,
              backgroundColor: isHome
                ? alpha(theme.palette.primary.main, 0.14)
                : theme.palette.surface.sunken,
              border: `1px solid ${isHome ? alpha(theme.palette.primary.main, 0.5) : theme.palette.border.default}`,
            })}
          >
            {tag}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              id={titleId}
              variant="subtitle1"
              component="h3"
              sx={{ m: 0, fontWeight: 700, overflowWrap: "anywhere", lineHeight: 1.3 }}
            >
              {name ?? tag}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              {isHome ? `${tag} · This site's region` : tag}
            </Typography>
          </Box>
          {rank ? (
            <Chip
              size="small"
              variant="outlined"
              color={rank === "highest" ? "secondary" : "default"}
              label={rank === "highest" ? "Highest" : "Lowest"}
              sx={{ flexShrink: 0 }}
            />
          ) : null}
        </Stack>

        <Box sx={{ minWidth: 0 }}>
          {data ? (
            <GoldAmount
              copper={data.price}
              size="large"
              component="p"
              sx={{ m: 0, fontSize: "1.5rem", fontWeight: 700, whiteSpace: "normal", overflowWrap: "anywhere" }}
            />
          ) : error ? null : (
            <Skeleton width="70%" sx={{ fontSize: "1.5rem" }} />
          )}
          {/* The bar restates the price against the dearest region; the
              figures around it carry the meaning, so it is hidden. */}
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              mt: 1,
              height: 6,
              borderRadius: 3,
              overflow: "hidden",
              backgroundColor: alpha(theme.palette.secondary.main, 0.12),
            })}
          >
            <Box
              sx={(theme) => ({
                height: "100%",
                width: `${(share * 100).toFixed(1)}%`,
                borderRadius: 3,
                backgroundColor: theme.palette.secondary.main,
                transition: theme.transitions.create("width"),
              })}
            />
          </Box>
        </Box>

        <Box sx={{ minHeight: 40, minWidth: 0 }}>
          {data ? (
            <>
              <Typography variant="body2" component="p" sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}>
                {isHome
                  ? "The baseline for the other regions"
                  : versusHome === null
                    ? " "
                    : versusHome === 0
                      ? `Same as ${homeTag}`
                      : `${formatSignedPercent(versusHome)} vs ${homeTag}`}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap alignItems="center" flexWrap="wrap">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="time"
                  dateTime={data.lastUpdated.toISOString()}
                >
                  {`Published ${formatRelativeTime(updatedAt, now)}`}
                </Typography>
                {isStale ? (
                  <Chip size="small" color="warning" variant="outlined" label="Stale" sx={{ height: 20 }} />
                ) : null}
              </Stack>
            </>
          ) : error ? null : (
            <>
              <Skeleton width="55%" sx={{ fontSize: "0.875rem" }} />
              <Skeleton width="40%" sx={{ fontSize: "0.75rem" }} />
            </>
          )}
        </Box>

        {!data && error ? (
          <ErrorState
            compact
            error={error}
            context={`the ${tag} WoW Token price`}
            onRetry={() => void token.refetch()}
          />
        ) : null}
        {/* A failed poll keeps the last price on screen; say so here, except
            for the app's own region, whose hero above already does. The
            query stays in error while a Retry runs, so the button stays put. */}
        {data && token.isError && !isHome ? (
          <ErrorState
            compact
            error={token.error}
            context={`a newer ${tag} price`}
            onRetry={() => void token.refetch()}
          />
        ) : null}

        <Box sx={{ minWidth: 0 }}>
          {lastDay.length >= 2 ? (
            <TokenSparkline points={[...lastDay]} height={SPARKLINE_HEIGHT} />
          ) : (
            <Box
              sx={(theme) => ({
                height: SPARKLINE_HEIGHT,
                display: "flex",
                alignItems: "center",
                px: 1.25,
                borderRadius: `${theme.wc.radius.sm}px`,
                border: `1px dashed ${theme.palette.border.default}`,
              })}
            >
              <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                {history.length === 0
                  ? "No prices stored here yet"
                  : `${pluralize(lastDay.length, "price", "prices")} stored in the last 24 hours`}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ mt: "auto" }}>
          <Button
            size="small"
            variant={selected ? "contained" : "outlined"}
            endIcon={<ArrowDownwardRoundedIcon />}
            onClick={() => onShowHistory(price)}
          >
            Price history
            <Box component="span" sx={visuallyHidden}>
              {` for ${name ?? tag}${selected ? " (on the chart)" : ""}`}
            </Box>
          </Button>
        </Box>
      </Stack>
    </Card>
  );
};

export default RegionPriceCard;
