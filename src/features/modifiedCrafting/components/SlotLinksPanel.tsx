import HubRoundedIcon from "@mui/icons-material/HubRounded";
import {
  Box,
  ButtonBase,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";

import SectionCard from "@/components/common/SectionCard";
import { ErrorState } from "@/components/common/StateBlocks";
import CountBar from "@/features/modifiedCrafting/components/CountBar";
import type { RetainedError } from "@/features/modifiedCrafting/hooks/useRetainedError";
import type { SlotLinks } from "@/features/modifiedCrafting/hooks/useSlotLinks";
import {
  categoryName,
  formatId,
  pluralize,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import type { CategoryRef } from "@/features/modifiedCrafting/types";
import { formatNumber } from "@/lib/format";
import { focusRing, mixins } from "@/theme";

const TOP_COUNT = 6;

export type SlotLinksPanelProps = {
  links: SlotLinks;
  /** The slot type list's own failure: without it there is nothing to read. */
  listError: RetainedError;
  categories: readonly CategoryRef[];
  onOpenCategory: (category: CategoryRef) => void;
};

const Stat = ({
  value,
  label,
  share,
}: {
  value: string;
  label: string;
  share: number | null;
}): JSX.Element => (
  <Box
    component="li"
    sx={(theme) => ({
      minWidth: 0,
      p: 1.5,
      borderRadius: `${theme.wc.radius.md}px`,
      border: `1px solid ${theme.palette.border.subtle}`,
      backgroundColor: theme.palette.surface.inset,
    })}
  >
    <Typography
      variant="h5"
      component="p"
      sx={{ m: 0, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}
    >
      {value}
    </Typography>
    <Typography
      variant="caption"
      color="text.secondary"
      component="p"
      sx={{ m: 0, mb: share === null ? 0 : 0.75 }}
    >
      {label}
    </Typography>
    {share !== null ? (
      <CountBar value={share} max={1} color={(theme) => theme.palette.primary.main} />
    ) : null}
  </Box>
);

/**
 * The slot-link map's state: a progress bar while the 389 slot type records
 * load, then what the finished map says (how many categories fit a slot,
 * how many fit none, the most widely accepted ones as bars that open them).
 * A record that fails holds the map at "partial" with a Retry that stays
 * put while it runs.
 */
const SlotLinksPanel = ({
  links,
  listError,
  categories,
  onOpenCategory,
}: SlotLinksPanelProps): JSX.Element => {
  // A retried record has no error until it fails again: keep showing the
  // last one meanwhile, so the focused Retry button stays where it is.
  const [lastError, setLastError] = useState<Error | null>(null);
  if (links.error !== null && links.error !== lastError) {
    setLastError(links.error);
  }
  const error = links.error ?? lastError;

  const done = links.settled;
  const stats = useMemo(() => {
    if (!done) {
      return null;
    }
    const linked = categories.filter((category) => links.acceptedBy.has(category.id)).length;
    let single = 0;
    links.records.forEach((record) => {
      if (record.categories.length === 1) {
        single += 1;
      }
    });
    const top = categories
      .map((category) => ({ category, count: links.acceptedBy.get(category.id)?.length ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count || right.category.id - left.category.id)
      .slice(0, TOP_COUNT);
    return { linked, single, top };
  }, [done, categories, links.acceptedBy, links.records]);

  const progress = links.total > 0 ? Math.round((links.loadedCount / links.total) * 100) : 0;

  const renderBody = (): JSX.Element => {
    if (!links.listed && listError.error !== undefined) {
      return (
        <ErrorState
          compact
          error={listError.error}
          context="the slot type list these links are read from"
          onRetry={listError.retry}
          retryLabel={listError.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (!stats) {
      return (
        <Stack spacing={1}>
          <Typography
            variant="body2"
            component="p"
            sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}
          >
            {links.total > 0
              ? `Reading slot type records, six at a time: ${formatNumber(links.loadedCount)} of ${formatNumber(links.total)}`
              : "Waiting for the slot type list…"}
          </Typography>
          <LinearProgress
            variant={links.total > 0 ? "determinate" : "indeterminate"}
            value={progress}
            aria-label="Slot type records read"
            aria-valuetext={
              links.total > 0
                ? `${formatNumber(links.loadedCount)} of ${formatNumber(links.total)}`
                : undefined
            }
            sx={(theme) => ({ height: 6, borderRadius: `${theme.wc.radius.pill}px` })}
          />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            Blizzard lists only which categories each slot type accepts, so answering the reverse
            means reading every slot type once. Records already read stay with this tab for a day;
            leaving this view pauses the reading.
          </Typography>
        </Stack>
      );
    }
    const total = categories.length;
    return (
      <Stack spacing={2.5}>
        <Box
          component="ul"
          role="list"
          aria-label="What the slot links show"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          <Stat
            value={`${formatNumber(stats.linked)} of ${formatNumber(total)}`}
            label="categories fit at least one slot type"
            share={total > 0 ? stats.linked / total : 0}
          />
          <Stat
            value={formatNumber(total - stats.linked)}
            label="categories no slot type accepts"
            share={null}
          />
          <Stat
            value={`${formatNumber(stats.single)} of ${formatNumber(links.records.size)}`}
            label="slot types take a single category"
            share={links.records.size > 0 ? stats.single / links.records.size : 0}
          />
        </Box>

        {stats.top.length > 0 ? (
          <Box>
            <Typography variant="overline" component="h3" sx={{ m: 0, mb: 0.75 }}>
              Most widely accepted categories
            </Typography>
            <Box
              component="ol"
              role="list"
              sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}
            >
              {stats.top.map(({ category, count }) => {
                const name = categoryName(category);
                return (
                  <Box component="li" key={category.id} sx={{ minWidth: 0 }}>
                    <ButtonBase
                      onClick={() => onOpenCategory(category)}
                      aria-label={`${name} ${formatId(category.id)}: in ${pluralize(
                        count,
                        "slot type",
                        "slot types",
                      )}`}
                      sx={(theme) => ({
                        width: "100%",
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "minmax(0, 1fr) auto",
                          sm: "minmax(0, 14rem) minmax(0, 1fr) auto",
                        },
                        alignItems: "center",
                        columnGap: 1.5,
                        rowGap: 0.5,
                        px: 1,
                        py: 0.75,
                        textAlign: "left",
                        borderRadius: `${theme.wc.radius.sm}px`,
                        "@media (hover: hover)": {
                          "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                        },
                        "&.Mui-focusVisible": focusRing(theme),
                      })}
                    >
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{ ...mixins.truncate, minWidth: 0 }}
                      >
                        {name}
                      </Typography>
                      <Box
                        component="span"
                        sx={{
                          display: "block",
                          gridRow: { xs: 2, sm: 1 },
                          gridColumn: { xs: "1 / -1", sm: "auto" },
                          minWidth: 0,
                        }}
                      >
                        <CountBar
                          value={count}
                          max={stats.top[0].count}
                          color={(theme) => theme.palette.primary.main}
                          height={6}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        component="span"
                        color="text.secondary"
                        sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
                      >
                        {pluralize(count, "slot type", "slot types")}
                      </Typography>
                    </ButtonBase>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : null}
      </Stack>
    );
  };

  return (
    <SectionCard
      title="Slot links"
      icon={<HubRoundedIcon />}
      description={
        links.complete
          ? `Built from all ${pluralize(links.total, "slot type record", "slot type records")}.`
          : done
            ? `Built from ${formatNumber(links.records.size)} of ${pluralize(links.total, "slot type record", "slot type records")}, so it is incomplete.`
            : "Which slot types accept each category, the direction Blizzard does not list."
      }
    >
      <Stack spacing={2}>
        {links.failedCount > 0 && error ? (
          <ErrorState
            compact
            error={error}
            title={`${pluralize(links.failedCount, "slot type", "slot types")} could not be read`}
            context="these slot types"
            onRetry={links.retryFailed}
            retryLabel={links.retrying ? "Retrying…" : "Retry"}
          />
        ) : null}
        {renderBody()}
      </Stack>
    </SectionCard>
  );
};

export default SlotLinksPanel;
