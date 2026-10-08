import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import { creatureFamilyIconQuery } from "@/features/creatures/hooks/creatureQueries";
import { creatureKindLine } from "@/features/creatures/services/creatureService";
import type { Creature } from "@/features/creatures/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, visuallyHidden } from "@/theme";

/**
 * The text block under the 4:3 render: 12px padding, two lines of name
 * (reserved, so every card in a row is the same height), the 20px kind line
 * and the gap between them. The loading grid uses it to match the cards.
 */
export const CREATURE_CARD_TEXT_HEIGHT = 92;

export type CreatureCardProps = {
  creature: Creature;
  onSelect: (creature: Creature) => void;
};

/**
 * One creature: its model render (Blizzard's 600×600 zoom portrait, cropped
 * to 4:3; the model sits in the middle of it), a "Tameable" badge for hunter
 * pets, the name, and its type and family with the family's icon. The render
 * and icon only load once the card nears the viewport. The whole card opens
 * the detail dialog.
 */
const CreatureCard = ({ creature, onSelect }: CreatureCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const [displayId] = creature.displayIds;
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(displayId ?? 0),
    enabled: near && displayId !== undefined,
  });
  const family = creature.family;
  // Many cards share a family, so this is one request per family on the page.
  const familyIconQuery = useQuery({
    ...creatureFamilyIconQuery(family?.id ?? 0),
    enabled: near && family !== undefined,
  });
  const kind = creatureKindLine(creature);
  // The button's aria-label replaces its content, so the visible details are
  // its description: the only way to tell namesakes ("Owl" ×4) apart by ear.
  const detailsId = useId();

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onSelect(creature)}
        aria-label={`View ${creature.name} details`}
        aria-describedby={
          creature.isTameable ? `${detailsId}-kind ${detailsId}-tame` : `${detailsId}-kind`
        }
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        {/* The tile fills its parent; this box gives it the 4:3 shape
            instead of the card's full height. */}
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "4 / 3", flexShrink: 0 }}>
          <MediaTile
            size="fill"
            aspect="4 / 3"
            src={renderQuery.data ?? null}
            alt=""
            fallbackLabel={creature.name}
            loading={displayId !== undefined && renderQuery.isPending}
          />
          {creature.isTameable ? (
            <Chip
              id={`${detailsId}-tame`}
              size="small"
              icon={<PetsRoundedIcon />}
              label="Tameable"
              sx={(theme) => ({
                position: "absolute",
                top: 8,
                left: 8,
                maxWidth: "calc(100% - 16px)",
                // Renders are dark grey; a translucent page tone keeps the
                // badge legible on the model without hiding it.
                backgroundColor: alpha(theme.palette.background.default, 0.72),
                backdropFilter: "blur(4px)",
                border: `1px solid ${theme.palette.border.default}`,
              })}
            />
          ) : null}
        </Box>
        <Stack
          spacing={0.75}
          useFlexGap
          sx={{ p: 1.5, width: "100%", minWidth: 0, minHeight: CREATURE_CARD_TEXT_HEIGHT }}
        >
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="subtitle2"
            component="span"
            sx={{ ...mixins.lineClamp(2), minHeight: "3em", hyphens: "auto" }}
          >
            {creature.name}
          </Typography>
          <Stack
            id={`${detailsId}-kind`}
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ minWidth: 0, height: 20 }}
          >
            {family ? (
              <Avatar
                alt=""
                src={familyIconQuery.data ?? undefined}
                variant="rounded"
                sx={{ width: 20, height: 20, fontSize: "0.625rem", flexShrink: 0 }}
              >
                {family.name.charAt(0)}
              </Avatar>
            ) : null}
            <Typography
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ ...mixins.truncate, minWidth: 0 }}
            >
              {kind || "Type unknown"}
              <Box component="span" sx={visuallyHidden}>
                {`, creature ${creature.id}`}
              </Box>
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default CreatureCard;
