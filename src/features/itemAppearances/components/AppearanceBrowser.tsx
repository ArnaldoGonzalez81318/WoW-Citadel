import CheckroomRoundedIcon from "@mui/icons-material/CheckroomRounded";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Pagination,
  Select,
  Stack,
} from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef } from "react";

import {
  ExplorerFilterBar,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import AppearanceCard from "@/features/itemAppearances/components/AppearanceCard";
import {
  parseId,
  scrollMarginSx,
} from "@/features/itemAppearances/components/appearanceLayout";
import AppearanceLookup from "@/features/itemAppearances/components/AppearanceLookup";
import CardList, { CardListSkeleton } from "@/features/itemAppearances/components/CardList";
import type {
  AppearanceParams,
  AppearanceParamsSetter,
} from "@/features/itemAppearances/components/urlState";
import {
  appearanceKeys,
  appearanceSearchQuery,
} from "@/features/itemAppearances/hooks/appearanceQueries";
import useRetainedFailure from "@/features/itemAppearances/hooks/useRetainedFailure";
import type { SlotNames } from "@/features/itemAppearances/hooks/useSlotNames";
import {
  APPEARANCE_PAGE_SIZE,
  pluralize,
} from "@/features/itemAppearances/services/appearanceService";
import {
  KNOWN_SLOT_TYPES,
  SLOT_GROUP_LABELS,
  SLOT_GROUP_ORDER,
  buildSlotOptions,
  isSlotType,
} from "@/features/itemAppearances/services/slots";
import type { AppearanceCriteria, AppearanceSort } from "@/features/itemAppearances/types";
import { formatNumber } from "@/lib/format";

/** The Select's value for "every slot" (the URL leaves `slot` out). */
const ALL_SLOTS = "all";

const SORT_OPTIONS: ReadonlyArray<SegmentedOption<AppearanceSort>> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

/** Blizzard's search counts this many matches at most. */
const SEARCH_CAP = 1000;

export type AppearanceBrowserProps = {
  params: Pick<AppearanceParams, "slot" | "sort" | "page">;
  setParams: AppearanceParamsSetter;
  slotIndexQuery: UseQueryResult<string[]>;
  slotNames: SlotNames;
  onOpenAppearance: (appearanceId: number) => void;
};

/**
 * The Appearances view: Blizzard's appearance search, one slot or all of
 * them, newest or oldest first by id, 24 to a page. Its index holds only an
 * appearance's id, slot and display id, so each card loads its record (the
 * items, armor or weapon type and the first item's icon) as it nears the
 * viewport, and armor or weapon type is shown rather than filtered on.
 */
const AppearanceBrowser = ({
  params,
  setParams,
  slotIndexQuery,
  slotNames,
  onOpenAppearance,
}: AppearanceBrowserProps): JSX.Element => {
  const slotLabelId = useId();
  const slotControlRef = useRef<HTMLDivElement>(null);

  /* ---------------- Slot, order and page (URL first; unknown values fall back) ---------------- */

  // The page's own slot list stands in until Blizzard's index lands (or if it fails).
  const slotTypes = slotIndexQuery.data ?? KNOWN_SLOT_TYPES;
  const slotOptions = useMemo(() => buildSlotOptions(slotTypes, slotNames), [slotTypes, slotNames]);
  const requestedSlot = params.slot;
  // A slot this page does not know waits for the index before it is trusted
  // (or dropped), so a mistyped link never sends a search that can only 404.
  const slotDecided =
    requestedSlot === "" ||
    !isSlotType(requestedSlot) ||
    slotIndexQuery.data !== undefined ||
    slotIndexQuery.isError ||
    KNOWN_SLOT_TYPES.includes(requestedSlot);
  const slot =
    requestedSlot !== "" && isSlotType(requestedSlot) && slotTypes.includes(requestedSlot)
      ? requestedSlot
      : null;
  const sort: AppearanceSort = params.sort === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, parseId(params.page) ?? 1);

  useEffect(() => {
    const patch: Partial<Record<"slot" | "sort" | "page", null>> = {};
    if (slotDecided && params.slot !== "" && slot === null) {
      patch.slot = null;
    }
    if (params.sort !== "" && params.sort !== "oldest") {
      patch.sort = null;
    }
    if (params.page !== "" && (parseId(params.page) === null || params.page === "1")) {
      patch.page = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [slotDecided, params.slot, slot, params.sort, params.page, setParams]);

  const criteria = useMemo<AppearanceCriteria>(() => ({ slot, sort }), [slot, sort]);

  /* ---------------- Search ---------------- */

  const searchQuery = useQuery({
    ...appearanceSearchQuery(criteria, page),
    enabled: slotDecided,
    // The last page stays up (dimmed) while the next one loads, instead of
    // the grid collapsing to skeletons on every page or slot change.
    placeholderData: keepPreviousData,
  });
  const placeholder = searchQuery.isPlaceholderData;
  // A Retry of a failed page puts the last page back up as a placeholder;
  // only this page's own data may clear its error banner.
  const failure = useRetainedFailure(appearanceKeys.search(criteria, page), {
    data: placeholder ? undefined : searchQuery.data,
    error: searchQuery.error,
    errorUpdateCount: searchQuery.errorUpdateCount,
    isFetching: searchQuery.isFetching,
    refetch: searchQuery.refetch,
  });
  const data = slotDecided ? searchQuery.data : undefined;
  const pageCount = data?.pageCount ?? 0;
  const hits = data?.hits ?? [];

  // A page past the end (a smaller slot, an old link) falls back to the last
  // one; Blizzard reports pageCount 0 for no matches, which is page 1.
  useEffect(() => {
    if (!data || placeholder || page <= 1) {
      return;
    }
    const last = Math.max(1, data.pageCount);
    if (page > last) {
      setParams({ page: last > 1 ? String(last) : null }, { replace: true });
    }
  }, [data, placeholder, page, setParams]);
  const steppingBack = data !== undefined && !placeholder && page > Math.max(1, pageCount);

  // A grid is read from the top: a new page starts at its first card.
  const listTopRef = useRef<HTMLDivElement>(null);
  const changePage = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Labels ---------------- */

  const slotLabel = slot ? slotOptions.find((option) => option.type === slot)?.label : undefined;
  const order = sort === "newest" ? "Newest" : "Oldest";
  const title = `${order} ${slotLabel ? `${slotLabel} ` : ""}appearances`;

  let summary: string | undefined;
  if (!data || placeholder || steppingBack) {
    summary = failure.failed ? "Couldn't load appearances" : "Loading appearances…";
  } else if (hits.length === 0) {
    summary = "No appearances listed";
  } else if (data.total !== undefined) {
    summary = pluralize(data.total, "appearance", "appearances");
  } else {
    const first = (data.page - 1) * APPEARANCE_PAGE_SIZE + 1;
    const range = `${formatNumber(first)}–${formatNumber(first + hits.length - 1)}`;
    summary = `Showing ${range} · page ${formatNumber(data.page)} of ${formatNumber(pageCount)}${
      data.capped ? ` (Blizzard's search stops at the ${sort} ${formatNumber(SEARCH_CAP)})` : ""
    }`;
  }

  /* ---------------- Render ---------------- */

  const renderBody = (): JSX.Element => {
    if (failure.failed && failure.error) {
      return (
        <ErrorState
          error={failure.error}
          context="appearances"
          onRetry={failure.retry}
          retryLabel={failure.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (!data || steppingBack || (hits.length === 0 && placeholder)) {
      return <CardListSkeleton count={APPEARANCE_PAGE_SIZE} label="Loading appearances" />;
    }
    if (hits.length === 0) {
      return (
        <EmptyState
          icon={<CheckroomRoundedIcon />}
          title={slotLabel ? `No ${slotLabel} appearances listed` : "No appearances listed"}
          description="Blizzard's appearance search and the slot's own list both came back empty for this region."
          action={
            slot ? (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setParams({ slot: null, page: null });
                  // The button leaves with the empty state; the slot menu takes focus.
                  slotControlRef.current?.querySelector<HTMLElement>('[role="combobox"]')?.focus();
                }}
              >
                Show every slot
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <Stack spacing={2.5} ref={listTopRef} sx={scrollMarginSx}>
        <Box
          aria-busy={placeholder || undefined}
          sx={(theme) => ({
            opacity: placeholder ? 0.6 : 1,
            transition: theme.transitions.create("opacity", { duration: theme.wc.motion.base }),
          })}
        >
          <CardList
            label={title}
            items={hits}
            getKey={(hit) => hit.id}
            renderItem={(hit) => (
              <AppearanceCard hit={hit} fallbackSlotName={slotLabel} onSelect={onOpenAppearance} />
            )}
          />
        </Box>
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={Math.min(page, pageCount)}
            onChange={(_event, next) => changePage(next)}
            siblingCount={1}
            aria-label="Appearance pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  return (
    <>
      <ExplorerFilterBar
        label="Browse appearances"
        summary={summary}
        progress={searchQuery.isFetching && (placeholder || !data)}
      >
        <FormControl
          ref={slotControlRef}
          size="small"
          sx={{ flex: "1 1 200px", minWidth: 0, maxWidth: { sm: 260 } }}
        >
          <InputLabel id={slotLabelId}>Slot</InputLabel>
          <Select
            labelId={slotLabelId}
            label="Slot"
            value={slot ?? ALL_SLOTS}
            onChange={(event) => {
              const next = String(event.target.value);
              setParams({ slot: next === ALL_SLOTS ? null : next, page: null });
            }}
            MenuProps={{ slotProps: { paper: { sx: { maxHeight: 420 } } } }}
          >
            <MenuItem value={ALL_SLOTS}>Every slot</MenuItem>
            {SLOT_GROUP_ORDER.flatMap((group) => {
              const options = slotOptions.filter((option) => option.group === group);
              return options.length === 0
                ? []
                : [
                    // Select gives every child role="option"; a heading that
                    // cannot be picked is hidden from screen readers (the
                    // options name themselves).
                    <ListSubheader key={`group-${group}`} aria-hidden>
                      {SLOT_GROUP_LABELS[group]}
                    </ListSubheader>,
                    ...options.map((option) => (
                      <MenuItem key={option.type} value={option.type}>
                        {option.label}
                      </MenuItem>
                    )),
                  ];
            })}
          </Select>
        </FormControl>
        <SegmentedControl
          size="small"
          label="Order appearances by id"
          options={SORT_OPTIONS}
          value={sort}
          onChange={(next) => setParams({ sort: next === "newest" ? null : next, page: null })}
          sx={{ minHeight: 40 }}
        />
        <AppearanceLookup
          onLookup={onOpenAppearance}
          sx={{ flex: "1 1 280px", maxWidth: { md: 360 } }}
        />
      </ExplorerFilterBar>

      <SectionCard
        title={title}
        description="By appearance id, which grows with every patch. Blizzard's search can't filter by armor or weapon type, so each card shows its type from its own record; open one for every item that shares the look."
      >
        {renderBody()}
      </SectionCard>
    </>
  );
};

export default AppearanceBrowser;
