import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import { Chip, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useMemo } from "react";

import PageHeader from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import AuctionFilters from "@/features/auctionHouse/components/AuctionFilters";
import AuctionTable from "@/features/auctionHouse/components/AuctionTable";
import {
  AUCTION_SEARCH_MIN_LENGTH,
  COMMODITY_STALE_MS,
  REALM_STALE_MS,
  useAuctionSnapshot,
} from "@/features/auctionHouse/hooks/useAuctionSnapshot";
import { AUCTION_SEARCH_ITEM_PAGES } from "@/features/auctionHouse/services/auctionHouseService";
import type {
  AuctionMarketView,
  AuctionSortKey,
} from "@/features/auctionHouse/types";
import { isAuctionSortKey } from "@/features/auctionHouse/types";
import { useConnectedRealmCatalog } from "@/features/connectedRealms/hooks/useConnectedRealmSnapshots";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { MAX_SEARCH_PAGE_SIZE } from "@/lib/nameSearch";

export type AuctionHousePageProps = {
  /** Gold overline above the title (the nav section label). */
  eyebrow?: string;
};

const DEFAULT_EYEBROW = "Competitive & Economy";
const DEFAULT_SORT: AuctionSortKey = "price-desc";
/** A search is shopping for something: cheapest first unless a sort was picked. */
const DEFAULT_SEARCH_SORT: AuctionSortKey = "price-asc";
/** Most items one search resolves a name to (newest first). */
const SEARCH_PAGE_ITEMS = AUCTION_SEARCH_ITEM_PAGES * MAX_SEARCH_PAGE_SIZE;

/**
 * `view` defaults to "" (absent) so a bare `?realm=ID` deep link can be read
 * as the realm view; an explicit `view=commodities` is honoured. `sort`
 * defaults to "" so its default can follow whether a search is active.
 */
const URL_DEFAULTS = { view: "", realm: "", sort: "", q: "" };

const minutes = (ms: number): number => Math.round(ms / 60_000);

