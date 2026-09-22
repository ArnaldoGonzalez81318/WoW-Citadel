import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import { Chip, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useMemo } from "react";

import PageHeader from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import AuctionFilters from "@/features/auctionHouse/components/AuctionFilters";
import AuctionTable from "@/features/auctionHouse/components/AuctionTable";
import {
  COMMODITY_STALE_MS,
  REALM_STALE_MS,
  useAuctionSnapshot,
} from "@/features/auctionHouse/hooks/useAuctionSnapshot";
import type {
  AuctionMarketView,
  AuctionSortKey,
} from "@/features/auctionHouse/types";
import { isAuctionSortKey } from "@/features/auctionHouse/types";
import { useConnectedRealmCatalog } from "@/features/connectedRealms/hooks/useConnectedRealmSnapshots";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";

export type AuctionHousePageProps = {
  /** Gold overline above the title (the nav section label). */
  eyebrow?: string;
};

const DEFAULT_EYEBROW = "Competitive & Economy";
const DEFAULT_SORT: AuctionSortKey = "price-desc";

/**
 * `view` defaults to "" (absent) so a bare `?realm=ID` deep link can be read
 * as the realm view; an explicit `view=commodities` is honoured.
 */
const URL_DEFAULTS = { view: "", realm: "", sort: DEFAULT_SORT };

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
  const sort: AuctionSortKey = isAuctionSortKey(params.sort)
    ? params.sort
    : DEFAULT_SORT;

  const catalogQuery = useConnectedRealmCatalog({ enabled: view === "realm" });
  const snapshot = useAuctionSnapshot(view, realmId, sort);
  const { query, rows } = snapshot;

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

  const awaitingRealm = view === "realm" && realmId === null;

  // Stable element so `memo(AuctionTable)` skips the progress-tick re-renders.
  const emptyState = useMemo(
    () =>
      awaitingRealm ? (
        <EmptyState
          title="Choose a connected realm"
          description="Pick a connected realm above to load its buyout listings"
        />
      ) : undefined,
    [awaitingRealm],
  );

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
      />

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
