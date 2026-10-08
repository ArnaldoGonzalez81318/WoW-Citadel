import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useId, useState } from "react";

import LadderStrip from "@/features/reputations/components/LadderStrip";
import { renownColors } from "@/features/reputations/services/reputationPalette";
import { renownSummary } from "@/features/reputations/services/reputationService";
import type { RenownLevel } from "@/features/reputations/types";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

/** A 40-level track opens on its first ten. */
const COLLAPSE_OVER = 12;
const COLLAPSED_COUNT = 10;

export type RenownTrackViewProps = {
  levels: readonly RenownLevel[];
};

/**
 * A renown track: the levels as a strip from blue to the gold of the top
 * level, then each level with what it unlocks. Blizzard names the rewards
 * but serves no record for them (`reputation-faction/reward/{id}` 404s),
 * so they are listed by name.
 */
const RenownTrackView = ({ levels }: RenownTrackViewProps): JSX.Element => {
  const theme = useTheme();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const colors = renownColors(theme, levels.length);
  const collapsible = levels.length > COLLAPSE_OVER;
  const shown = collapsible && !expanded ? levels.slice(0, COLLAPSED_COUNT) : levels;

  if (levels.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        Blizzard lists no renown levels for this faction.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        {renownSummary(levels)}
      </Typography>

      <Box>
        <LadderStrip colors={colors} height={10} />
        <Stack
          direction="row"
          justifyContent="space-between"
          aria-hidden="true"
          sx={{ mt: 0.5, typography: "caption", color: "text.secondary" }}
        >
          <span>{levels[0].name}</span>
          {levels.length > 1 ? <span>{levels[levels.length - 1].name}</span> : null}
        </Stack>
      </Box>

      <Box
        component="ol"
        id={listId}
        role="list"
        aria-label="Renown levels"
        sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}
      >
        {shown.map((level, index) => (
          <Box
            component="li"
            key={level.level}
            sx={(themeArg) => ({
              display: "flex",
              alignItems: "flex-start",
              gap: 1.25,
              px: 1.25,
              py: 0.75,
              borderRadius: `${themeArg.wc.radius.sm}px`,
              backgroundColor: themeArg.palette.surface.inset,
            })}
          >
            <Box
              sx={(themeArg) => ({
                flexShrink: 0,
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                border: `2px solid ${colors[index]}`,
                backgroundColor: alpha(colors[index], 0.16),
                color: themeArg.palette.text.primary,
                typography: "caption",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              })}
            >
              <Box component="span" sx={visuallyHidden}>
                {"Renown "}
              </Box>
              {level.level}
            </Box>
            {level.rewards.length > 0 ? (
              <Box
                component="ul"
                role="list"
                aria-label={`${level.name} rewards`}
                sx={{
                  listStyle: "none",
                  m: 0,
                  p: 0,
                  pt: 0.25,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.75,
                  minWidth: 0,
                }}
              >
                {level.rewards.map((reward, position) => (
                  <Chip
                    key={`${reward.id}-${position}`}
                    component="li"
                    size="small"
                    variant="outlined"
                    label={reward.name}
                    // The name is all a reward has, so a long one ("Not
                    // Responsible for Loss of Life or Limb") wraps on a phone
                    // instead of ending in an ellipsis nobody can expand.
                    sx={{
                      maxWidth: "100%",
                      height: "auto",
                      "& .MuiChip-label": {
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        py: 0.25,
                      },
                    }}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, pt: 0.75 }}>
                No reward listed
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {collapsible ? (
        <Button
          size="small"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={listId}
          endIcon={
            <ExpandMoreRoundedIcon
              sx={(themeArg) => ({
                transform: expanded ? "rotate(180deg)" : "none",
                transition: themeArg.transitions.create("transform", {
                  duration: themeArg.wc.motion.fast,
                }),
              })}
            />
          }
          sx={{ alignSelf: "flex-start" }}
        >
          {expanded
            ? `Show the first ${COLLAPSED_COUNT}`
            : `Show all ${formatNumber(levels.length)} levels`}
        </Button>
      ) : null}
    </Stack>
  );
};

export default RenownTrackView;
