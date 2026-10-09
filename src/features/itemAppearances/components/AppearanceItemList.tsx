import { Box, Link, Pagination, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";

import MediaTile from "@/components/common/MediaTile";
import { LiveStatus } from "@/components/common/StateBlocks";
import {
  appearanceItemQuery,
  itemIconQuery,
} from "@/features/itemAppearances/hooks/appearanceQueries";
import { pluralize } from "@/features/itemAppearances/services/appearanceService";
import type { NamedRef } from "@/features/itemAppearances/types";
import useNearViewport from "@/hooks/useNearViewport";
import { wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { qualityColor, visuallyHidden } from "@/theme";

/** Rows per page: most looks are worn by a handful of items, a few by dozens. */
const ITEM_PAGE_SIZE = 10;
const ITEM_ROW_HEIGHT = 60;

/**
 * One item that wears the look: its icon and its name in its quality's
 * colour, linked to Wowhead (whose item ids are Blizzard's), with its item
 * level. Icon and record load as the row nears the viewport.
 */
const ItemRow = ({ item, showId }: { item: NamedRef; showId: boolean }): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({ ...itemIconQuery(item.id, "dialog"), enabled: near });
  const recordQuery = useQuery({ ...appearanceItemQuery(item.id), enabled: near });
  const record = recordQuery.data;
  const href = wowheadUrl("item", item.id);
  const facts = [
    record?.level !== undefined ? `Item level ${formatNumber(record.level)}` : undefined,
    record?.qualityName,
    record?.inventoryType,
  ].filter(Boolean);

  return (
    <Stack
      ref={nearRef}
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={(theme) => ({
        minWidth: 0,
        minHeight: ITEM_ROW_HEIGHT,
        px: 1.5,
        py: 1,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderRadius: `${theme.wc.radius.md}px`,
        backgroundColor: theme.palette.surface.inset,
      })}
    >
      <MediaTile
        size={40}
        src={iconQuery.data ?? null}
        alt=""
        fallbackLabel={item.name}
        quality={record?.quality}
        loading={iconQuery.isPending}
      />
      <Box sx={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
        {href ? (
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            variant="body2"
            sx={(theme) => ({
              fontWeight: 600,
              color: record?.quality ? qualityColor(theme, record.quality) : undefined,
            })}
          >
            {item.name}
            <Box component="span" sx={visuallyHidden}>
              {showId ? `, item ${item.id}` : ""}
              {" (Wowhead, opens in a new tab)"}
            </Box>
          </Link>
        ) : (
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {item.name}
          </Typography>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          component="span"
          sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}
        >
          {recordQuery.isPending ? (
            <Skeleton variant="text" width="45%" />
          ) : (
            [...facts, `#${item.id}`].join(" · ")
          )}
        </Typography>
      </Box>
    </Stack>
  );
};

export type AppearanceItemListProps = {
  items: readonly NamedRef[];
};

/**
 * Every item that shares one look, ten to a page. Mount it with a `key` per
 * appearance so its page resets.
 */
const AppearanceItemList = ({ items }: AppearanceItemListProps): JSX.Element => {
  const headingId = useId();
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / ITEM_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * ITEM_PAGE_SIZE;
  const shown = items.slice(start, start + ITEM_PAGE_SIZE);

  // Blizzard reuses names across versions of an item: those rows show their id.
  const repeated = new Set<string>();
  const seen = new Set<string>();
  items.forEach((item) => {
    if (seen.has(item.name)) {
      repeated.add(item.name);
    }
    seen.add(item.name);
  });

  const range = `${formatNumber(start + 1)}–${formatNumber(start + shown.length)}`;
  const rangeLabel = `Showing ${range} of ${pluralize(items.length, "item", "items")}`;

  const handlePageChange = (next: number): void => {
    setPage(next);
    topRef.current?.scrollIntoView({ block: "nearest" });
  };

  return (
    <Box component="section" aria-labelledby={headingId} ref={topRef}>
      <Typography id={headingId} variant="overline" component="h3" sx={{ m: 0, mb: 0.75 }}>
        {`Items with this look (${formatNumber(items.length)})`}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard&apos;s record lists no items for this appearance.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {pageCount > 1 ? (
            <LiveStatus sx={{ typography: "caption" }}>
              {rangeLabel}
            </LiveStatus>
          ) : null}
          <Box
            component="ul"
            role="list"
            aria-labelledby={headingId}
            sx={{ display: "grid", gap: 1, listStyle: "none", m: 0, p: 0 }}
          >
            {shown.map((item, index) => (
              <Box component="li" key={`${item.id}-${start + index}`} sx={{ minWidth: 0 }}>
                <ItemRow item={item} showId={repeated.has(item.name)} />
              </Box>
            ))}
          </Box>
          {pageCount > 1 ? (
            <Pagination
              count={pageCount}
              page={currentPage}
              onChange={(_event, next) => handlePageChange(next)}
              siblingCount={0}
              aria-label="Item pages"
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </Stack>
      )}
    </Box>
  );
};

export default AppearanceItemList;
