import { Box, Card, CardActionArea, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import FamilyBadge, { FamilyIcon, familyColor } from "@/features/battlePets/components/FamilyBadge";
import IconGlow from "@/features/battlePets/components/IconGlow";
import { familyById } from "@/features/battlePets/config/petFamilies";
import {
  creatureDisplaysQuery,
  petQuery,
} from "@/features/battlePets/hooks/battlePetQueries";
import { usePetIcon } from "@/features/battlePets/hooks/useIcons";
import type { IndexEntry } from "@/features/battlePets/types";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, visuallyHidden } from "@/theme";

/**
 * The text block: 12px padding top and bottom, two 21px lines of name
 * (reserved, so every card in a row is the same height), a 4px gap, and the
 * 20px family and source lines.
 */
const TEXT_HEIGHT = 110;
/**
 * A card's height for its width, borders included: the 4:3 render is three
 * quarters of the width, over the text block. Loading cells use it as a
 * percentage padding so the grid does not jump at any breakpoint.
 */
export const PET_CARD_SHAPE = `calc(75% + ${TEXT_HEIGHT + 2}px)`;

export type PetCardProps = {
  entry: IndexEntry;
  onOpen: (entry: IndexEntry) => void;
};

const lineSx = {
  display: "flex",
  alignItems: "center",
  gap: 0.5,
  minWidth: 0,
  height: 20,
  overflow: "hidden",
  whiteSpace: "nowrap",
} as const;

/**
 * One pet journal entry: the model render of the creature it summons
 * (Blizzard's 600×600 zoom portrait, cropped to 4:3; the model sits in the
 * middle), its name, family and source. Without a render (none listed, or
 * the render host has not caught up with the newest pets) the header shows
 * the pet's 56px icon over a wash of the family's colour and the icon's own.
 *
 * Everything loads as the card nears the viewport: the pet record (six at a
 * time across the page, see petQuery; a family scan has usually loaded it
 * already), then its creature's display ids and the first display's render,
 * the same cache entries the pet's dialog opens on.
 */
const PetCard = ({ entry, onOpen }: PetCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...petQuery(entry.id), enabled: near });
  const pet = query.data;
  const loading = query.isPending;
  const icon = usePetIcon(pet);
  const family = familyById(pet?.family?.id);

  // A record a scan cached is in hand off screen too; its art still waits.
  const creatureId = near ? pet?.creature?.id : undefined;
  const displaysQuery = useQuery({
    ...creatureDisplaysQuery(creatureId ?? 0),
    enabled: creatureId !== undefined,
  });
  const displayId = displaysQuery.data?.[0];
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(displayId ?? 0),
    enabled: displayId !== undefined,
  });
  const renderSrc = renderQuery.data ?? null;
  // A render URL the host refuses (403) falls back to the icon, not a letter.
  const [failedRender, setFailedRender] = useState<string | null>(null);
  const showRender = renderSrc !== null && failedRender !== renderSrc;
  // Until the render is known to exist or not, the header is a skeleton, so
  // the icon never flashes in before it. A failed lookup falls back to the
  // icon (the dialog says what failed and offers a Retry).
  const artPending =
    !near ||
    loading ||
    (creatureId !== undefined && displaysQuery.isPending) ||
    (displayId !== undefined && renderQuery.isPending);
  // The button's aria-label replaces its content, so the visible lines are
  // its description: what tells the Alliance and Horde namesakes apart.
  const baseId = useId();
  const familyLineId = `${baseId}-family`;
  const sourceLineId = `${baseId}-source`;

  let familyLine: ReactNode;
  let sourceLine: ReactNode;
  if (loading) {
    familyLine = <Skeleton variant="text" width="60%" />;
    sourceLine = <Skeleton variant="text" width="45%" />;
  } else if (query.isError && pet === undefined) {
    familyLine = "Details unavailable";
    sourceLine = null;
  } else if (!pet) {
    familyLine = "Not in Blizzard's pet data";
    sourceLine = null;
  } else {
    familyLine = pet.family ? (
      <FamilyBadge familyId={pet.family.id} name={pet.family.name} />
    ) : (
      "Family not listed"
    );
    sourceLine = (
      <>
        <Box component="span" sx={{ ...mixins.truncate, minWidth: 0 }}>
          {pet.source?.name ?? "Source not listed"}
        </Box>
        {pet.faction ? (
          <>
            <span aria-hidden="true">·</span>
            <FactionTag faction={pet.faction} />
          </>
        ) : null}
      </>
    );
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onOpen(entry)}
        aria-label={`View ${entry.name} details`}
        aria-describedby={loading ? undefined : `${familyLineId} ${sourceLineId}`}
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        <Box
          sx={(theme) => {
            const color = family ? familyColor(theme, family.id) : theme.palette.primary.main;
            return {
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 3",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              background: showRender
                ? theme.palette.surface.sunken
                : `linear-gradient(160deg, ${alpha(color, 0.22)} 0%, ${alpha(color, 0.04)} 80%)`,
              borderBottom: `1px solid ${theme.palette.border.subtle}`,
            };
          }}
        >
          {artPending ? (
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
          ) : showRender ? (
            <Box
              component="img"
              src={renderSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailedRender(renderSrc)}
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <>
              <IconGlow src={icon.src} />
              <MediaTile
                size={56}
                src={icon.src}
                alt=""
                fallbackLabel={entry.name}
                loading={icon.pending}
                radius="md"
                sx={{ position: "relative" }}
              />
            </>
          )}
          {family && pet?.family ? (
            <Box sx={{ position: "absolute", top: 8, left: 8, display: "flex" }}>
              <FamilyIcon family={family} size={20} name={pet.family.name} />
            </Box>
          ) : null}
        </Box>
        <Box sx={{ p: 1.5, width: "100%", minWidth: 0, minHeight: TEXT_HEIGHT }}>
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="subtitle2"
            component="span"
            title={entry.name}
            sx={{ ...mixins.lineClamp(2), minHeight: "3em", hyphens: "auto", mb: 0.5 }}
          >
            {entry.name}
          </Typography>
          <Typography
            id={familyLineId}
            variant="caption"
            component="span"
            color="text.secondary"
            sx={lineSx}
          >
            {familyLine}
          </Typography>
          <Typography
            id={sourceLineId}
            variant="caption"
            component="span"
            color="text.secondary"
            sx={lineSx}
          >
            {sourceLine}
            <Box component="span" sx={visuallyHidden}>
              {`, pet ${entry.id}`}
            </Box>
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default PetCard;
