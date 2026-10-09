import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import { EmptyState } from "@/components/common/StateBlocks";
import SourceDetails from "@/features/heirlooms/components/SourceDetails";
import UpgradeLadder from "@/features/heirlooms/components/UpgradeLadder";
import {
  heirloomIconQuery,
  heirloomQuery,
  prioritizeHeirloom,
} from "@/features/heirlooms/hooks/heirloomQueries";
import {
  itemLevelRange,
  slotLine,
} from "@/features/heirlooms/services/heirloomService";
import type { Heirloom } from "@/features/heirlooms/types";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type HeirloomDialogProps = {
  /** Whether the dialog is showing; `heirloomId` stays set through the close transition. */
  open: boolean;
  /** The heirloom to show (the last one opened). */
  heirloomId: number | null;
  /** The index's name for it, shown while the record loads. */
  fallbackName?: string;
  onClose: () => void;
};

/** The raw record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (heirloomId: number): string =>
  `/api-explorer/heirloom?${new URLSearchParams({
    endpoint: "heirloom",
    heirloomId: String(heirloomId),
  }).toString()}`;

type Fact = { label: string; value: ReactNode };

const Mono = ({ children }: { children: ReactNode }): JSX.Element => (
  <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
    {children}
  </Box>
);

const factsOf = (heirloom: Heirloom): Fact[] => {
  const facts: Fact[] = [];
  if (heirloom.slotName) {
    facts.push({ label: "Slot", value: heirloom.slotName });
  }
  if (heirloom.typeName) {
    facts.push({ label: "Type", value: heirloom.typeName });
  }
  const stats = heirloom.primaryStats
    .map((stat) => heirloom.statNames[stat])
    .filter((name): name is string => Boolean(name));
  if (stats.length > 0) {
    facts.push({ label: stats.length > 1 ? "Primary stats" : "Primary stat", value: stats.join(", ") });
  }
  facts.push({ label: "Source", value: heirloom.source.name });
  const range = itemLevelRange(heirloom);
  if (heirloom.maxUpgrade !== null) {
    facts.push({
      label: "Upgrades",
      value: range
        ? `${formatNumber(heirloom.maxUpgrade)} · item level ${range}`
        : formatNumber(heirloom.maxUpgrade),
    });
  } else if (range) {
    facts.push({ label: "Item level", value: range });
  }
  // From the top level's requirement line ("Requires level 1 to 69 (69)").
  const top = heirloom.tiers[heirloom.tiers.length - 1];
  if (top?.levelRange) {
    facts.push({
      label: "Scales across",
      value: `Levels ${formatNumber(top.levelRange.min)}–${formatNumber(top.levelRange.max)} when fully upgraded`,
    });
  }
  if (heirloom.binding) {
    facts.push({ label: "Binding", value: heirloom.binding });
  }
  if (heirloom.limitCategory || heirloom.unique) {
    facts.push({ label: "Unique", value: heirloom.limitCategory ?? heirloom.unique });
  }
  facts.push({ label: "Heirloom ID", value: <Mono>{heirloom.id}</Mono> });
  if (heirloom.itemId > 0) {
    facts.push({ label: "Item ID", value: <Mono>{heirloom.itemId}</Mono> });
  }
  return facts;
};

/** Label/value pairs, two columns of them on wider dialogs. */
const FactList = ({ facts }: { facts: Fact[] }): JSX.Element => (
  <Box
    component="dl"
    sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "minmax(96px, max-content) minmax(0, 1fr)",
        md: "minmax(96px, max-content) minmax(0, 1fr) minmax(96px, max-content) minmax(0, 1fr)",
      },
      columnGap: 2,
      rowGap: 1,
      m: 0,
    }}
  >
    {facts.map((fact) => (
      <Box key={fact.label} sx={{ display: "contents" }}>
        <Typography
          component="dt"
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 500, alignSelf: "baseline" }}
        >
          {fact.label}
        </Typography>
        <Typography
          component="dd"
          variant="body2"
          sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "baseline" }}
        >
          {fact.value}
        </Typography>
      </Box>
    ))}
  </Box>
);

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}): JSX.Element => {
  const headingId = useId();
  return (
    <Box component="section" aria-labelledby={headingId}>
      <Typography id={headingId} variant="overline" component="h3" sx={{ m: 0 }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: "72ch" }}>
          {description}
        </Typography>
      ) : (
        <Box sx={{ mb: 0.75 }} />
      )}
      {children}
    </Box>
  );
};

