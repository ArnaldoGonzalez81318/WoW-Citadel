import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import { Box, Button, Chip, Stack, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type { DetailDialogRow } from "@/components/common/DetailDialog";
import PageHeader from "@/components/common/PageHeader";
import { getResultCardHeight } from "@/components/common/ResultCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import RealmCard from "@/features/realms/components/RealmCard";
import RealmFilters from "@/features/realms/components/RealmFilters";
import RealmTable, {
  REALM_ROW_HEIGHT,
  realmTypeLabel,
} from "@/features/realms/components/RealmTable";
import { useRealmDirectory } from "@/features/realms/hooks/useRealmDirectory";
import type { RealmDirectoryRow } from "@/features/realms/types";
import { env } from "@/lib/env";
import {
  formatLocale,
  formatNumber,
  formatTimezone,
  humanizeEnum,
  toBcp47,
} from "@/lib/format";

export type RealmsPageProps = {
  /** Gold overline above the title (the nav section label). */
  eyebrow?: string;
};

const DEFAULT_EYEBROW = "World & Factions";
const SKELETON_ROWS = 12;
const SKELETON_CARDS = 8;
const COMPACT_CARD_HEIGHT = getResultCardHeight("compact");
const EMPTY = "—";

const realmStatusUrl = (): string =>
  `https://worldofwarcraft.blizzard.com/${toBcp47(
    env.locale,
  ).toLowerCase()}/game/status/${env.region}`;

const detailRows = (realm: RealmDirectoryRow): DetailDialogRow[] => {
  const typeLabel = realmTypeLabel(realm);
  const timezone = realm.timezone
    ? `${formatTimezone(realm.timezone)} · ${realm.timezone}`
    : EMPTY;
  const queue =
    realm.hasQueue === undefined ? EMPTY : realm.hasQueue ? "Active" : "None";

  return [
    { label: "Region", value: realm.regionName || env.region.toUpperCase() },
    { label: "Category", value: realm.category || EMPTY },
    { label: "Type", value: typeLabel || EMPTY },
    { label: "Time zone", value: timezone },
    { label: "Locale", value: realm.locale ? formatLocale(realm.locale) : EMPTY },
    { label: "Status", value: realm.statusLabel || EMPTY },
    {
      label: "Population",
      value: humanizeEnum(realm.populationType) || realm.populationLabel || EMPTY,
    },
    { label: "Queue", value: queue },
    {
      label: "Connected realm id",
      value: realm.connectedRealmId ? String(realm.connectedRealmId) : EMPTY,
    },
  ];
};

/**
 * Measures the filter bar so the table header can stick directly beneath
 * it (the bar itself sticks under the app header on md+).
 */
const useMeasuredHeight = (): [
  (node: HTMLDivElement | null) => void,
  number,
] => {
  const [height, setHeight] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const attach = useCallback((node: HTMLDivElement | null): void => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) {
      return;
    }

    setHeight(node.offsetHeight);
    if (typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(() => {
        setHeight(node.offsetHeight);
      });
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [attach, height];
};

const RealmsPage = ({ eyebrow = DEFAULT_EYEBROW }: RealmsPageProps): JSX.Element => {
  const theme = useTheme();
  // noSsr: match on the first render so the table never flashes as cards.
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
  const directory = useRealmDirectory();
  const {
    rows,
    total,
    sort,
    setSort,
    clearFilters,
    hasActiveFilters,
    isLoading,
    error,
    refetch,
    statusPending,
  } = directory;

  const [selected, setSelected] = useState<RealmDirectoryRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterBarRef, filterBarHeight] = useMeasuredHeight();

  const openRealm = useCallback((realm: RealmDirectoryRow): void => {
    setSelected(realm);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback((): void => {
    setDialogOpen(false);
  }, []);

  const stickyOffset = theme.wc.layout.headerHeight.md + filterBarHeight;

  const emptyState = (
    <EmptyState
      title="No realms match"
      description="Try another name or clear the filters"
      action={
        hasActiveFilters ? (
          <Button variant="outlined" size="small" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );

  const renderBody = (): JSX.Element => {
    if (isLoading) {
      return isDesktop ? (
        <LoadingSkeleton
          variant="rows"
          itemHeight={REALM_ROW_HEIGHT}
          count={SKELETON_ROWS}
          gap={0}
          label="Loading realms"
        />
      ) : (
        <LoadingSkeleton
          variant="grid"
          columns={{ xs: 1 }}
          itemHeight={COMPACT_CARD_HEIGHT}
          count={SKELETON_CARDS}
          label="Loading realms"
        />
      );
    }

    if (error) {
      return <ErrorState error={error} context="realms" onRetry={refetch} />;
    }

    if (isDesktop) {
      return (
        <RealmTable
          rows={rows}
          sort={sort}
          onSortChange={setSort}
          onSelect={openRealm}
          statusPending={statusPending}
          stickyOffset={stickyOffset}
          emptyState={emptyState}
        />
      );
    }

    return (
      <VirtualizedCardGrid
        items={rows}
        columns={{ xs: 1 }}
        itemHeight={COMPACT_CARD_HEIGHT}
        gap={16}
        aria-label="Realms"
        getItemKey={(row) => row.id}
        renderItem={(row, index) => (
          <RealmCard row={row} onSelect={openRealm} index={index} />
        )}
        emptyState={emptyState}
      />
    );
  };

  const selectedType = selected ? realmTypeLabel(selected) : "";
  const selectedSubtitle = selected
    ? [selectedType, selected.category].filter(Boolean).join(" · ")
    : undefined;

  return (
    <Stack
      spacing={{
        xs: theme.wc.layout.sectionGap.xs,
        md: theme.wc.layout.sectionGap.md,
      }}
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Realms"
        icon={<PublicRoundedIcon />}
        description={`Every ${env.region.toUpperCase()} realm with ruleset, category, time zone, locale and live status.`}
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            <Chip size="small" label={`${formatNumber(total)} realms`} />
          </>
        }
        actions={
          <Button
            variant="outlined"
            size="small"
            href={realmStatusUrl()}
            target="_blank"
            rel="noreferrer"
            endIcon={<LaunchRoundedIcon />}
          >
            Realm status on Blizzard
          </Button>
        }
      />

      {/*
        The wrapper is the sticky element (and the measured one): a sticky
        child inside a same-height wrapper could never leave the wrapper's
        box, so stickiness is applied here and the bar itself stays static.
      */}
      <Box
        ref={filterBarRef}
        sx={{
          minWidth: 0,
          position: { xs: "relative", md: "sticky" },
          top: { md: theme.wc.layout.headerHeight.md },
          zIndex: { md: theme.zIndex.appBar - 1 },
        }}
      >
        <RealmFilters directory={directory} sticky={false} />
      </Box>

      {renderBody()}

      <DetailDialog
        open={dialogOpen && selected !== null}
        onClose={closeDialog}
        title={selected?.name ?? ""}
        subtitle={selectedSubtitle || undefined}
        rows={selected ? detailRows(selected) : undefined}
        actions={
          selected ? (
            <>
              <Button
                variant="text"
                component={RouterLink}
                to={`/connected-realms?q=${encodeURIComponent(selected.name)}`}
              >
                Connected realm
              </Button>
              {selected.connectedRealmId ? (
                <Button
                  variant="contained"
                  component={RouterLink}
                  to={`/category/auction-house?view=realm&realm=${selected.connectedRealmId}`}
                >
                  Auction house
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
    </Stack>
  );
};

export default RealmsPage;
