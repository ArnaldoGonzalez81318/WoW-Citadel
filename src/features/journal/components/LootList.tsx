import { Box, Link, Pagination, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useRef, useState } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import { EmptyState, LiveStatus } from "@/components/common/StateBlocks";
import { scrollMarginSx } from "@/features/journal/components/journalStyles";
import { lootIconQuery } from "@/features/journal/hooks/journalQueries";
import { pluralize } from "@/features/journal/services/journalService";
import type { JournalLootItem } from "@/features/journal/types";
import useNearViewport from "@/hooks/useNearViewport";
import { wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

const LOOT_PAGE_SIZE = 25;
const LOOT_COLS: GridColumns = { xs: 1, sm: 2, lg: 3 };
const LOOT_ROW_HEIGHT = 56;

export type LootListProps = {
  loot: JournalLootItem[];
  encounterName: string;
};

/**
 * One drop: its icon (from the Items explorer's cache, loaded as the row
 * nears the viewport) and its name, linked to Wowhead, whose item ids are
 * Blizzard's. Same-name drops (a dungeon's Normal and Heroic versions) also
 * show their item id, so the two links can be told apart.
 */
const LootRow = ({ item, showId }: { item: JournalLootItem; showId: boolean }): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({ ...lootIconQuery(item.itemId), enabled: near });
  const href = wowheadUrl("item", item.itemId);
  return (
    <Stack
      ref={nearRef}
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={(theme) => ({
        minWidth: 0,
        minHeight: LOOT_ROW_HEIGHT,
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
        loading={iconQuery.isPending}
      />
      <Box sx={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
        {href ? (
          <Link href={href} target="_blank" rel="noreferrer" variant="body2">
            {item.name}
            <Box component="span" sx={visuallyHidden}>
              {showId ? `, item ${item.itemId}` : ""}
              {" (Wowhead, opens in a new tab)"}
            </Box>
          </Link>
        ) : (
          <Typography variant="body2" component="span">
            {item.name}
          </Typography>
        )}
        {showId ? (
          <Typography
            variant="caption"
            color="text.secondary"
            component="span"
            aria-hidden="true"
            sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}
          >
            {`Item ${item.itemId}`}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
};

/**
 * An encounter's loot table, 25 drops to a page (Sadana Bloodfury alone
 * lists 41). Mount it with a `key` per encounter so the page resets.
 */
const LootList = ({ loot, encounterName }: LootListProps): JSX.Element => {
  const headingId = useId();
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(loot.length / LOOT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * LOOT_PAGE_SIZE;
  const shown = loot.slice(start, start + LOOT_PAGE_SIZE);

  const repeatedNames = useMemo(() => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    loot.forEach((item) => {
      if (seen.has(item.name)) {
        repeated.add(item.name);
      }
      seen.add(item.name);
    });
    return repeated;
  }, [loot]);

  // A list is read from the top: a new page starts at its first drop.
  const handlePageChange = (next: number): void => {
    setPage(next);
    topRef.current?.scrollIntoView({ block: "start" });
  };

  return (
    <Stack component="section" aria-labelledby={headingId} spacing={1.5} ref={topRef} sx={scrollMarginSx}>
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
        <Typography id={headingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
          Loot
        </Typography>
        {loot.length > 0 ? (
          <Typography variant="caption" color="text.secondary" component="span">
            {pluralize(loot.length, "item", "items")}
          </Typography>
        ) : null}
      </Stack>
      {loot.length === 0 ? (
        <EmptyState
          compact
          title="No loot listed"
          description={`Blizzard's journal lists no drops for ${encounterName}.`}
        />
      ) : (
        <>
          {pageCount > 1 ? (
            <LiveStatus sx={{ typography: "caption" }}>
              {`Showing ${formatNumber(start + 1)}–${formatNumber(start + shown.length)} of ${pluralize(loot.length, "item", "items")}`}
            </LiveStatus>
          ) : null}
          <Box
            component="ul"
            role="list"
            aria-labelledby={headingId}
            sx={{ display: "grid", gap: 1, listStyle: "none", m: 0, p: 0, ...gridTemplateColumnsSx(LOOT_COLS) }}
          >
            {shown.map((item) => (
              <Box component="li" key={item.id} sx={{ minWidth: 0 }}>
                <LootRow item={item} showId={repeatedNames.has(item.name)} />
              </Box>
            ))}
          </Box>
          {pageCount > 1 ? (
            <Pagination
              count={pageCount}
              page={currentPage}
              onChange={(_event, next) => handlePageChange(next)}
              siblingCount={0}
              aria-label="Loot pages"
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
};

export default LootList;
