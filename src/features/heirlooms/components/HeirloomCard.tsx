import { Box, Card, CardActionArea, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import SourceIcon from "@/features/heirlooms/components/SourceIcon";
import TierBars from "@/features/heirlooms/components/TierBars";
import { heirloomIconQuery } from "@/features/heirlooms/hooks/heirloomQueries";
import {
  itemLevelRange,
  pluralize,
  slotLine,
} from "@/features/heirlooms/services/heirloomService";
import type { Heirloom, HeirloomRef } from "@/features/heirlooms/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { lineClamp, qualityColor, truncate, visuallyHidden } from "@/theme";

/**
 * 12px padding twice, two lines of name (reserved, so a row of cards lines
 * up), three 17.4px caption lines and their 4px gaps, plus the card's 1px
 * borders: the loading grid uses it to match the cards.
 */
export const HEIRLOOM_CARD_HEIGHT = 128;

export type HeirloomCardProps = {
  entry: HeirloomRef;
  /** The record: undefined while it loads, null when Blizzard has none (404). */
  heirloom: Heirloom | null | undefined;
  /** Its record failed to load (the page offers a Retry). */
  failed?: boolean;
  /** The collection's highest item level (see TierBars). */
  ceiling: number;
  onSelect: (entry: HeirloomRef) => void;
};

/**
 * The ladder in words. Only the item level range shows: at most widths the
 * card's column has ~110–150px beside the bars, and "6 upgrades · item level
 * 34–69" would lose the range to the ellipsis. The bars already show the
 * step count, so screen readers alone hear it ("6 upgrades, Item level 34–69").
 */
const LadderText = ({ heirloom }: { heirloom: Heirloom }): JSX.Element => {
  const range = itemLevelRange(heirloom);
  const upgrades =
    heirloom.maxUpgrade !== null
      ? pluralize(heirloom.maxUpgrade, "upgrade", "upgrades")
      : null;
  if (!range) {
    return <>{upgrades ?? "No upgrades listed"}</>;
  }
  return (
    <>
      {upgrades ? (
        <Box component="span" sx={visuallyHidden}>
          {`${upgrades}, `}
        </Box>
      ) : null}
      {`Item level ${range}`}
    </>
  );
};

/**
 * One heirloom: its icon with the heirloom-quality border, the name in
 * heirloom blue, its slot and type (and variant, for the raid weapons that
 * come in three), its upgrade ladder as bars with the item level range, and
 * where it comes from. The icon loads once the card nears the viewport. The
 * whole card opens the detail dialog.
 */
const HeirloomCard = ({
  entry,
  heirloom,
  failed = false,
  ceiling,
  onSelect,
}: HeirloomCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const itemId = heirloom?.itemId ?? 0;
  const iconQuery = useQuery({ ...heirloomIconQuery(itemId), enabled: near && itemId > 0 });
  const name = heirloom?.name ?? entry.name;
  // The button's aria-label replaces its content, so the visible details are
  // its description: the only way to tell Hellscream's three Warbows apart by ear.
  const detailsId = useId();
  let status: string | null = null;
  if (heirloom === null) {
    status = "Not in Blizzard's game data";
  } else if (!heirloom && failed) {
    status = "Details unavailable";
  }
  let describedBy: string | undefined;
  if (heirloom) {
    describedBy = `${detailsId}-slot ${detailsId}-ladder ${detailsId}-source`;
  } else if (status) {
    describedBy = `${detailsId}-slot`;
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onSelect({ id: entry.id, name })}
        aria-label={`View ${name} details`}
        aria-describedby={describedBy}
        sx={cardActionAreaSx}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          sx={{ p: 1.5, width: "100%", minWidth: 0 }}
        >
          <MediaTile
            size={56}
            src={iconQuery.data ?? null}
            alt=""
            fallbackLabel={name}
            quality="heirloom"
            loading={heirloom === undefined ? !failed : itemId > 0 && iconQuery.isPending}
          />
          <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
            {/* A heading may not sit inside the action area's <button>;
                its aria-label names the card instead. */}
            <Typography
              variant="subtitle2"
              component="span"
              // A clamped name stays readable on hover (and in full in the dialog).
              title={name}
              sx={(theme) => ({
                ...lineClamp(2),
                minHeight: "2.7em",
                color: qualityColor(theme, "heirloom"),
                lineHeight: 1.35,
              })}
            >
              {name}
            </Typography>
            {heirloom ? (
              <>
                <Typography
                  id={`${detailsId}-slot`}
                  variant="caption"
                  color="text.secondary"
                  component="span"
                  sx={{ ...truncate, display: "block" }}
                >
                  {heirloom.variant ? (
                    <Box component="span" sx={(theme) => ({ color: qualityColor(theme, "uncommon") })}>
                      {`${heirloom.variant} · `}
                    </Box>
                  ) : null}
                  {slotLine(heirloom) || "Slot unknown"}
                  <Box component="span" sx={visuallyHidden}>
                    {`, heirloom ${heirloom.id}`}
                  </Box>
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <TierBars tiers={heirloom.tiers} ceiling={ceiling} height={14} />
                  <Typography
                    id={`${detailsId}-ladder`}
                    variant="caption"
                    color="text.secondary"
                    component="span"
                    sx={{ ...truncate, minWidth: 0 }}
                  >
                    <LadderText heirloom={heirloom} />
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <SourceIcon
                    sourceKey={heirloom.source.key}
                    sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
                  />
                  <Typography
                    id={`${detailsId}-source`}
                    variant="caption"
                    color="text.secondary"
                    component="span"
                    sx={{ ...truncate, minWidth: 0 }}
                  >
                    {heirloom.source.name}
                  </Typography>
                </Stack>
              </>
            ) : status ? (
              <Typography
                id={`${detailsId}-slot`}
                variant="caption"
                color="text.secondary"
                component="span"
              >
                {status}
              </Typography>
            ) : (
              // The record is on its way: the lines it will fill, in place.
              <Box>
                <Skeleton variant="text" width="60%" sx={{ fontSize: "0.75rem" }} />
                <Skeleton variant="text" width="80%" sx={{ fontSize: "0.75rem" }} />
                <Skeleton variant="text" width="40%" sx={{ fontSize: "0.75rem" }} />
              </Box>
            )}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default HeirloomCard;
