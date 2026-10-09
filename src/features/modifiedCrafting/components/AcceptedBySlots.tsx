import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import LinkRow from "@/features/modifiedCrafting/components/LinkRow";
import ThemeGlyph from "@/features/modifiedCrafting/components/ThemeGlyph";
import type { RetainedError } from "@/features/modifiedCrafting/hooks/useRetainedError";
import type { SlotLinks } from "@/features/modifiedCrafting/hooks/useSlotLinks";
import {
  formatId,
  pluralize,
  slotTypeName,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import { SLOT_THEMES } from "@/features/modifiedCrafting/services/slotThemes";
import type { SlotThemeId } from "@/features/modifiedCrafting/services/slotThemes";
import type { SlotTypeRef } from "@/features/modifiedCrafting/types";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";

export type AcceptedBySlotsProps = {
  /** The category ids to look up (one, or every id sharing a name). */
  categoryIds: readonly number[];
  links: SlotLinks;
  /**
   * Starts the map when this section nears the viewport and it is not
   * running; undefined while the dialog closes, so nothing starts then.
   */
  onNeeded?: () => void;
  /** The slot type list's own failure: without it there is nothing to read. */
  listError: RetainedError;
  slotById: ReadonlyMap<number, SlotTypeRef>;
  themeOf: ReadonlyMap<number, SlotThemeId>;
  onOpenSlot: (slot: SlotTypeRef) => void;
};

/**
 * The slot types that accept a category, grouped by theme, from the
 * slot-link map: a progress bar while the 389 records are read, the list
 * once they are (marked incomplete if some failed, with a Retry).
 */
const AcceptedByContent = ({
  categoryIds,
  links,
  listError,
  slotById,
  themeOf,
  onOpenSlot,
}: AcceptedBySlotsProps): JSX.Element => {
  const [lastError, setLastError] = useState<Error | null>(null);
  if (links.error !== null && links.error !== lastError) {
    setLastError(links.error);
  }
  const error = links.error ?? lastError;

  if (!links.listed && listError.error !== undefined) {
    return (
      <ErrorState
        compact
        error={listError.error}
        context="the slot type list this is read from"
        onRetry={listError.retry}
        retryLabel={listError.retrying ? "Retrying…" : "Retry"}
      />
    );
  }
  if (!links.settled) {
    const value = links.total > 0 ? Math.round((links.loadedCount / links.total) * 100) : 0;
    return (
      <Stack spacing={1}>
        <Typography
          variant="body2"
          color="text.secondary"
          component="p"
          sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}
        >
          {links.total > 0
            ? `Blizzard lists this direction nowhere, so every slot type is read once: ${formatNumber(links.loadedCount)} of ${formatNumber(links.total)}.`
            : links.listed && !links.enabled
              ? "Blizzard lists this direction nowhere, so every slot type is read once, starting as this section comes into view."
              : "Waiting for the slot type list…"}
        </Typography>
        <LinearProgress
          variant={links.total > 0 ? "determinate" : "indeterminate"}
          value={value}
          aria-label="Slot type records read"
          aria-valuetext={
            links.total > 0
              ? `${formatNumber(links.loadedCount)} of ${formatNumber(links.total)}`
              : undefined
          }
          sx={(theme) => ({ height: 6, borderRadius: `${theme.wc.radius.pill}px` })}
        />
      </Stack>
    );
  }

  const slotIds = new Set<number>();
  categoryIds.forEach((id) => links.acceptedBy.get(id)?.forEach((slotId) => slotIds.add(slotId)));
  const byTheme = SLOT_THEMES.map((theme) => ({
    theme,
    slots: Array.from(slotIds)
      .filter((id) => (themeOf.get(id) ?? "reagents") === theme.id)
      .sort((left, right) => right - left)
      .map((id) => slotById.get(id) ?? { id, name: links.records.get(id)?.name ?? null }),
  })).filter((entry) => entry.slots.length > 0);

  return (
    <Stack spacing={2}>
      {links.failedCount > 0 && error ? (
        <ErrorState
          compact
          error={error}
          title={`${pluralize(links.failedCount, "slot type", "slot types")} could not be read, so this list may be incomplete`}
          context="these slot types"
          onRetry={links.retryFailed}
          retryLabel={links.retrying ? "Retrying…" : "Retry"}
        />
      ) : null}
      {byTheme.length === 0 ? (
        <EmptyState
          compact
          title="No slot type accepts it"
          description={
            links.complete
              ? `None of the ${pluralize(links.total, "slot type", "slot types")} lists this category.`
              : "None of the slot types read so far lists this category."
          }
        />
      ) : (
        byTheme.map(({ theme, slots }) => (
          <Box key={theme.id}>
            <Typography
              variant="caption"
              color="text.secondary"
              component="h4"
              sx={{ m: 0, mb: 0.75, fontWeight: 600 }}
            >
              {`${theme.label} · ${formatNumber(slots.length)}`}
            </Typography>
            <Box
              component="ul"
              role="list"
              aria-label={`${theme.label} slot types`}
              sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}
            >
              {slots.map((slot) => (
                <li key={slot.id} style={{ minWidth: 0 }}>
                  <LinkRow
                    icon={<ThemeGlyph theme={theme.id} size={40} />}
                    primary={slotTypeName(slot)}
                    secondary={`Slot type ${formatId(slot.id)}`}
                    onClick={() => onOpenSlot(slot)}
                  />
                </li>
              ))}
            </Box>
          </Box>
        ))
      )}
    </Stack>
  );
};

/**
 * Outside the categories view the map starts only once this section comes
 * near the viewport: it sits below the reagent list, and a shared link to a
 * category should not cost 389 requests the visitor may never scroll to.
 */
const AcceptedBySlots = (props: AcceptedBySlotsProps): JSX.Element => {
  const { links, onNeeded } = props;
  const [nearRef, near] = useNearViewport<HTMLDivElement>("200px 0px");
  useEffect(() => {
    if (near && !links.enabled && onNeeded) {
      onNeeded();
    }
  }, [near, links.enabled, onNeeded]);
  return (
    <Box ref={nearRef}>
      <AcceptedByContent {...props} />
    </Box>
  );
};

export default AcceptedBySlots;
