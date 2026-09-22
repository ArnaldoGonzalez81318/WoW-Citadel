import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import {
  Autocomplete,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";

import {
  ExplorerFilterBar,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import { ErrorState } from "@/components/common/StateBlocks";
import { AUCTION_SORT_SCOPES } from "@/features/auctionHouse/hooks/useAuctionSnapshot";
import type { UseAuctionSnapshotResult } from "@/features/auctionHouse/hooks/useAuctionSnapshot";
import type {
  AuctionMarketView,
  AuctionSortKey,
} from "@/features/auctionHouse/types";
import { isAuctionSortKey } from "@/features/auctionHouse/types";
import type {
  ConnectedRealmCatalog,
  ConnectedRealmSnapshot,
} from "@/features/connectedRealms/types";
import { formatNumber, formatRelativeTime } from "@/lib/format";

const VIEW_OPTIONS: ReadonlyArray<SegmentedOption<AuctionMarketView>> = [
  { value: "commodities", label: "Commodities" },
  { value: "realm", label: "Connected realm" },
];

const SORT_OPTIONS: ReadonlyArray<{ value: AuctionSortKey; label: string }> = [
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "quantity-desc", label: "Quantity: high to low" },
  { value: "quantity-asc", label: "Quantity: low to high" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
];

const REALM_PICKER_MIN_WIDTH = 280;
const SORT_MIN_WIDTH = 180;
const RELATIVE_TIME_TICK_MS = 30_000;
const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

/** "1.2 MB" / "480 KB" for the download progress line. */
const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }
  if (bytes >= MEGABYTE) {
    return `${formatNumber(bytes / MEGABYTE, { maximumFractionDigits: 1 })} MB`;
  }
  return `${formatNumber(Math.max(1, Math.round(bytes / KILOBYTE)))} KB`;
};

/** Placeholder option for a `?realm=` id the catalog does not contain. */
const syntheticRealmOption = (id: number): ConnectedRealmSnapshot => {
  const label = `Connected realm #${id}`;
  return {
    id,
    realms: [],
    realmDetails: [],
    displayName: label,
    leadName: label,
    shortLabel: label,
    realmSlugs: [],
    realmTypes: [],
    timezones: [],
  };
};

const realmMatches = (
  option: ConnectedRealmSnapshot,
  needle: string,
): boolean =>
  option.displayName.toLowerCase().includes(needle) ||
  option.shortLabel.toLowerCase().includes(needle) ||
  option.realmSlugs.some((slug) => slug.toLowerCase().includes(needle));

/** Re-renders on an interval so "fetched 5 minutes ago" stays honest. */
const useRelativeTimeTick = (active: boolean): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), RELATIVE_TIME_TICK_MS);
    return () => clearInterval(timer);
  }, [active]);

  return now;
};

export type AuctionFiltersProps = {
  view: AuctionMarketView;
  onViewChange: (view: AuctionMarketView) => void;
  realmId: number | null;
  onRealmChange: (id: number | null) => void;
  sort: AuctionSortKey;
  onSortChange: (sort: AuctionSortKey) => void;
  /** Connected-realm catalog; only enabled in realm view by the page. */
  catalogQuery: UseQueryResult<ConnectedRealmCatalog>;
  snapshot: UseAuctionSnapshotResult;
};

/**
 * Filter strip: market view, connected-realm picker (realm view), sort,
 * Refresh and a live summary of the download / snapshot.
 */
const AuctionFilters = ({
  view,
  onViewChange,
  realmId,
  onRealmChange,
  sort,
  onSortChange,
  catalogQuery,
  snapshot,
}: AuctionFiltersProps): JSX.Element => {
  const { query, rows, progress, dataUpdatedAt } = snapshot;
  const sortLabelId = `auction-sort-${useId()}`;
  const isRealm = view === "realm";
  const now = useRelativeTimeTick(dataUpdatedAt > 0);

  const options = useMemo<ConnectedRealmSnapshot[]>(() => {
    const catalog = catalogQuery.data?.snapshots ?? [];
    if (realmId !== null && !catalog.some((option) => option.id === realmId)) {
      return [syntheticRealmOption(realmId), ...catalog];
    }
    return catalog;
  }, [catalogQuery.data, realmId]);

  const selected =
    realmId === null
      ? null
      : (options.find((option) => option.id === realmId) ?? null);

  const handleSort = (event: SelectChangeEvent<string>): void => {
    const next = event.target.value;
    if (isAuctionSortKey(next)) {
      onSortChange(next);
    }
  };

  const summary = ((): string | undefined => {
    if (isRealm && realmId === null) {
      return undefined;
    }
    if (query.isFetching) {
      // The proxy buffers Blizzard's whole dump before replying, so no bytes
      // arrive until it finishes; "0 KB" would read as a stall.
      return progress.bytesRead > 0
        ? `Downloading snapshot - ${formatBytes(progress.bytesRead)}, ${formatNumber(
            progress.scannedListings,
          )} listings scanned`
        : "Waiting for Blizzard's auction snapshot…";
    }
    const data = snapshot.snapshot;
    if (!data) {
      return undefined;
    }
    const fetched =
      dataUpdatedAt > 0
        ? ` · fetched ${formatRelativeTime(dataUpdatedAt, now)}`
        : "";
    return `Top ${formatNumber(rows.length)} by ${AUCTION_SORT_SCOPES[sort]} of ${formatNumber(
      data.scannedListings,
    )} listings${data.complete ? "" : " scanned"}${fetched}`;
  })();

  return (
    <ExplorerFilterBar
      label="Auction house filters"
      summary={summary}
      progress={query.isFetching}
    >
      <SegmentedControl
        label="Market view"
        size="small"
        options={VIEW_OPTIONS}
        value={view}
        onChange={onViewChange}
      />

      {isRealm ? (
        <>
          <Autocomplete<ConnectedRealmSnapshot, false, false, false>
            size="small"
            options={options}
            value={selected}
            loading={catalogQuery.isPending}
            onChange={(_event, next) => onRealmChange(next ? next.id : null)}
            getOptionLabel={(option) => option.shortLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            filterOptions={(candidates, state) => {
              const needle = state.inputValue.trim().toLowerCase();
              return needle.length === 0
                ? candidates
                : candidates.filter((option) => realmMatches(option, needle));
            }}
            renderOption={(props, option) => {
              // MUI v6 puts `key` in props; React forbids spreading it.
              const { key: _ignored, ...optionProps } = props;
              return (
                <li key={option.id} {...optionProps}>
                  {option.shortLabel}
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField {...params} label="Connected realm" />
            )}
            noOptionsText="No connected realms match"
            sx={{ minWidth: REALM_PICKER_MIN_WIDTH, flex: { xs: 1, md: "0 1 360px" } }}
          />
          {catalogQuery.isError ? (
            <ErrorState
              compact
              error={catalogQuery.error}
              context="connected realms"
              onRetry={() => void catalogQuery.refetch()}
              sx={{ flexBasis: "100%" }}
            />
          ) : null}
        </>
      ) : null}

      <FormControl size="small" sx={{ minWidth: SORT_MIN_WIDTH }}>
        <InputLabel id={sortLabelId}>Sort</InputLabel>
        <Select
          labelId={sortLabelId}
          label="Sort"
          value={sort}
          onChange={handleSort}
        >
          {SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        size="small"
        variant="outlined"
        startIcon={<AutorenewRoundedIcon />}
        disabled={query.isFetching || (isRealm && realmId === null)}
        onClick={() => void query.refetch()}
      >
        Refresh
      </Button>
    </ExplorerFilterBar>
  );
};

export default AuctionFilters;
