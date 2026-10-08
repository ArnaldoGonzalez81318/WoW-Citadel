import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Chip, Link, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import MediaTile from "@/components/common/MediaTile";
import { EmptyState } from "@/components/common/StateBlocks";
import {
  itemIconQuery,
  recipeIconQuery,
  recipeQuery,
} from "@/features/professions/hooks/professionQueries";
import { formatQuantity } from "@/features/professions/services/professionService";
import type {
  CraftedQuantity,
  ItemRef,
  Recipe,
} from "@/features/professions/types";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type RecipeDialogContext = {
  /** "Midnight Alchemy", when the recipe is in the listed book. */
  tierName?: string;
  /** "Void Potions", likewise. */
  category?: string;
  professionName?: string;
};

export type RecipeDialogProps = {
  /** Whether the dialog is showing; `recipeId` stays set through the close transition. */
  open: boolean;
  /** The recipe to show (the last one opened). */
  recipeId: number | null;
  /** Its name from the recipe book, shown until the record loads. */
  fallbackName?: string;
  context: RecipeDialogContext;
  onClose: () => void;
};

/** The raw recipe record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (recipeId: number): string =>
  `/api-explorer/profession?${new URLSearchParams({
    endpoint: "recipe",
    recipeId: String(recipeId),
  }).toString()}`;

/**
 * An item with its icon, linked to Wowhead (Blizzard's item ids are
 * Wowhead's). The icon loads when the dialog shows it: a recipe names at
 * most a handful of items.
 */
const ItemLine = ({
  item,
  quantity,
}: {
  item: ItemRef;
  quantity?: string;
}): JSX.Element => {
  const iconQuery = useQuery(itemIconQuery(item.id));
  const href = wowheadUrl("item", item.id);
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <MediaTile
        size={40}
        src={iconQuery.data ?? null}
        alt=""
        fallbackLabel={item.name}
        loading={iconQuery.isPending}
      />
      <Box sx={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
        {href ? (
          <Link href={href} target="_blank" rel="noreferrer" variant="body2">
            {item.name}
            <Box component="span" sx={visuallyHidden}>
              {" (Wowhead, opens in a new tab)"}
            </Box>
          </Link>
        ) : (
          <Typography variant="body2" component="span">
            {item.name}
          </Typography>
        )}
      </Box>
      {quantity ? (
        <Typography
          variant="body2"
          component="span"
          color="text.secondary"
          sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
        >
          {quantity}
        </Typography>
      ) : null}
    </Stack>
  );
};

const quantityLabel = (quantity: CraftedQuantity | undefined): string | undefined =>
  quantity ? formatQuantity(quantity) : undefined;

const buildRows = (
  recipe: Recipe,
  context: RecipeDialogContext,
): DetailDialogRow[] => {
  const rows: DetailDialogRow[] = [];
  const made = quantityLabel(recipe.craftedQuantity);
  if (recipe.craftedItem) {
    rows.push({ label: "Creates", value: <ItemLine item={recipe.craftedItem} quantity={made} /> });
  }
  // Faction recipes name one item per side instead of a single crafted item.
  if (recipe.allianceCraftedItem) {
    rows.push({
      label: "Creates (Alliance)",
      value: <ItemLine item={recipe.allianceCraftedItem} quantity={made} />,
    });
  }
  if (recipe.hordeCraftedItem) {
    rows.push({
      label: "Creates (Horde)",
      value: <ItemLine item={recipe.hordeCraftedItem} quantity={made} />,
    });
  }
  if (context.tierName) {
    rows.push({ label: "Skill tier", value: context.tierName });
  }
  if (context.category) {
    rows.push({ label: "Category", value: context.category });
  }
  if (recipe.rank !== undefined) {
    rows.push({ label: "Rank", value: formatNumber(recipe.rank) });
  }
  return rows;
};

