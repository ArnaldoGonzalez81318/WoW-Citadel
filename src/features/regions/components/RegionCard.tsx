import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import {
  Box,
  Button,
  Card,
  Chip,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useId } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import GoldAmount from "@/components/common/GoldAmount";
import MediaTile from "@/components/common/MediaTile";
import { ErrorState } from "@/components/common/StateBlocks";
import Unavailable from "@/features/regions/components/Unavailable";
import type { RegionColumn } from "@/features/regions/hooks/useRegionOverview";
import type { Region } from "@/features/regions/types";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type RegionCardProps = {
  column: RegionColumn;
  /** The page's ticking clock, so every card's "Updated …" advances together. */
  now: number;
  tokenIconUrl: string | null | undefined;
  tokenIconLoading: boolean;
  onShowMakeup: (region: Region) => void;
};

/** Where the Realms explorer lives; it only covers the app's own region. */
const REALMS_PATH = "/category/realm";
/** Blizzard publishes roughly every 20 minutes; past this the price is suspect. */
const STALE_AFTER_MS = 30 * 60_000;
const BANNER_HEIGHT = 96;
/** Graticule spacing of the banner's map grid. */
const GRID_STEP = 24;

/**
 * The banner stands in for art Blizzard does not publish for regions: the
 * tag over a faint map graticule, lit in the brand blue for the app's own
 * region.
 */
const bannerSx = (isHome: boolean) => (theme: Theme) => {
  const line = theme.palette.border.subtle;
  const glow = isHome
    ? alpha(theme.palette.primary.main, 0.38)
    : alpha(theme.palette.text.secondary, 0.14);
  return {
    position: "relative" as const,
    height: BANNER_HEIGHT,
    flexShrink: 0,
    overflow: "hidden",
    backgroundColor: theme.palette.surface.sunken,
    backgroundImage: [
      `radial-gradient(circle at 85% 130%, ${glow}, transparent 65%)`,
      `repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px ${GRID_STEP}px)`,
      `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px ${GRID_STEP}px)`,
    ].join(", "),
    borderBottom: `1px solid ${theme.palette.border.subtle}`,
  };
};

