import ShieldMoonRoundedIcon from "@mui/icons-material/ShieldMoonRounded";
import { Box, Chip } from "@mui/material";
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import type { PageHeaderBreadcrumb } from "@/components/common/PageHeader";
import { ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import CovenantCard from "@/features/covenants/components/CovenantCard";
import CovenantDetailDialog from "@/features/covenants/components/CovenantDetailDialog";
import {
  fetchCovenantCard,
  fetchCovenantIndex,
} from "@/features/covenants/services/covenantService";
import { env } from "@/lib/env";

export type CovenantPageProps = {
  /** Nav section shown as the gold eyebrow (CategoryPage passes it). */
  eyebrow?: string;
  /** Home › Section › Page trail (CategoryPage passes it). */
  breadcrumbs?: PageHeaderBreadcrumb[];
};

const ONE_HOUR = 3_600_000;
const CARD_HEIGHT = 232;

/** Four fixed items: the rows preset would orphan one card at xl. */
const COLS: GridColumns = { xs: 1, sm: 2, lg: 4 };

const CovenantPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CovenantPageProps): JSX.Element => {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const indexQuery = useQuery({
    queryKey: ["covenant-index", env.region],
    queryFn: ({ signal }) => fetchCovenantIndex(signal),
    staleTime: ONE_HOUR,
  });

  const covenants = useMemo(
    () => indexQuery.data?.covenants ?? [],
    [indexQuery.data],
  );

  const cardQueries = useQueries({
    queries: covenants.map((covenant) => ({
      queryKey: ["covenant-card", covenant.id, env.region],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchCovenantCard(covenant.id, signal),
      staleTime: ONE_HOUR,
      retry: false,
    })),
  });

  const selectedIndex = covenants.findIndex(
    (covenant) => covenant.id === selectedId,
  );
  const selectedSummary =
    selectedIndex >= 0 ? covenants[selectedIndex] : undefined;
  const selectedEntry =
    selectedIndex >= 0 ? cardQueries[selectedIndex] : undefined;

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Covenants"
        documentTitle="Covenants"
        icon={<ShieldMoonRoundedIcon />}
        description="Every covenant in Blizzard's index, from the Shadowlands four to later renown factions, with signature and class abilities and renown rewards."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {covenants.length > 0 ? (
              <Chip size="small" label={`${covenants.length} covenants`} />
            ) : null}
          </>
        }
      />

      {indexQuery.isLoading ? (
        <LoadingSkeleton
          variant="grid"
          columns={COLS}
          itemHeight={CARD_HEIGHT}
          count={4}
          label="Loading covenants"
        />
      ) : indexQuery.isError ? (
        <ErrorState
          error={indexQuery.error}
          context="covenants"
          onRetry={() => void indexQuery.refetch()}
        />
      ) : (
        <Box
          component="ul"
          aria-label="Covenants"
          sx={{
            display: "grid",
            gap: 2,
            listStyle: "none",
            margin: 0,
            padding: 0,
            ...gridTemplateColumnsSx(COLS),
          }}
        >
          {covenants.map((covenant, index) => {
            const entry = cardQueries[index];

            return (
              <Box component="li" key={covenant.id} sx={{ minWidth: 0 }}>
                <CovenantCard
                  summary={covenant}
                  data={entry?.data}
                  loading={entry?.isPending ?? true}
                  failed={entry?.isError ?? false}
                  onSelect={() => setSelectedId(covenant.id)}
                />
              </Box>
            );
          })}
        </Box>
      )}

      <CovenantDetailDialog
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        covenant={selectedSummary}
        data={selectedEntry?.data}
        loading={selectedEntry?.isPending}
        error={selectedEntry?.error ?? undefined}
        onRetry={() => void selectedEntry?.refetch()}
      />
    </Box>
  );
};

export default CovenantPage;