const parseRealmId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const AuctionHousePage = ({
  eyebrow = DEFAULT_EYEBROW,
}: AuctionHousePageProps): JSX.Element => {
  const theme = useTheme();
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);

  const realmId = parseRealmId(params.realm);
  const view: AuctionMarketView =
    params.view === "realm" || (params.view === "" && realmId !== null)
      ? "realm"
      : "commodities";
  const searchTerm = params.q;
  const hasSearchTerm = searchTerm.trim().length >= AUCTION_SEARCH_MIN_LENGTH;
  const sort: AuctionSortKey = isAuctionSortKey(params.sort)
    ? params.sort
    : hasSearchTerm
      ? DEFAULT_SEARCH_SORT
      : DEFAULT_SORT;

  const catalogQuery = useConnectedRealmCatalog({ enabled: view === "realm" });
  const snapshot = useAuctionSnapshot(view, realmId, sort, searchTerm);
  const { query, rows, search } = snapshot;

  const selectedRealm =
    view === "realm" && realmId !== null
      ? catalogQuery.data?.snapshots.find((entry) => entry.id === realmId)
      : undefined;

  const handleViewChange = useCallback(
    (next: AuctionMarketView): void => {
      // Keep `realm` so switching back restores the pick; spell out
      // `view=commodities` when a realm is present so the deep-link rule
      // above does not flip the view back.
      setParams(
        {
          view:
            next === "realm" ? "realm" : params.realm ? "commodities" : null,
        },
        { replace: true },
      );
    },
    [params.realm, setParams],
  );

  const handleRealmChange = useCallback(
    (next: number | null): void => {
      setParams({ realm: next === null ? null : String(next), view: "realm" });
    },
    [setParams],
  );

  const handleSortChange = useCallback(
    (next: AuctionSortKey): void => {
      setParams({ sort: next }, { replace: true });
    },
    [setParams],
  );

  const handleSearchChange = useCallback(
    (next: string): void => {
      setParams({ q: next.trim() ? next.trim() : null }, { replace: true });
    },
    [setParams],
  );

  const awaitingRealm = view === "realm" && realmId === null;
  const searchData = search.active ? snapshot.snapshot : undefined;
  const matchCount = search.matches?.items.length;

  // Stable element so `memo(AuctionTable)` skips the progress-tick re-renders.
  const emptyState = useMemo(() => {
    if (awaitingRealm) {
      return (
        <EmptyState
          title="Choose a connected realm"
          description={
            hasSearchTerm
              ? `Pick a connected realm above to search its listings for “${search.term}”`
              : "Pick a connected realm above to load its buyout listings"
          }
        />
      );
    }
    if (!search.active || matchCount === undefined) {
      return undefined;
    }
    if (matchCount === 0) {
      return (
        <EmptyState
          title={`No items named “${search.term}”`}
          description="Blizzard matches whole words: try the full name (“Draconium”, not “drac”)"
        />
      );
    }
    const where =
      view === "realm" ? "this realm's snapshot" : "the regional commodity snapshot";
    const scope = searchData && !searchData.complete ? `the part of ${where} searched` : where;
    return (
      <EmptyState
        title={`Nothing listed for “${search.term}”`}
        description={
          view === "realm"
            ? `${formatNumber(matchCount)} ${matchCount === 1 ? "item matches" : "items match"} that name, but none are in ${scope}. Ore, herbs, potions and other stackable goods sell region-wide: try Commodities.`
            : `${formatNumber(matchCount)} ${matchCount === 1 ? "item matches" : "items match"} that name, but none are in ${scope}. Gear, pets and other unstackable items sell per realm: try Connected realm.`
        }
      />
    );
  }, [awaitingRealm, hasSearchTerm, matchCount, search.active, search.term, searchData, view]);

  /*
   * What a search could not cover, said where the results are: Netlify ends
   * a streamed response at 20 MB (the commodity snapshot is larger), and a
   * broad word can name more items than are resolved.
   */
  const searchCaveats: string[] = [];
  if (searchData && !searchData.complete) {
    searchCaveats.push(
      `Searched the first ${formatNumber(searchData.scannedListings)} listings: the rest of Blizzard's ${
        view === "realm" ? "realm" : "commodity"
      } snapshot is past what this site can download, so some listings may be missing.`,
    );
  }
  if (search.active && search.matches?.truncated) {
    searchCaveats.push(
      `“${search.term}” matches more items than one search covers; only the newest (up to ${formatNumber(
        SEARCH_PAGE_ITEMS,
      )}) are included. Add a word to narrow it.`,
    );
  }

  return (
    <Stack
      spacing={{
        xs: theme.wc.layout.sectionGap.xs,
        md: theme.wc.layout.sectionGap.md,
      }}
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Auction House"
        icon={<GavelRoundedIcon />}
        description="Regional commodity prices and connected-realm buyouts from Blizzard's hourly auction snapshot."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {selectedRealm ? (
              <Chip size="small" label={`Realm ${selectedRealm.shortLabel}`} />
            ) : null}
          </>
        }
      />

      <AuctionFilters
        view={view}
        onViewChange={handleViewChange}
        realmId={realmId}
        onRealmChange={handleRealmChange}
        sort={sort}
        onSortChange={handleSortChange}
        catalogQuery={catalogQuery}
        snapshot={snapshot}
        searchValue={searchTerm}
        onSearchChange={handleSearchChange}
      />

      {searchCaveats.length > 0 ? (
        <Typography
          variant="caption"
          component="p"
          color="text.secondary"
          sx={{ margin: 0, maxWidth: "72ch" }}
        >
          {searchCaveats.join(" ")}
        </Typography>
      ) : null}

      {query.isError ? (
        <ErrorState
          error={query.error}
          context="auction house"
          onRetry={() => void query.refetch()}
        />
      ) : (
        <AuctionTable
          rows={rows}
          view={view}
          sort={sort}
          onSortChange={handleSortChange}
          loading={query.isPending && !awaitingRealm}
          emptyState={emptyState}
        />
      )}

      <Typography
        variant="caption"
        component="p"
        color="text.secondary"
        sx={{ margin: 0, maxWidth: "72ch" }}
      >
        {`Blizzard refreshes auction data hourly; this page re-downloads after ${minutes(
          COMMODITY_STALE_MS,
        )} minutes (commodities) or ${minutes(REALM_STALE_MS)} minutes (realm).`}
      </Typography>
    </Stack>
  );
};

export default AuctionHousePage;