const Fact = ({
  label,
  loading,
  value,
}: {
  label: string;
  loading: boolean;
  value: ReactNode;
}): JSX.Element => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      component="dt"
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", lineHeight: 1.4 }}
    >
      {label}
    </Typography>
    <Typography
      component="dd"
      variant="subtitle1"
      sx={{ m: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
    >
      {loading ? <Skeleton width={48} /> : value}
    </Typography>
  </Box>
);

/** "the WoW Token price and realm counts" */
const joinParts = (parts: string[]): string =>
  parts.length <= 1
    ? parts.join("")
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/**
 * One API region: its name, tag and Blizzard id, the live WoW Token price
 * there, and how many connected realms and realm records its indexes list.
 * Each fact loads on its own; whatever failed is named once at the bottom
 * with a single Retry for all of it.
 */
const RegionCard = ({
  column,
  now,
  tokenIconUrl,
  tokenIconLoading,
  onShowMakeup,
}: RegionCardProps): JSX.Element => {
  const { region, isHome, tag, record, token, counts, makeup } = column;
  const titleId = useId();
  const data = record.data;
  const price = token.data;

  // Only what is missing counts as failed: a background refetch that fails
  // (the token polls) keeps the last value on screen, and "Stale" flags it.
  const failed = [
    { label: "region record", query: record },
    { label: "WoW Token price", query: token },
    { label: "realm counts", query: counts },
  ].filter(({ query }) => query.isError && query.data === undefined);

  const caption = (() => {
    if (record.isPending) {
      return null;
    }
    if (data) {
      return `${data.tag} · Region ${formatNumber(data.id)}`;
    }
    return record.isError
      ? `${tag} · Region record unavailable`
      : `${tag} · Blizzard lists no region record`;
  })();

  const updatedAt = price ? Math.min(price.lastUpdated.getTime(), now) : 0;
  const isStale = price !== undefined && now - updatedAt > STALE_AFTER_MS;

  const realmsNote = makeup.data
    ? `${formatNumber(makeup.data.realms)} sit in connected realms; the rest are Blizzard's internal servers.`
    : "Includes Blizzard's internal servers, which host no characters.";

  return (
    <Card
      component="article"
      variant="outlined"
      aria-labelledby={titleId}
      sx={(theme) => ({
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        // A border, not a glow ring: a ring would read as keyboard focus.
        borderColor: isHome ? theme.palette.primary.main : undefined,
      })}
    >
      <Box sx={bannerSx(isHome)}>
        <PublicRoundedIcon
          aria-hidden="true"
          sx={(theme) => ({
            position: "absolute",
            right: -20,
            bottom: -36,
            fontSize: 132,
            color: alpha(theme.palette.text.primary, 0.08),
          })}
        />
        {/* The heading below names the region; the big tag is decoration. */}
        <Typography
          aria-hidden="true"
          component="span"
          sx={(theme) => ({
            position: "absolute",
            left: 16,
            bottom: 10,
            fontSize: "2.75rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
            lineHeight: 1,
            color: isHome
              ? theme.palette.primary.light
              : alpha(theme.palette.text.primary, 0.82),
          })}
        >
          {tag}
        </Typography>
      </Box>

      <Stack spacing={2} useFlexGap sx={{ p: 2, flex: 1, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id={titleId}
            variant="h5"
            component="h3"
            sx={{ m: 0, overflowWrap: "anywhere" }}
          >
            {record.isPending ? (
              <>
                <Skeleton width="70%" />
                <Box component="span" sx={visuallyHidden}>
                  {tag}
                </Box>
              </>
            ) : (
              (data?.name ?? tag)
            )}
          </Typography>
          {record.isPending ? (
            <Skeleton width="45%" sx={{ fontSize: "0.75rem" }} />
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ m: 0 }}
            >
              {caption}
            </Typography>
          )}
        </Box>

        {/* After the heading in reading order, pinned to the banner's corner. */}
        {isHome ? (
          <Chip
            size="small"
            color="primary"
            label="This site's region"
            sx={{ position: "absolute", top: 12, right: 12 }}
          />
        ) : null}

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <MediaTile
            size={40}
            src={tokenIconUrl}
            alt=""
            fallbackLabel="WoW Token"
            loading={tokenIconLoading}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="overline"
              component="p"
              color="text.secondary"
              sx={{ m: 0, lineHeight: 1.5 }}
            >
              WoW Token
            </Typography>
            {token.isPending ? (
              <Skeleton width={128} sx={{ fontSize: "1.125rem" }} />
            ) : price ? (
              <GoldAmount
                copper={price.price}
                size="large"
                component="p"
                sx={{ m: 0, fontWeight: 700, whiteSpace: "normal", overflowWrap: "anywhere" }}
              />
            ) : (
              <Typography variant="subtitle1" component="p" sx={{ m: 0 }}>
                <Unavailable />
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Reserved line, so the facts below never jump when the time lands. */}
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ minHeight: 24, mt: -1 }}
        >
          {price ? (
            <>
              <Tooltip title={price.lastUpdated.toLocaleString()} describeChild>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="time"
                  dateTime={price.lastUpdated.toISOString()}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  Updated {formatRelativeTime(updatedAt, now)}
                </Typography>
              </Tooltip>
              {isStale ? (
                <Chip size="small" color="warning" variant="outlined" label="Stale" />
              ) : null}
            </>
          ) : token.isPending ? (
            <Skeleton width={110} sx={{ fontSize: "0.75rem" }} />
          ) : null}
        </Stack>

        <Box
          component="dl"
          sx={{
            m: 0,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            columnGap: 1.5,
            rowGap: 1,
          }}
        >
          <Fact
            label="Patch"
            loading={record.isPending}
            value={data?.patch ?? <Unavailable />}
          />
          <Fact
            label="Connected realms"
            loading={counts.isPending}
            value={counts.data ? formatNumber(counts.data.connectedRealms) : <Unavailable />}
          />
          <Fact
            label="Realms listed"
            loading={counts.isPending}
            value={counts.data ? formatNumber(counts.data.realms) : <Unavailable />}
          />
        </Box>
        {counts.data ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mt: -1 }}>
            {realmsNote}
          </Typography>
        ) : null}

        {failed.length > 0 ? (
          <ErrorState
            compact
            error={failed[0].query.error}
            context={`${tag}'s ${joinParts(failed.map((entry) => entry.label))}`}
            onRetry={() => failed.forEach((entry) => void entry.query.refetch())}
          />
        ) : null}

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ mt: "auto", pt: 0.5 }}
        >
          <Button
            size="small"
            variant="outlined"
            endIcon={<ArrowDownwardRoundedIcon />}
            onClick={() => onShowMakeup(region)}
          >
            Realm makeup
            <Box component="span" sx={visuallyHidden}>
              {` of ${data?.name ?? tag}`}
            </Box>
          </Button>
          {isHome ? (
            <Button size="small" variant="text" component={RouterLink} to={REALMS_PATH}>
              Browse realms
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Card>
  );
};

export default RegionCard;
