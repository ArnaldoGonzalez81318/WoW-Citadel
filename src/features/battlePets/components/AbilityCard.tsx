import { Box, Card, CardActionArea, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import FamilyBadge, { FamilyIcon } from "@/features/battlePets/components/FamilyBadge";
import { familyById } from "@/features/battlePets/config/petFamilies";
import { abilityQuery } from "@/features/battlePets/hooks/battlePetQueries";
import { useAbilityIcon } from "@/features/battlePets/hooks/useIcons";
import { abilityTiming } from "@/features/battlePets/services/battlePetService";
import type { IndexEntry } from "@/features/battlePets/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, visuallyHidden } from "@/theme";

/** 12px padding around a 21px name and two 20px lines; the 56px icon fits beside them. */
export const ABILITY_CARD_HEIGHT = 88;

const lineSx = {
  display: "flex",
  alignItems: "center",
  gap: 0.5,
  minWidth: 0,
  height: 20,
  overflow: "hidden",
  whiteSpace: "nowrap",
} as const;

export type AbilityCardProps = {
  entry: IndexEntry;
  onOpen: (entry: IndexEntry) => void;
};

/**
 * One pet battle ability: its icon (with its family's in the corner), name,
 * family and timing. The record and then the icon load as the card nears
 * the viewport; the whole card opens the ability's dialog.
 */
const AbilityCard = ({ entry, onOpen }: AbilityCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...abilityQuery(entry.id), enabled: near });
  const ability = query.data;
  const icon = useAbilityIcon(ability, near);
  const family = familyById(ability?.family?.id);
  const baseId = useId();
  const familyLineId = `${baseId}-family`;
  const timingLineId = `${baseId}-timing`;
  const loading = query.isPending;

  let familyLine: ReactNode;
  let timingLine: ReactNode;
  if (loading) {
    familyLine = <Skeleton variant="text" width="50%" />;
    timingLine = <Skeleton variant="text" width="65%" />;
  } else if (query.isError && ability === undefined) {
    familyLine = "Details unavailable";
    timingLine = null;
  } else if (!ability) {
    familyLine = "Not in Blizzard's ability data";
    timingLine = null;
  } else {
    familyLine = ability.family ? (
      <FamilyBadge familyId={ability.family.id} name={ability.family.name} />
    ) : (
      "Family not listed"
    );
    timingLine = (
      <Box component="span" sx={{ ...mixins.truncate, minWidth: 0 }}>
        {abilityTiming(ability)}
      </Box>
    );
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onOpen(entry)}
        aria-label={`View ${entry.name} details`}
        aria-describedby={loading ? undefined : `${familyLineId} ${timingLineId}`}
        sx={{
          ...cardActionAreaSx,
          alignItems: "center",
          gap: 1.5,
          minHeight: ABILITY_CARD_HEIGHT - 2,
          px: 1.5,
          py: 1.5,
        }}
      >
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <MediaTile
            size={56}
            src={icon.src}
            alt=""
            fallbackLabel={entry.name}
            loading={loading || icon.pending}
            radius="md"
          />
          {family && ability?.family ? (
            <Box sx={{ position: "absolute", right: -4, bottom: -4 }}>
              <FamilyIcon family={family} size={20} name={ability.family.name} />
            </Box>
          ) : null}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="subtitle2"
            component="span"
            title={entry.name}
            sx={{ ...mixins.truncate, display: "block", fontWeight: 600 }}
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
            id={timingLineId}
            variant="caption"
            component="span"
            color="text.secondary"
            sx={lineSx}
          >
            {timingLine}
            <Box component="span" sx={visuallyHidden}>
              {`, ability ${entry.id}`}
            </Box>
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default AbilityCard;
