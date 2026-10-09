import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Link, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import ReagentIcon from "@/features/modifiedCrafting/components/ReagentIcon";
import {
  DIALOG_ITEM_PAGE_SIZE,
  categoryItemsQuery,
} from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import useRetainedError from "@/features/modifiedCrafting/hooks/useRetainedError";
import {
  formatId,
  groupItemsByName,
  pluralize,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import type { ReagentItem } from "@/features/modifiedCrafting/types";
import useNearViewport from "@/hooks/useNearViewport";
import { wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { qualityColor, visuallyHidden } from "@/theme";

export type ReagentItemListProps = {
  categoryId: number;
};

/**
 * One reagent name: its icon (loaded as the row scrolls near; a category
 * can list fifty items), the name in its quality colour, the effect, and
 * each item id with that name as a Wowhead link.
 */
const ReagentRow = ({ name, items }: { name: string; items: ReagentItem[] }): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLLIElement>("200px 0px");
  const lead = items[0];
  const effect = items.find((item) => item.effect !== null)?.effect ?? null;
  return (
    <Box
      component="li"
      ref={nearRef}
      sx={(theme) => ({
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        minWidth: 0,
        p: 1,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.subtle}`,
        backgroundColor: theme.palette.surface.inset,
      })}
    >
      <ReagentIcon item={lead} enabled={near} size={40} fallbackLabel={name} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          component="p"
          sx={(theme) => ({
            m: 0,
            fontWeight: 600,
            color: qualityColor(theme, lead.quality),
            overflowWrap: "anywhere",
          })}
        >
          {name}
        </Typography>
        {effect ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            {effect}
          </Typography>
        ) : null}
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          columnGap={1.25}
          rowGap={0.25}
          sx={{ mt: 0.25 }}
          role="list"
          aria-label={`${name} item ids`}
        >
          {items.map((item) => (
            <Box component="span" role="listitem" key={item.id}>
              <Link
                href={wowheadUrl("item", item.id)}
                target="_blank"
                rel="noreferrer"
                variant="caption"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
              >
                {`Item ${formatId(item.id)}`}
                <Box component="span" sx={visuallyHidden}>
                  {`, ${name} (Wowhead, opens in a new tab)`}
                </Box>
                <OpenInNewRoundedIcon aria-hidden="true" sx={{ fontSize: 12 }} />
              </Link>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

/**
 * Every reagent item Blizzard's item search finds in one category, newest
 * first, same-name items (a reagent's quality ranks) on one row with each
 * id linking to Wowhead, and the modifier's effect in words when the item
 * record has a readable one.
 */
const ReagentItemList = ({ categoryId }: ReagentItemListProps): JSX.Element => {
  const query = useQuery(categoryItemsQuery(categoryId, DIALOG_ITEM_PAGE_SIZE));
  const retained = useRetainedError(`items-${categoryId}`, query);

  if (retained.error !== undefined) {
    return (
      <ErrorState
        compact
        error={retained.error}
        context="this category's reagents"
        onRetry={retained.retry}
        retryLabel={retained.retrying ? "Retrying…" : "Retry"}
      />
    );
  }
  if (!query.data) {
    return (
      <LoadingSkeleton variant="rows" count={2} itemHeight={56} gap={8} label="Loading reagents" />
    );
  }
  const { items, more } = query.data;
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        title="No reagent item found"
        description="Blizzard's item search finds no item tagged with this category."
      />
    );
  }
  const rows = groupItemsByName(items);
  const effectNote = items.some((item) => item.effect !== null && item.effectHasValue);

  return (
    <Stack spacing={1}>
      <Box
        component="ul"
        role="list"
        sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}
      >
        {rows.map((row) => (
          <ReagentRow key={row.name} name={row.name} items={row.items} />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
        {more
          ? `The newest ${formatNumber(items.length)} items; the category has more.`
          : `${pluralize(items.length, "item", "items")} under ${pluralize(
              rows.length,
              "name",
              "names",
            )}, newest first.`}
        {effectNote ? " X stands for a value the game fills in." : ""}
        {" Item links open Wowhead."}
      </Typography>
    </Stack>
  );
};

export default ReagentItemList;
