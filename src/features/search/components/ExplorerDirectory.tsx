import {
  Box,
  Card,
  CardActionArea,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import { EXPLORERS, EXPLORER_COLUMNS } from "@/features/search/config/explorers";
import type { ExplorerEntry } from "@/features/search/config/explorers";
import { mixins } from "@/theme";

const ICON_TILE_SIZE = 40;

const ExplorerCard = ({ explorer }: { explorer: ExplorerEntry }): JSX.Element => {
  const Icon = explorer.icon;

  return (
    <Card
      component="li"
      variant="outlined"
      sx={(theme) => ({
        height: "100%",
        listStyle: "none",
        transition: `border-color ${theme.wc.motion.base}ms ${theme.wc.motion.easing}, box-shadow ${theme.wc.motion.base}ms ${theme.wc.motion.easing}, transform ${theme.wc.motion.base}ms ${theme.wc.motion.easing}`,
        "@media (hover: hover)": {
          "&:hover": {
            borderColor: theme.palette.border.strong,
            boxShadow: theme.palette.glow.card,
          },
        },
        "@media (hover: hover) and (prefers-reduced-motion: no-preference)": {
          "&:hover": { transform: "translateY(-2px)" },
        },
      })}
    >
      <CardActionArea
        component={RouterLink}
        to={explorer.path}
        aria-label={`Open ${explorer.label}`}
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          "& .MuiCardActionArea-focusHighlight": { display: "none" },
        }}
      >
        <Stack spacing={1.5} sx={{ p: 2, width: "100%", minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              width: ICON_TILE_SIZE,
              height: ICON_TILE_SIZE,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: `${theme.wc.radius.md}px`,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.light,
              "& svg": { fontSize: 22 },
            })}
          >
            <Icon />
          </Box>
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h3" sx={{ margin: 0 }}>
              {explorer.label}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={mixins.lineClamp(2)}
            >
              {explorer.blurb}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: "auto" }}
          >
            {explorer.section}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

/**
 * Directory of every live explorer. Each card is one link (the whole card),
 * with icon + label carrying identity; no per-explorer accent colours.
 */
const ExplorerDirectory = (): JSX.Element => (
  <SectionCard
    title="Explorers"
    titleAs="h2"
    description="Dedicated views built on Blizzard's game-data API."
    padding="none"
    id="explorers"
  >
    <Box
      component="ul"
      sx={{
        display: "grid",
        gap: 2,
        m: 0,
        p: 2,
        listStyle: "none",
        ...gridTemplateColumnsSx(EXPLORER_COLUMNS),
      }}
    >
      {EXPLORERS.map((explorer) => (
        <ExplorerCard key={explorer.path} explorer={explorer} />
      ))}
    </Box>
  </SectionCard>
);

export default ExplorerDirectory;
