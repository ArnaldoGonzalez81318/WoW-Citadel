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
import { memo, useEffect, useId } from "react";

import CountBar from "@/features/modifiedCrafting/components/CountBar";
import ReagentIcon from "@/features/modifiedCrafting/components/ReagentIcon";
import ThemeGlyph from "@/features/modifiedCrafting/components/ThemeGlyph";
import { cardActionAreaSx, cardSx } from "@/features/modifiedCrafting/components/cardStyles";
import {
  CARD_ITEM_PAGE_SIZE,
  categoryItemsQuery,
  promoteSlotType,
  slotTypeQuery,
} from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import {
  categoryName,
  formatId,
  pluralize,
  slotTypeName,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import {
  SLOT_THEME_BY_ID,
  themeAccentColor,
} from "@/features/modifiedCrafting/services/slotThemes";
import type { SlotThemeId } from "@/features/modifiedCrafting/services/slotThemes";
import type { SlotTypeRef } from "@/features/modifiedCrafting/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

/**
 * Every line is reserved whether or not the slot fills it, so skeleton cells
 * match: two lines of chips; a card whose chips wrap further grows.
 */
export const SLOT_CARD_HEIGHT = 206;
/** Category chips before "+N more". */
const CHIP_LIMIT = 3;
/** The most categories one slot type takes on US (an embellishment slot): the bars' full width. */
export const SLOT_CATEGORY_SCALE = 15;

export type SlotTypeCardProps = {
  slot: SlotTypeRef;
  theme: SlotThemeId;
  /** Names the theme in the caption, for lists that mix themes (search results). */
  showTheme?: boolean;
  onSelect: (slot: SlotTypeRef) => void;
};

/**
 * One reagent slot type: the icon of a reagent it takes (or its theme's
 * glyph), its name and id (names repeat, ids do not), how many categories
 * it accepts as a count and a bar, and the first of them as chips. Its
 * record, and the reagent search behind the icon, load as the card nears
 * the viewport. The whole card opens the dialog.
 */
const SlotTypeCard = ({
  slot,
  theme: themeId,
  showTheme = false,
  onSelect,
}: SlotTypeCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...slotTypeQuery(slot.id), enabled: near });
  // The slot-link map may already have queued this record behind hundreds
  // of others; this card then shares that fetch, so move it up. Keyed on the
  // fetch status too: the map can queue it after the card came near.
  useEffect(() => {
    if (near && query.fetchStatus === "fetching") {
      promoteSlotType(slot.id);
    }
  }, [near, query.fetchStatus, slot.id]);
  const record = query.data;
  const firstCategory = record?.categories[0];
  const items = useQuery({
    ...categoryItemsQuery(firstCategory?.id ?? 0, CARD_ITEM_PAGE_SIZE),
    enabled: near && firstCategory !== undefined,
  });
  const leadItem = items.data?.items[0];
  const name = slotTypeName(record ?? slot);
  const detailsId = useId();
  const themeLabel = SLOT_THEME_BY_ID.get(themeId)?.label ?? "";

  const loading = query.isPending;
  let summary: string;
  if (record) {
    summary =
      record.categories.length > 0
        ? `Accepts ${pluralize(record.categories.length, "category", "categories")}`
        : "Accepts no category";
  } else if (query.isError) {
    summary = "Details unavailable";
  } else if (record === null) {
    summary = "Not in Blizzard's game data";
  } else {
    summary = "";
  }
  const shown = record?.categories.slice(0, CHIP_LIMIT) ?? [];
  const hidden = (record?.categories.length ?? 0) - shown.length;

  return (
    <Card ref={nearRef} variant="outlined" sx={cardSx(SLOT_CARD_HEIGHT)}>
      <CardActionArea
        onClick={() => onSelect({ id: slot.id, name: record?.name ?? slot.name })}
        // Names repeat across expansions, so the id is part of the name.
        aria-label={`${name}, slot type ${formatId(slot.id)}`}
        aria-describedby={`${detailsId}-summary ${detailsId}-chips`}
        sx={cardActionAreaSx}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={(theme) => ({
            display: "block",
            height: 3,
            flexShrink: 0,
            backgroundColor: themeAccentColor(theme, themeId),
            opacity: 0.8,
          })}
        />
        <Stack spacing={1.25} useFlexGap sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <ReagentIcon
              item={leadItem}
              enabled={near}
              loading={loading || (firstCategory !== undefined && items.isPending)}
              fallback={<ThemeGlyph theme={themeId} size={56} />}
              fallbackLabel={name}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {/* A heading may not sit inside the action area's <button>;
                  its aria-label names the card instead. */}
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
                {`Slot type ${formatId(slot.id)}${showTheme && themeLabel ? ` · ${themeLabel}` : ""}`}
              </Typography>
            </Box>
          </Stack>

          <Box>
            {summary ? (
              <Typography
                id={`${detailsId}-summary`}
                variant="body2"
                component="p"
                color={record ? "text.primary" : "text.secondary"}
                sx={{ m: 0, mb: 0.5, fontVariantNumeric: "tabular-nums" }}
              >
                {summary}
              </Typography>
            ) : (
              <Skeleton
                id={`${detailsId}-summary`}
                variant="text"
                width="55%"
                sx={{ fontSize: "0.875rem", mb: 0.5 }}
              />
            )}
            <CountBar
              value={record?.categories.length ?? 0}
              max={SLOT_CATEGORY_SCALE}
              color={(theme) => themeAccentColor(theme, themeId)}
            />
          </Box>

          {/* Not clipped to two lines: on a phone the chips and "+N more" can
              wrap to three or four, and clipping would hide the very count
              that says more exist. The card grows instead. */}
          <Stack
            id={`${detailsId}-chips`}
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={0.75}
            sx={{ minWidth: 0 }}
          >
            {loading ? (
              <>
                <Skeleton variant="rounded" width={110} height={24} sx={{ borderRadius: 12 }} />
                <Skeleton variant="rounded" width={86} height={24} sx={{ borderRadius: 12 }} />
              </>
            ) : (
              <>
                {shown.map((category) => (
                  <Chip
                    key={category.id}
                    size="small"
                    variant="outlined"
                    label={categoryName(category)}
                    sx={{ maxWidth: "100%" }}
                  />
                ))}
                {hidden > 0 ? (
                  <Chip size="small" label={`+${pluralize(hidden, "more", "more")}`} />
                ) : null}
              </>
            )}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

// Memoized: the page re-renders with every slot type record while the
// slot-link map loads, and a card's own props rarely change with it.
export default memo(SlotTypeCard);
