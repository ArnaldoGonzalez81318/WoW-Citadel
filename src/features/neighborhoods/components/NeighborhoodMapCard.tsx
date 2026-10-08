import HolidayVillageRoundedIcon from "@mui/icons-material/HolidayVillageRounded";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";

import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/neighborhoods/components/cardStyles";
import MapBanner from "@/features/neighborhoods/components/MapBanner";
import { mapFaction } from "@/features/neighborhoods/config/neighborhoodMaps";
import { newestInMapQuery } from "@/features/neighborhoods/hooks/neighborhoodQueries";
import type { NeighborhoodMap } from "@/features/neighborhoods/types";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import { formatNumber } from "@/lib/format";
import { mixins, visuallyHidden } from "@/theme";

/** Banner (3:1) plus the text block: what the loading grid reserves per card. */
export const MAP_CARD_TEXT_HEIGHT = 112;

export type NeighborhoodMapCardProps = {
  map: NeighborhoodMap;
  selected: boolean;
  /** The region's newest number: undefined while it is being found. */
  newestNumber: number | undefined;
  /** The newest-number search failed (the register shows that error and its Retry). */
  newestFailed: boolean;
  onSelect: (mapId: number) => void;
};

/**
 * One neighborhood map: its drawn banner, name and faction, and the newest
 * neighborhood founded on it. A toggle button (aria-pressed) in a set of
 * them: the pressed card is the map the register below browses.
 */
const NeighborhoodMapCard = ({
  map,
  selected,
  newestNumber,
  newestFailed,
  onSelect,
}: NeighborhoodMapCardProps): JSX.Element => {
  const queryClient = useQueryClient();
  const hasNewest = newestNumber !== undefined && newestNumber > 0;
  const newestQuery = useQuery({
    ...newestInMapQuery(queryClient, map.id, newestNumber ?? 0),
    enabled: hasNewest,
    // A later search that finds newer numbers keeps the last answer up
    // until the new one lands, instead of blanking the line.
    placeholderData: keepPreviousData,
  });
  const newest = newestQuery.data;
  const faction = mapFaction(map.id);
  const baseId = useId();
  const factionId = `${baseId}-faction`;
  const newestId = `${baseId}-newest`;

  // Nothing to look for: the register explains a failed search (with its
  // Retry) or a region without neighborhoods.
  const newestHidden = newestFailed || newestNumber === 0;
  // A Retry puts a query with no data back to pending and clears its error
  // (query-core's fetchState), and keepPreviousData may fill the gap with an
  // older answer; errorUpdateCount survives both, so the message and its
  // Retry (with the focus on it) stay put while the lookup runs again.
  const hasOwnNewest = newestQuery.data !== undefined && !newestQuery.isPlaceholderData;
  const newestLookupFailed = !newestHidden && !hasOwnNewest && newestQuery.errorUpdateCount > 0;
  const newestRetrying = newestLookupFailed && newestQuery.fetchStatus !== "idle";
  const newestLoading =
    !newestHidden && !newestLookupFailed && (!hasNewest || newestQuery.isPending);

  const retryNewest = (): void => {
    // Already asking again: refetch() would cancel that attempt and start over.
    if (newestQuery.fetchStatus === "idle") {
      void newestQuery.refetch();
    }
  };

  const renderNewestText = (): JSX.Element | string => {
    if (newestLookupFailed) {
      return "Newest neighborhood unavailable";
    }
    if (!newest) {
      return "No neighborhoods among the newest numbers";
    }
    return (
      <>
        {"Newest: "}
        <Box
          component="span"
          sx={(theme) => ({
            color: "text.primary",
            fontFamily: newest.nameIsCode ? theme.wc.fontMono : undefined,
          })}
        >
          {newest.name}
        </Box>
        {` · No. ${formatNumber(newest.id)}`}
      </>
    );
  };

  // Only ids that are on screen: a describedby pointing at nothing is noise.
  const describedBy =
    [faction ? factionId : null, !newestHidden && !newestLoading ? newestId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    // A column, so a Retry can sit under the action area.
    <Card variant="outlined" sx={[selectableCardSx(selected), { flexDirection: "column" }]}>
      <CardActionArea
        onClick={() => onSelect(map.id)}
        aria-label={map.name}
        aria-pressed={selected}
        aria-describedby={describedBy}
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        <MapBanner mapId={map.id} icon={<HolidayVillageRoundedIcon />} active={selected} />
        {/* useFlexGap: Stack's sibling margins would fight the skeleton line's own. */}
        <Stack spacing={0.75} useFlexGap sx={{ p: 2, flex: 1, minWidth: 0, minHeight: MAP_CARD_TEXT_HEIGHT }}>
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="h5"
            component="span"
            sx={{
              ...mixins.truncate,
              display: "block",
              margin: 0,
              color: selected ? "primary.light" : "text.primary",
            }}
          >
            {map.name}
          </Typography>
          {faction ? (
            <Typography
              id={factionId}
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ margin: 0 }}
            >
              <FactionTag faction={faction} />
              {" neighborhood"}
            </Typography>
          ) : null}
          {newestHidden ? null : newestLoading ? (
            <Skeleton variant="text" width="70%" sx={{ fontSize: "0.875rem" }} />
          ) : (
            <Typography
              id={newestId}
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{ ...mixins.truncate, margin: 0 }}
            >
              {renderNewestText()}
            </Typography>
          )}
        </Stack>
      </CardActionArea>
      {/* The action area is one <button>, so a button may not nest in it:
          the Retry is the card's second control, below it. */}
      {newestLookupFailed ? (
        <Button
          size="small"
          onClick={retryNewest}
          sx={{ alignSelf: "flex-start", mx: 1, mb: 1 }}
        >
          {newestRetrying ? "Retrying…" : "Retry"}
          <Box component="span" sx={visuallyHidden}>
            {` the newest neighborhood in ${map.name}`}
          </Box>
        </Button>
      ) : null}
    </Card>
  );
};

export default NeighborhoodMapCard;
