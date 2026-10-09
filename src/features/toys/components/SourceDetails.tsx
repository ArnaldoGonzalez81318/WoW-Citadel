import { Box, Typography } from "@mui/material";

import type { SourceLine } from "@/features/toys/types";

export type SourceDetailsProps = {
  blocks: SourceLine[][];
};

/**
 * Blizzard's own account of where a toy comes from ("Vendor: Pogg / Zone:
 * Tol Barad Peninsula / Faction: Hellscream's Reach - Honored / Cost: 250"),
 * one definition list per place (a toy two vendors sell has two). Lines
 * without a label ("In-Game Shop") read as plain text. The text is shown as
 * Blizzard wrote it: its "Cost" names no currency, so neither does this.
 */
const SourceDetails = ({ blocks }: SourceDetailsProps): JSX.Element => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
    {blocks.map((block, blockIndex) => (
      <Box
        // Blizzard's blocks, in order; nothing to key them by but position.
        key={blockIndex}
        component="dl"
        sx={(theme) => ({
          display: "grid",
          // A long label ("Mythic Dungeon International") wraps rather than
          // squeezing the value at phone width.
          gridTemplateColumns: "fit-content(45%) minmax(0, 1fr)",
          columnGap: 2,
          rowGap: 0.75,
          m: 0,
          p: 1.5,
          borderRadius: `${theme.wc.radius.md}px`,
          border: `1px solid ${theme.palette.border.subtle}`,
          backgroundColor: theme.palette.surface.inset,
        })}
      >
        {block.map((line, lineIndex) =>
          line.label !== undefined ? (
            <Box key={lineIndex} sx={{ display: "contents" }}>
              <Typography
                component="dt"
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontWeight: 500,
                  alignSelf: "baseline",
                  overflowWrap: "anywhere",
                }}
              >
                {line.label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "baseline" }}
              >
                {line.value}
              </Typography>
            </Box>
          ) : (
            // A dl may hold only dt/dd groups (and divs wrapping them): an
            // unlabelled line is a description with an empty term.
            <Box key={lineIndex} sx={{ display: "contents" }}>
              <Box component="dt" sx={{ display: "none" }} />
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, gridColumn: "1 / -1", overflowWrap: "anywhere" }}
              >
                {line.value}
              </Typography>
            </Box>
          ),
        )}
      </Box>
    ))}
  </Box>
);

export default SourceDetails;
