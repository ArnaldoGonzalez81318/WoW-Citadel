import { Box, Card, CardActionArea, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import SourceIcon from "@/features/toys/components/SourceIcon";
import { toyIconQuery, toyQuery } from "@/features/toys/hooks/toyQueries";
import { sourceSummary } from "@/features/toys/services/toyService";
import type { ToyRef } from "@/features/toys/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, visuallyHidden } from "@/theme";

/** The band the icon sits in, over a blurred wash of the same art. */
export const TOY_ART_HEIGHT = 88;
/**
 * The text block under it: 12px padding, two reserved 21px lines of name
 * (so a row of cards lines up), the 20px source and where lines and the 4px
 * gaps between them.
 */
export const TOY_TEXT_HEIGHT = 114;
/** The whole card, 1px borders included, for the loading grid. */
export const TOY_CARD_HEIGHT = TOY_ART_HEIGHT + TOY_TEXT_HEIGHT + 2;

const captionSx = {
  ...mixins.truncate,
  display: "block",
  m: 0,
  minWidth: 0,
  lineHeight: "20px",
  height: 20,
} as const;

export type ToyCardProps = {
  toy: ToyRef;
  onOpen: (toy: ToyRef) => void;
};

/**
 * One toy in the box: its icon, name, where it comes from (Blizzard's source
 * and the first line of its own source text, "Pogg · Tol Barad Peninsula").
 * The record behind those and then the icon load as the card nears the
 * viewport, a few at a time (see toyQueries), so a page costs what the
 * visitor scrolls past; a record read before (this visit or an earlier one
 * today) costs nothing. The whole card opens the toy's dialog.
 */
const ToyCard = ({ toy, onOpen }: ToyCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const recordQuery = useQuery({ ...toyQuery(toy.id), enabled: near });
  const record = recordQuery.data;
  const itemId = record?.itemId;
  const iconQuery = useQuery({
    ...toyIconQuery(itemId ?? 0),
    enabled: near && itemId !== undefined,
  });
  const icon = iconQuery.data ?? null;
  // The button's aria-label replaces its content, so the visible lines are
  // its description. Namesakes often share those too (both Hearthstations
  // are Feast of Winter Veil toys; only the icon differs), so the toy's id
  // ends it, unseen: the one thing that tells them apart by ear.
  const baseId = useId();
  const sourceId = `${baseId}-source`;
  const whereId = `${baseId}-where`;
  const numberId = `${baseId}-number`;

  const loading = record === undefined && recordQuery.isPending;
  const where = record ? sourceSummary(record) : undefined;
  const describedBy = loading
    ? numberId
    : [sourceId, where ? whereId : null, numberId].filter(Boolean).join(" ");

  let sourceLine: JSX.Element | string;
  if (loading) {
    sourceLine = <Skeleton variant="text" width="60%" sx={{ mx: "auto" }} />;
  } else if (record === undefined) {
    sourceLine = "Details unavailable";
  } else if (record === null) {
    sourceLine = "Not in Blizzard's toy data";
  } else if (record.source) {
    sourceLine = (
      <Box
        component="span"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, maxWidth: "100%" }}
      >
        <SourceIcon type={record.source.type} sx={{ fontSize: 16 }} />
        <Box component="span" sx={mixins.truncate}>
          {record.source.name}
        </Box>
      </Box>
    );
  } else {
    sourceLine = "Source not listed";
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onOpen(toy)}
        aria-label={`View ${toy.name} details`}
        aria-describedby={describedBy}
        sx={{ ...cardActionAreaSx, flexDirection: "column", textAlign: "center" }}
      >
        <Box
          sx={(theme) => ({
            position: "relative",
            width: "100%",
            height: TOY_ART_HEIGHT,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            backgroundColor: theme.palette.surface.sunken,
            borderBottom: `1px solid ${theme.palette.border.subtle}`,
          })}
        >
          <IconBackdrop src={icon} opacity={0.55} />
          <MediaTile
            size={56}
            src={icon}
            alt=""
            fallbackLabel={toy.name}
            loading={loading || (itemId !== undefined && iconQuery.isPending)}
            sx={(theme) => ({ boxShadow: theme.palette.glow.card })}
          />
        </Box>
        <Stack
          spacing={0.5}
          useFlexGap
          sx={{ p: 1.5, width: "100%", minWidth: 0, height: TOY_TEXT_HEIGHT }}
        >
          {/* A heading may not sit inside the action area's <button>; its
              aria-label names the card instead. */}
          <Typography
            variant="subtitle2"
            component="span"
            // Two lines at most; the full name is the card's label, its hover title and the dialog's.
            title={toy.name}
            sx={{ ...mixins.lineClamp(2), height: "3em", lineHeight: 1.5, hyphens: "auto" }}
          >
            {toy.name}
          </Typography>
          <Typography
            id={sourceId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={captionSx}
          >
            {sourceLine}
          </Typography>
          <Typography
            id={whereId}
            variant="caption"
            color="text.secondary"
            component="span"
            title={where}
            sx={{ ...captionSx, opacity: 0.85 }}
          >
            {where ?? ""}
          </Typography>
          <Box id={numberId} component="span" sx={visuallyHidden}>
            {`, toy ${toy.id}`}
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default ToyCard;
