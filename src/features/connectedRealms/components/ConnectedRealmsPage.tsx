import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Button, Chip, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMemo } from "react";

import { GRID_PRESETS } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import ConnectedRealmCard, {
  CONNECTED_REALM_CARD_HEIGHT,
} from "@/features/connectedRealms/components/ConnectedRealmCard";
import ConnectedRealmFilters, {
  useConnectedRealmFilters,
} from "@/features/connectedRealms/components/ConnectedRealmFilters";
import { useConnectedRealmCatalog } from "@/features/connectedRealms/hooks/useConnectedRealmSnapshots";
import type { ConnectedRealmSnapshot } from "@/features/connectedRealms/types";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";

const EYEBROW = "World & Factions";
const SKELETON_COUNT = 9;
const EMPTY_SNAPSHOTS: ConnectedRealmSnapshot[] = [];

const ConnectedRealmsPage = (): JSX.Element => {
  const theme = useTheme();
  const catalogQuery = useConnectedRealmCatalog();
  const snapshots = catalogQuery.data?.snapshots ?? EMPTY_SNAPSHOTS;
  const failedCount = catalogQuery.data?.failedCount ?? 0;
  const filterState = useConnectedRealmFilters(snapshots);
  const { visible, filters, clearFilters, hasActiveFilters } = filterState;

  const highlightQuery = useMemo(() => filters.q.trim(), [filters.q]);

  const renderBody = (): JSX.Element => {
    if (catalogQuery.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={GRID_PRESETS.rows}
          itemHeight={CONNECTED_REALM_CARD_HEIGHT}
          count={SKELETON_COUNT}
          label="Loading connected realms"
        />
      );
    }

    if (catalogQuery.isError) {
      return (
        <ErrorState
          error={catalogQuery.error}
          context="connected realms"
          onRetry={() => void catalogQuery.refetch()}
        />
      );
    }

    return (
      <VirtualizedCardGrid
        items={visible}
        columns={GRID_PRESETS.rows}
        itemHeight={CONNECTED_REALM_CARD_HEIGHT}
        gap={16}
        aria-label="Connected realms"
        getItemKey={(snapshot) => snapshot.id}
        renderItem={(snapshot) => (
          <ConnectedRealmCard snapshot={snapshot} highlightQuery={highlightQuery} />
        )}
        emptyState={
          <EmptyState
            title="No connected realms match"
            description="Try another realm name or clear the filters"
            action={
              hasActiveFilters ? (
                <Button variant="outlined" size="small" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    );
  };

  return (
    <Stack
      spacing={{
        xs: theme.wc.layout.sectionGap.xs,
        md: theme.wc.layout.sectionGap.md,
      }}
    >
      <PageHeader
        eyebrow={EYEBROW}
        title="Connected Realms"
        icon={<PublicRoundedIcon />}
        description={`Live connected-realm clusters for ${env.region.toUpperCase()}: member realms, status, population and queue state.`}
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            <Chip
              size="small"
              label={`${formatNumber(snapshots.length)} clusters`}
            />
          </>
        }
      />

      <ConnectedRealmFilters
        filterState={filterState}
        total={snapshots.length}
        isFetching={catalogQuery.isFetching}
      />

      {failedCount > 0 ? (
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <LiveStatus busy={catalogQuery.isFetching}>
            {`${formatNumber(failedCount)} ${
              failedCount === 1 ? "cluster" : "clusters"
            } could not be loaded`}
          </LiveStatus>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            disabled={catalogQuery.isFetching}
            onClick={() => void catalogQuery.refetch()}
          >
            Retry
          </Button>
        </Stack>
      ) : null}

      {renderBody()}
    </Stack>
  );
};

export default ConnectedRealmsPage;
