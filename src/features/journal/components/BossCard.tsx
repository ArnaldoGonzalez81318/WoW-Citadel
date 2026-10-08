import { Box, Card, CardActionArea, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import { journalEncounterQuery } from "@/features/journal/hooks/journalQueries";
import type { JournalRef } from "@/features/journal/types";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { mixins, visuallyHidden } from "@/theme";

/**
 * The text block under the square render: 10px padding and two reserved
 * lines of name, so every card in a row is the same height. The loading
 * grid uses it to match the cards.
 */
export const BOSS_CARD_TEXT_HEIGHT = 64;

export type BossCardProps = {
  encounter: JournalRef;
  /** 1-based place in the instance's journal order. */
  position: number;
  total: number;
  selected: boolean;
  onSelect: (encounter: JournalRef) => void;
};

/**
 * One boss: its model (Blizzard's 600×600 zoom portrait of the encounter's
 * first creature, which the journal lists first) with its journal order,
 * and its name. The encounter record and the render only load once the card
 * nears the viewport; the encounter view below reads the same cache entry.
 */
const BossCard = ({ encounter, position, total, selected, onSelect }: BossCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const encounterQuery = useQuery({ ...journalEncounterQuery(encounter.id), enabled: near });
  const displayId = encounterQuery.data?.creatures[0]?.displayId;
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(displayId ?? 0),
    enabled: near && displayId !== undefined,
  });
  // Pending until the record says which model to show; a boss without one
  // (a primer page such as "Affixes") settles on its letter tile.
  const loading =
    encounterQuery.isPending || (displayId !== undefined && renderQuery.isPending);
  const positionId = useId();

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx(selected)}>
      <CardActionArea
        onClick={() => onSelect(encounter)}
        aria-label={`View ${encounter.name}`}
        aria-describedby={positionId}
        aria-current={selected ? "true" : undefined}
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1", flexShrink: 0 }}>
          <MediaTile
            size="fill"
            aspect="1 / 1"
            src={renderQuery.data ?? null}
            alt=""
            fallbackLabel={encounter.name}
            loading={loading}
          />
          <Box
            component="span"
            aria-hidden="true"
            sx={(theme) => ({
              position: "absolute",
              top: 8,
              left: 8,
              minWidth: 24,
              height: 24,
              px: 0.75,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              typography: "caption",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: selected ? theme.palette.primary.light : theme.palette.text.primary,
              // Renders are dark grey; a translucent page tone keeps the
              // number legible on the model without hiding it.
              backgroundColor: alpha(theme.palette.background.default, 0.72),
              border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.border.default}`,
              borderRadius: `${theme.wc.radius.pill}px`,
            })}
          >
            {formatNumber(position)}
          </Box>
        </Box>
        <Box sx={{ px: 1.25, py: 1.25, width: "100%", minWidth: 0, minHeight: BOSS_CARD_TEXT_HEIGHT }}>
          <Typography
            variant="subtitle2"
            component="span"
            sx={{ ...mixins.lineClamp(2), hyphens: "auto" }}
          >
            {encounter.name}
          </Typography>
          <Box component="span" id={positionId} sx={visuallyHidden}>
            {`Encounter ${formatNumber(position)} of ${formatNumber(total)}`}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default BossCard;
