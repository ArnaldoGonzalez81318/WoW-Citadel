import { Box, Card, CardActionArea, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import {
  recipeIconQuery,
  recipeQuery,
} from "@/features/professions/hooks/professionQueries";
import type { RecipeRef } from "@/features/professions/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

/** Every tile is this tall (two lines of name), so the loading grid matches it. */
export const RECIPE_TILE_HEIGHT = 68;

export type RecipeTileProps = {
  recipe: RecipeRef;
  /**
   * Another recipe in this tier has the same name (Legion and Battle for
   * Azeroth ranks 1–3): load the recipe itself to show which rank this is.
   */
  showRank: boolean;
  onOpen: (recipe: RecipeRef) => void;
};

/**
 * One recipe: icon and name, opening the recipe dialog. Its icon (and, for
 * a ranked recipe, its record) only loads once the tile nears the viewport,
 * so a 300-recipe book costs what the visitor scrolls past.
 */
const RecipeTile = ({ recipe, showRank, onOpen }: RecipeTileProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({ ...recipeIconQuery(recipe.id), enabled: near });
  const detailQuery = useQuery({
    ...recipeQuery(recipe.id),
    enabled: near && showRank,
  });
  const rank = showRank ? detailQuery.data?.rank : undefined;
  const rankId = useId();

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onOpen(recipe)}
        aria-label={`View ${recipe.name} details`}
        aria-describedby={rank !== undefined ? rankId : undefined}
        sx={{
          ...cardActionAreaSx,
          alignItems: "center",
          gap: 1.5,
          minHeight: RECIPE_TILE_HEIGHT,
          px: 1.5,
          py: 1,
        }}
      >
        <MediaTile
          size={40}
          src={iconQuery.data ?? null}
          alt=""
          fallbackLabel={recipe.name}
          loading={iconQuery.isPending}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            component="span"
            sx={{ ...mixins.lineClamp(rank !== undefined || (showRank && detailQuery.isPending) ? 1 : 2) }}
          >
            {recipe.name}
          </Typography>
          {rank !== undefined ? (
            <Typography
              id={rankId}
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ display: "block" }}
            >
              {`Rank ${rank}`}
            </Typography>
          ) : showRank && detailQuery.isPending ? (
            <Skeleton variant="text" width={48} sx={{ fontSize: "0.75rem" }} />
          ) : null}
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default RecipeTile;