const buildSections = (recipe: Recipe): DetailDialogSection[] => {
  const sections: DetailDialogSection[] = [];
  if (recipe.description.length > 0) {
    sections.push({
      heading: "About",
      content: (
        <Stack spacing={1}>
          {recipe.description.map((paragraph, index) => (
            <Typography key={index} variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
              {paragraph}
            </Typography>
          ))}
        </Stack>
      ),
    });
  }
  if (recipe.reagents.length > 0) {
    sections.push({
      heading: "Reagents",
      content: (
        <Box component="ul" role="list" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
          {recipe.reagents.map((reagent, index) => (
            <Box component="li" key={`${reagent.item.id}-${index}`} sx={{ minWidth: 0 }}>
              <ItemLine
                item={reagent.item}
                quantity={`×${formatNumber(reagent.quantity)}`}
              />
            </Box>
          ))}
        </Box>
      ),
    });
  }
  if (recipe.reagentSlots.length > 0) {
    sections.push({
      heading: "Reagent slots",
      content: (
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            Slots the crafting window fills with reagents of your choice or
            quality; Blizzard does not publish their quantities.
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} role="list">
            {recipe.reagentSlots.map((slot, index) => (
              <Chip key={`${slot}-${index}`} role="listitem" size="small" variant="outlined" label={slot} />
            ))}
          </Stack>
        </Stack>
      ),
    });
  }
  return sections;
};

/**
 * A recipe in full: its icon, what it creates and how many, every reagent
 * with its icon and quantity, the quality slots modern recipes use instead,
 * and where it sits in the profession. Reads the same icon cache entry as
 * the tile that opened it.
 */
const RecipeDialog = ({
  open,
  recipeId,
  fallbackName,
  context,
  onClose,
}: RecipeDialogProps): JSX.Element => {
  const enabled = recipeId !== null;
  const detailQuery = useQuery({ ...recipeQuery(recipeId ?? 0), enabled });
  const iconQuery = useQuery({ ...recipeIconQuery(recipeId ?? 0), enabled });
  const recipe = enabled ? detailQuery.data : undefined;
  const notFound = enabled && detailQuery.data === null;
  const title =
    recipe?.name ?? fallbackName ?? (recipeId !== null ? `Recipe #${recipeId}` : "");

  const craftedItem = recipe?.craftedItem;
  const craftedHref = craftedItem ? wowheadUrl("item", craftedItem.id) : undefined;

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={context.professionName ? `${context.professionName} recipe` : undefined}
      media={{
        src: iconQuery.data ?? null,
        alt: "",
        kind: "icon",
        loading: enabled && iconQuery.isPending,
      }}
      rows={recipe ? buildRows(recipe, context) : undefined}
      sections={recipe ? buildSections(recipe) : undefined}
      loading={enabled && detailQuery.isPending}
      error={detailQuery.isError && recipe === undefined ? detailQuery.error : undefined}
      onRetry={() => void detailQuery.refetch()}
      errorContext="recipe details"
      actions={
        recipeId !== null ? (
          <>
            <Button component={RouterLink} to={workbenchUrl(recipeId)} size="small">
              Open in API workbench
            </Button>
            {/* Recipe ids are not spell ids, so only a crafted item has a Wowhead page to link. */}
            {craftedItem && craftedHref ? (
              <Button
                href={craftedHref}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {WOWHEAD_LABEL}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${craftedItem.name}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {notFound ? (
        <EmptyState
          compact
          title="Recipe not found"
          description={`Blizzard has no recipe #${recipeId ?? ""} in its game data.`}
        />
      ) : recipe &&
        recipe.reagents.length === 0 &&
        recipe.reagentSlots.length === 0 &&
        recipe.description.length === 0 &&
        !recipe.craftedItem &&
        !recipe.allianceCraftedItem &&
        !recipe.hordeCraftedItem ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard publishes nothing more for this recipe than its name.
        </Typography>
      ) : null}
    </DetailDialog>
  );
};

export default RecipeDialog;
