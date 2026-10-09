import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { memo, useId } from "react";

import CountBar from "@/features/modifiedCrafting/components/CountBar";
import ReagentIcon from "@/features/modifiedCrafting/components/ReagentIcon";
import { cardActionAreaSx, cardSx } from "@/features/modifiedCrafting/components/cardStyles";
import {
  CARD_ITEM_PAGE_SIZE,
  categoryItemsQuery,
} from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import {
  categoryName,
  formatId,
  pluralize,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import type { CategoryGroup } from "@/features/modifiedCrafting/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

export const CATEGORY_CARD_HEIGHT = 222;
const EFFECT_LINES = 2;
/** Ids written out before "+N". */
const ID_LIMIT = 3;

/**
 * Where the category stands in the slot-link map: `undefined` while the map
 * is not being built (the slot view's search), null while it loads, else
 * how many slot types take any of the group's ids.
 */
export type AcceptedCount = number | null | undefined;

export type CategoryCardProps = {
  group: CategoryGroup;
  accepted: AcceptedCount;
  /** The largest `accepted` in the set, for the bar. */
  acceptedMax: number;
  onSelect: (group: CategoryGroup) => void;
};

const idsCaption = (group: CategoryGroup): string => {
  if (group.ids.length === 1) {
    return `Category ${formatId(group.ids[0])}`;
  }
  const shown = group.ids.slice(0, ID_LIMIT).map(formatId).join(", ");
  const rest = group.ids.length - ID_LIMIT;
  return `${group.ids.length} ids · ${shown}${rest > 0 ? ` +${rest}` : ""}`;
};

/**
 * One reagent category (every id that shares its name, collapsed): the
 * icon of its newest reagent, the reagent's effect in words, how many
 * reagents carry it, and how many slot types accept it once the slot-link
 * map is built. Its reagent search loads as the card nears the viewport.
 */
const CategoryCard = ({ group, accepted, acceptedMax, onSelect }: CategoryCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const items = useQuery({
    ...categoryItemsQuery(group.newestId, CARD_ITEM_PAGE_SIZE),
    enabled: near,
  });
  const list = items.data?.items;
  const leadItem = list?.[0];
  const effect = list?.find((item) => item.effect !== null)?.effect ?? null;
  const name = categoryName({ id: group.newestId, name: group.name });
  const detailsId = useId();

  let reagentLine: string;
  if (list) {
    if (list.length === 0) {
      reagentLine = "No reagent found";
    } else {
      const count = `${list.length}${items.data?.more ? "+" : ""}`;
      reagentLine = `${count} reagent ${list.length === 1 && !items.data?.more ? "item" : "items"}`;
    }
  } else if (items.isError) {
    reagentLine = "Reagents unavailable";
  } else {
    reagentLine = "";
  }

  let acceptedLine: string | null = null;
  if (typeof accepted === "number") {
    acceptedLine =
      accepted > 0 ? `In ${pluralize(accepted, "slot type", "slot types")}` : "In no slot type";
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={cardSx(CATEGORY_CARD_HEIGHT)}>
      <CardActionArea
        onClick={() => onSelect(group)}
        aria-label={`${name}, ${idsCaption(group)}`}
        aria-describedby={`${detailsId}-effect ${detailsId}-footer`}
        sx={cardActionAreaSx}
      >
        <Stack spacing={1.25} useFlexGap sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <ReagentIcon
              item={leadItem}
              enabled={near}
              loading={items.isPending}
              fallbackLabel={name}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="subtitle1"
                component="span"
                title={name}
                sx={{ ...mixins.truncate, display: "block", fontWeight: 600 }}
              >
                {name}
              </Typography>
              <Typography
                variant="caption"
                component="span"
                color="text.secondary"
                sx={{ ...mixins.truncate, display: "block" }}
              >
                {idsCaption(group)}
              </Typography>
            </Box>
          </Stack>

          <Box
            id={`${detailsId}-effect`}
            sx={(theme) => ({
              minHeight: `calc(${EFFECT_LINES} * ${String(theme.typography.body2.lineHeight)}em)`,
              typography: "body2",
            })}
          >
            {items.isPending ? (
              <>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="65%" />
              </>
            ) : effect ? (
              <Typography
                variant="body2"
                color="text.secondary"
                component="p"
                sx={{ ...mixins.lineClamp(EFFECT_LINES), m: 0 }}
              >
                {effect}
              </Typography>
            ) : group.name === null && leadItem ? (
              <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
                {`Unnamed in the API; its reagent is ${leadItem.name}.`}
              </Typography>
            ) : null}
          </Box>

          <Stack id={`${detailsId}-footer`} spacing={0.75} sx={{ mt: "auto", minWidth: 0 }}>
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ minHeight: 24 }}>
              {reagentLine ? (
                <Chip size="small" variant="outlined" label={reagentLine} />
              ) : (
                <Skeleton variant="rounded" width={96} height={24} sx={{ borderRadius: 12 }} />
              )}
              {acceptedLine ? (
                <Chip
                  size="small"
                  variant={accepted ? "filled" : "outlined"}
                  label={acceptedLine}
                />
              ) : accepted === null ? (
                <Skeleton variant="rounded" width={108} height={24} sx={{ borderRadius: 12 }} />
              ) : null}
            </Stack>
            {typeof accepted === "number" ? (
              <CountBar
                value={accepted}
                max={acceptedMax}
                color={(theme) => theme.palette.primary.main}
              />
            ) : (
              <Box sx={{ height: 4 }} />
            )}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

// Memoized: the page re-renders with every slot type record while the
// slot-link map loads, and a card's own props rarely change with it.
export default memo(CategoryCard);
