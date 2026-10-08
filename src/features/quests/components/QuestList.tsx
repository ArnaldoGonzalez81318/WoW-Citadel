import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Box, Button, Pagination, Skeleton, Stack } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";

import {
  SearchField,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import QuestCard, { QUEST_CARD_HEIGHT } from "@/features/quests/components/QuestCard";
import { pluralize } from "@/features/quests/services/questService";
import type {
  QuestBrowseMode,
  QuestGroup,
  QuestRef,
  QuestSort,
} from "@/features/quests/types";
import type { SearchParamsRecordSetter } from "@/hooks/useSearchParamState";
import { formatNumber } from "@/lib/format";

export const QUEST_PAGE_SIZE = 25;
export const QUEST_COLS: GridColumns = { xs: 1, md: 2 };
export const QUEST_GAP_PX = 12;

const SORT_OPTIONS: ReadonlyArray<SegmentedOption<QuestSort>> = [
  { value: "name", label: "Name" },
  { value: "newest", label: "Newest" },
];

export type QuestListParams = {
  q: string;
  sort: string;
  page: string;
};

const MODE_NOUN: Readonly<Record<QuestBrowseMode, string>> = {
  zone: "Zone",
  category: "Category",
  type: "Quest type",
};

export type QuestListProps = {
  mode: QuestBrowseMode;
  /** The group on screen, or null while its index is still resolving one. */
  groupId: number | null;
  /** Its name from the index, shown until the group itself loads. */
  fallbackName?: string;
  query: UseQueryResult<QuestGroup | null>;
  /** The group can never load: its index failed or is empty (see the page). */
  blocked?: JSX.Element | null;
  /** From the URL, trimmed. */
  search: string;
  sort: QuestSort;
  /** From the URL, 1-based (may be past the end until the effect below fixes it). */
  page: number;
  setParams: SearchParamsRecordSetter<QuestListParams>;
  onOpenQuest: (quest: QuestRef) => void;
  /** The name filter, for the page to focus after browsing here from a quest. */
  filterInputRef?: Ref<HTMLInputElement>;
};

const EMPTY_QUESTS: QuestRef[] = [];

const titleWords = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

/*
 * Every typed word starts a word of the title ("rive gno" finds "Riverpaw
 * Gnoll Bounty"). Only that way round: matchesTypedName also lets a longer
 * typed word match a shorter title word, an allowance for Blizzard's stemmed
 * search hits that here lists every "The …" quest for "Theramore".
 */
const matchesFilter = (name: string, query: string): boolean => {
  const words = titleWords(name);
  return titleWords(query).every((typed) => words.some((word) => word.startsWith(typed)));
};

const compareNames = (left: QuestRef, right: QuestRef): number =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
  left.id - right.id;

/** Skeleton for the filter row and the first page, in the loaded layout. */
const ListSkeleton = ({ label }: { label: string }): JSX.Element => (
  <Stack spacing={2.5}>
    <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="center">
      <Skeleton variant="rounded" height={40} sx={{ flex: "1 1 240px" }} />
      <Skeleton variant="rounded" height={40} width={150} />
    </Stack>
    <LoadingSkeleton
      variant="grid"
      columns={QUEST_COLS}
      itemHeight={QUEST_CARD_HEIGHT}
      count={10}
      gap={QUEST_GAP_PX}
      label={label}
    />
  </Stack>
);

/**
 * One zone's, category's or type's quests: a name filter and a sort over
 * every quest it lists, 25 to a page. A type runs to ~800 quests (Dungeon);
 * each card loads its own record as it nears the viewport.
 */
const QuestList = ({
  mode,
  groupId,
  fallbackName,
  query,
  blocked = null,
  search,
  sort,
  page,
  setParams,
  onOpenQuest,
  filterInputRef,
}: QuestListProps): JSX.Element => {
  const group = groupId !== null ? (query.data ?? undefined) : undefined;
  const name = group?.name ?? fallbackName;

  /* ---------------- Search draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(search);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, another group): adopt it.
    if (search !== emittedRef.current) {
      emittedRef.current = search;
      setDraft(search);
    }
  }, [search]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ q: next || null, page: null }, { replace: true });
    },
    [setParams],
  );

  /* ---------------- Filtering, sorting and paging ---------------- */

  const quests = group?.quests ?? EMPTY_QUESTS;
  // Blizzard reuses titles (two "The Platinum Discs" in Dungeon): those show their id.
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    quests.forEach((quest) => {
      if (seen.has(quest.name)) {
        duplicates.add(quest.name);
      }
      seen.add(quest.name);
    });
    return duplicates;
  }, [quests]);

  const filtered = useMemo(() => {
    // A typed number also finds the quest with that id.
    const matching =
      search === ""
        ? quests
        : quests.filter(
            (quest) => matchesFilter(quest.name, search) || String(quest.id) === search,
          );
    // Quest ids grow with every patch, so the highest are the newest quests.
    return [...matching].sort(
      sort === "newest" ? (left, right) => right.id - left.id : compareNames,
    );
  }, [quests, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / QUEST_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * QUEST_PAGE_SIZE;
  const pageQuests = useMemo(
    () => filtered.slice(start, start + QUEST_PAGE_SIZE),
    [filtered, start],
  );

  // A page past the end (a narrower filter, a smaller group) falls back to the last one.
  useEffect(() => {
    if (group && page > pageCount) {
      setParams({ page: pageCount > 1 ? String(pageCount) : null }, { replace: true });
    }
  }, [group, page, pageCount, setParams]);

  // A list is read from the top: a new page starts at its first quest.
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  const clearFilter = (): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
  };

  /* ---------------- Labels ---------------- */

  const noun = MODE_NOUN[mode];
  const description = group
    ? [
        noun,
        pluralize(quests.length, "quest", "quests"),
        sort === "newest" ? "newest first, by quest id" : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : noun;

  const end = Math.min(start + QUEST_PAGE_SIZE, filtered.length);
  const range = `${formatNumber(start + 1)}–${formatNumber(end)}`;
  let summary: string;
  if (filtered.length === 0) {
    summary = "No matching quests";
  } else if (filtered.length < quests.length) {
    summary = `${formatNumber(filtered.length)} of ${pluralize(quests.length, "quest", "quests")} match${pageCount > 1 ? ` · showing ${range}` : ""}`;
  } else {
    summary =
      pageCount > 1
        ? `Showing ${range} of ${pluralize(quests.length, "quest", "quests")}`
        : pluralize(quests.length, "quest", "quests");
  }

  /* ---------------- Render ---------------- */

  const renderBody = (): JSX.Element => {
    if (blocked) {
      return blocked;
    }
    if (groupId === null || query.isPending) {
      return <ListSkeleton label={name ? `Loading ${name} quests` : "Loading quests"} />;
    }
    if (query.isError && !group) {
      return (
        <ErrorState
          compact
          error={query.error}
          context={name ? `${name} quests` : "these quests"}
          onRetry={() => void query.refetch()}
        />
      );
    }
    if (!group) {
      return (
        <EmptyState
          compact
          icon={<AssignmentRoundedIcon />}
          title={`${noun} not found`}
          description={`Blizzard has no ${noun.toLowerCase()} #${groupId} in its game data. Pick another one above.`}
        />
      );
    }
    if (quests.length === 0) {
      return (
        <EmptyState
          compact
          icon={<AssignmentRoundedIcon />}
          title={`No quests in ${group.name}`}
          description={`Blizzard lists no quests under this ${noun.toLowerCase()}. Pick another one above.`}
        />
      );
    }

    return (
      <Stack spacing={2.5}>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="center">
          <SearchField
            size="small"
            label={`Filter ${group.name} quests by name or id`}
            placeholder="Filter quests"
            value={draft}
            onChange={setDraft}
            onDebouncedChange={handleSearch}
            inputRef={filterInputRef}
            sx={{ minWidth: { xs: 0, sm: 240 } }}
          />
          <SegmentedControl
            size="small"
            label="Sort quests"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(next) =>
              setParams({ sort: next === "name" ? null : next, page: null }, { replace: true })
            }
          />
          <LiveStatus
            sx={{
              flex: { xs: "1 1 100%", md: "0 1 auto" },
              minWidth: 0,
              marginLeft: { md: "auto" },
              overflowWrap: "anywhere",
            }}
          >
            {summary}
          </LiveStatus>
        </Stack>

        {filtered.length === 0 ? (
          <EmptyState
            compact
            // Only the name filter can empty a group that has quests.
            title={`No quests match “${search}”`}
            description={`Nothing in ${group.name} matches. The filter reads quest titles and ids; try a shorter word, or look a quest up by its id above.`}
            action={
              <Button variant="outlined" size="small" onClick={clearFilter}>
                Clear filter
              </Button>
            }
          />
        ) : (
          <Stack
            spacing={2.5}
            ref={listTopRef}
            sx={(theme) => ({
              scrollMarginTop: {
                xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
                md: `${theme.wc.layout.headerHeight.md + 16}px`,
              },
            })}
          >
            <Box
              component="ul"
              // Safari drops the list role from a list-style:none list without it.
              role="list"
              aria-label={`${group.name} quests`}
              sx={{
                display: "grid",
                gap: `${QUEST_GAP_PX}px`,
                listStyle: "none",
                m: 0,
                p: 0,
                ...gridTemplateColumnsSx(QUEST_COLS),
              }}
            >
              {pageQuests.map((quest) => (
                <Box component="li" key={quest.id} sx={{ minWidth: 0 }}>
                  <QuestCard
                    quest={quest}
                    showId={duplicateNames.has(quest.name)}
                    onOpen={onOpenQuest}
                  />
                </Box>
              ))}
            </Box>
            {pageCount > 1 ? (
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={(_event, next) => handlePageChange(next)}
                siblingCount={1}
                aria-label="Quest pages"
                sx={{ alignSelf: "center" }}
              />
            ) : null}
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <SectionCard title={name ?? "Quests"} description={description}>
      {renderBody()}
    </SectionCard>
  );
};

export default QuestList;