/**
 * One heirloom in full: its facts (slot, type, stats, source, upgrades and
 * the levels it scales across), the upgrade ladder with the tooltip at each
 * level and every level's numbers in a table, and where to get it. The
 * record is the one the collection already loaded, so it usually opens
 * with no request at all.
 */
const HeirloomDialog = ({
  open,
  heirloomId,
  fallbackName,
  onClose,
}: HeirloomDialogProps): JSX.Element => {
  const enabled = heirloomId !== null;
  const query = useQuery({ ...heirloomQuery(heirloomId ?? 0), enabled });
  const heirloom = enabled ? query.data : undefined;
  const notFound = enabled && query.data === null;
  const itemId = heirloom?.itemId ?? 0;
  const iconQuery = useQuery({ ...heirloomIconQuery(itemId), enabled: itemId > 0 });

  // Opened on a card whose record is still queued behind the collection's:
  // it jumps the line rather than waiting for every record ahead of it.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (open && heirloomId !== null) {
      prioritizeHeirloom(queryClient, heirloomId);
    }
  }, [open, heirloomId, queryClient]);

  // A Retry puts a record with no data back to pending and clears its error;
  // the last error stays on screen meanwhile, so the focused Retry button
  // does not vanish under the visitor. Anything else with no record yet is
  // loading: a first load, or a record that failed in the collection and is
  // fetched again as the dialog opens (this dialog never saw that error).
  const firstLoad = query.isPending && query.errorUpdateCount === 0;
  const [lastError, setLastError] = useState<{ id: number; error: Error } | null>(null);
  if (heirloomId !== null && query.error && lastError?.error !== query.error) {
    setLastError({ id: heirloomId, error: query.error });
  }
  const shownError =
    enabled && heirloom === undefined && !firstLoad
      ? (query.error ?? (lastError?.id === heirloomId ? lastError.error : undefined))
      : undefined;
  const loading = enabled && heirloom === undefined && shownError === undefined;

  const title =
    heirloom?.name ?? fallbackName ?? (heirloomId !== null ? `Heirloom #${heirloomId}` : "");
  const subtitle = heirloom
    ? [heirloom.variant, slotLine(heirloom)].filter(Boolean).join(" · ")
    : undefined;
  const wowhead = itemId > 0 ? wowheadUrl("item", itemId) : undefined;

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Heirloom not found"
          description={`Blizzard has no heirloom #${heirloomId ?? ""} in its game data.`}
        />
      );
    }
    if (!heirloom) {
      return null;
    }
    const levels = heirloom.tiers.length;
    return (
      <Stack spacing={3}>
        <FactList facts={factsOf(heirloom)} />
        <Section
          title="Upgrade ladder"
          description={
            levels > 1
              ? `The item at each of the ${formatNumber(levels)} upgrade levels Blizzard lists, with the character levels it scales across. Pick a level for its full tooltip. The API does not list the upgrade items or their costs.`
              : "The item as Blizzard lists it. The API does not list upgrade items or their costs."
          }
        >
          <UpgradeLadder heirloom={heirloom} />
        </Section>
        <Section title="Where to get it">
          <SourceDetails heirloom={heirloom} />
        </Section>
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={subtitle || undefined}
      quality="heirloom"
      media={{
        kind: "icon",
        src: iconQuery.data ?? null,
        alt: "",
        loading: heirloom === undefined ? loading : itemId > 0 && iconQuery.isPending,
      }}
      maxWidth="md"
      loading={loading}
      error={shownError}
      onRetry={() => {
        // A press while the retry is in flight is ignored rather than restarting it.
        if (!query.isFetching) {
          void query.refetch();
        }
      }}
      errorContext="heirloom details"
      actions={
        heirloomId !== null ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            <Button component={RouterLink} to={workbenchUrl(heirloomId)} size="small">
              Open in API workbench
            </Button>
            {wowhead ? (
              <Button
                href={wowhead}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {WOWHEAD_LABEL}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${title}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </Stack>
        ) : null
      }
    >
      {renderBody()}
    </DetailDialog>
  );
};

export default HeirloomDialog;
