import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Box, Chip, Divider, Stack, Typography, dialogClasses } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SegmentedControl } from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import QuestDialog from "@/features/quests/components/QuestDialog";
import QuestGroupPicker from "@/features/quests/components/QuestGroupPicker";
import QuestList from "@/features/quests/components/QuestList";
import QuestLookup from "@/features/quests/components/QuestLookup";
import {
  questGroupIndexQuery,
  questGroupQuery,
} from "@/features/quests/hooks/questQueries";
import {
  DEFAULT_GROUP_IDS,
  toPickerOptions,
} from "@/features/quests/services/questGroups";
import { isQuestSort, pluralize } from "@/features/quests/services/questService";
import type {
  QuestBrowseMode,
  QuestGroupSummary,
  QuestRef,
  QuestSort,
} from "@/features/quests/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = {
  by: "zone",
  group: "",
  quest: "",
  q: "",
  sort: "name",
  page: "",
};

const MODE_OPTIONS: ReadonlyArray<SegmentedOption<QuestBrowseMode>> = [
  { value: "zone", label: "Zone" },
  { value: "category", label: "Category" },
  { value: "type", label: "Type" },
];

/** What each mode lists, for copy ("zones", "categories", "quest types"). */
const MODE_PLURAL: Readonly<Record<QuestBrowseMode, string>> = {
  zone: "zones",
  category: "categories",
  type: "quest types",
};

const EMPTY_INDEX: QuestGroupSummary[] = [];

/** Grows beside the mode switch on md+; below md the row is a column, where a basis would be a height. */
const PICKER_SX = { flex: { md: "1 1 320px" }, minWidth: 0 } as const;

const isMode = (value: string): value is QuestBrowseMode =>
  value === "zone" || value === "category" || value === "type";

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Smooth unless the visitor asked for reduced motion. */
const scrollToTop = (node: Element | null): void => {
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia: the default (smooth) is fine.
  }
  node?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
};

/** The first entry in the picker's own order: where a mode opens without its default. */
const firstGroup = (mode: QuestBrowseMode, index: readonly QuestGroupSummary[]): number | null =>
  mode === "type" ? (index[0]?.id ?? null) : (toPickerOptions(mode, index)[0]?.id ?? null);

/**
 * Quests: Blizzard's quests filed three ways (440 zones, 184 categories, 9
 * types). Pick a list to page through its quests, each card showing its
 * level, faction and rewards with the reward's icon as it nears the viewport;
 * a quest opens with its text, requirements and every reward. There is no
 * quest search in Blizzard's API, so any other quest is opened by its id.
 * Mode, list, filter, sort, page and open quest all live in the URL.
 */
const QuestsPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();

  /* ---------------- Mode and its index ---------------- */

  const mode: QuestBrowseMode = isMode(params.by) ? params.by : "zone";
  const sort: QuestSort = isQuestSort(params.sort) ? params.sort : "name";

  // A mode or sort this page does not know (a typo, an old link) falls back
  // to the default, and so does the address.
  useEffect(() => {
    const fixes: { by?: null; sort?: null } = {};
    if (!isMode(params.by)) {
      fixes.by = null;
    }
    if (!isQuestSort(params.sort)) {
      fixes.sort = null;
    }
    if (Object.keys(fixes).length > 0) {
      setParams(fixes, { replace: true });
    }
  }, [params.by, params.sort, setParams]);

  // All three indexes are small static lists; loading them together makes a
  // mode switch instant and gives the header its counts.
  const zoneIndexQuery = useQuery(questGroupIndexQuery("zone"));
  const categoryIndexQuery = useQuery(questGroupIndexQuery("category"));
  const typeIndexQuery = useQuery(questGroupIndexQuery("type"));
  const indexQuery =
    mode === "zone"
      ? zoneIndexQuery
      : mode === "category"
        ? categoryIndexQuery
        : typeIndexQuery;
  const index = indexQuery.data ?? EMPTY_INDEX;

  /* ---------------- Group (URL first, then the mode's default) ---------------- */

  const requestedGroup = parseId(params.group);
  const defaultGroup = useMemo(
    () =>
      index.some((entry) => entry.id === DEFAULT_GROUP_IDS[mode])
        ? DEFAULT_GROUP_IDS[mode]
        : firstGroup(mode, index),
    [index, mode],
  );
  // Trust a linked group until the index says otherwise, so its quests load
  // alongside the index instead of after it.
  const groupId =
    requestedGroup !== null &&
    (!indexQuery.isSuccess || index.some((entry) => entry.id === requestedGroup))
      ? requestedGroup
      : indexQuery.isSuccess
        ? defaultGroup
        : null;

  // Write the resolved group into the URL once the index is known, so the
  // address always names the list on screen. A missing group is filled in
  // quietly; an unknown one also drops its filter and page.
  useEffect(() => {
    if (!indexQuery.isSuccess) {
      return;
    }
    const resolved = groupId === null ? "" : String(groupId);
    if (params.group === resolved) {
      return;
    }
    setParams(
      params.group === ""
        ? { group: resolved || null }
        : { group: resolved || null, q: null, page: null },
      { replace: true },
    );
  }, [indexQuery.isSuccess, groupId, params.group, setParams]);

  const groupQuery = useQuery({
    ...questGroupQuery(mode, groupId ?? 0),
    enabled: groupId !== null,
  });
  const indexName = index.find((entry) => entry.id === groupId)?.name;
  const groupName = (groupId !== null ? groupQuery.data?.name : undefined) ?? indexName;

  /* ---------------- Quest dialog ---------------- */

  const questId = parseId(params.quest);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownQuestId, setShownQuestId] = useState<number | null>(questId);
  if (questId !== null && questId !== shownQuestId) {
    setShownQuestId(questId);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (questId === null) {
      openedHereRef.current = false;
    }
    if (params.quest !== "" && questId === null) {
      setParams({ quest: null }, { replace: true });
    }
  }, [questId, params.quest, setParams]);

  const openQuest = useCallback(
    (id: number): void => {
      openedHereRef.current = true;
      setParams({ quest: String(id) });
    },
    [setParams],
  );
  const openListedQuest = useCallback(
    (quest: QuestRef): void => openQuest(quest.id),
    [openQuest],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the quest.
  const closeQuest = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ quest: null }, { replace: true });
  }, [navigate, setParams]);

  const fallbackQuestName = useMemo(
    () => groupQuery.data?.quests.find((quest) => quest.id === shownQuestId)?.name,
    [groupQuery.data, shownQuestId],
  );

  /* ---------------- Browsing ---------------- */

  const listRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  /** A list picked from a quest's facts, waiting to be scrolled to and focused. */
  const browseTargetRef = useRef<{ mode: QuestBrowseMode; groupId: number } | null>(null);

  const changeMode = useCallback(
    (next: QuestBrowseMode): void => {
      setParams({ by: next, group: null, q: null, page: null });
    },
    [setParams],
  );
  const selectGroup = useCallback(
    (next: number): void => {
      setParams({ group: String(next), q: null, page: null });
    },
    [setParams],
  );
  const browseTo = useCallback(
    (nextMode: QuestBrowseMode, nextGroup: number): void => {
      browseTargetRef.current = { mode: nextMode, groupId: nextGroup };
      openedHereRef.current = false;
      setParams({ by: nextMode, group: String(nextGroup), q: null, page: null, quest: null });
    },
    [setParams],
  );

  // After a zone, category or type link in the dialog, bring that list into
  // view and put focus on its filter (whose label names the list), so the
  // next Tab continues in it instead of from the top of the page. The card
  // that opened the dialog is usually gone by then, leaving the dialog's own
  // focus restore nowhere to go. Waits for the list when it is not cached.
  useEffect(() => {
    const target = browseTargetRef.current;
    if (!target || questId !== null) {
      return;
    }
    // The navigation that closed the dialog also set the list, so a
    // mismatch here means the link's group fell back to the default.
    if (target.mode !== mode || target.groupId !== groupId) {
      browseTargetRef.current = null;
      return;
    }
    if (groupQuery.isPending) {
      return;
    }
    browseTargetRef.current = null;
    scrollToTop(listRef.current);
    // Only when focus was lost with the card: never pull it away from
    // something the visitor moved to while the list loaded (or from the card
    // itself, when the link listed the group already on screen). Focus left
    // inside the dialog is lost too: the dialog stays mounted through its
    // exit transition, so when the opener is gone its restore finds no
    // target and focus stays on the link until the dialog drops it on <body>.
    const active = document.activeElement;
    if (
      active === null ||
      active === document.body ||
      active.closest(`.${dialogClasses.root}`) !== null
    ) {
      filterInputRef.current?.focus({ preventScroll: true });
    }
  }, [questId, mode, groupId, groupQuery.isPending]);

  /* ---------------- Render ---------------- */

  const plural = MODE_PLURAL[mode];
  // States where the list can never load: without these its disabled query
  // would leave the loading skeleton up forever.
  let blocked: JSX.Element | null = null;
  if (groupId === null && indexQuery.isError) {
    blocked = (
      <EmptyState
        compact
        icon={<AssignmentRoundedIcon />}
        title="No list selected"
        description={`The ${plural} could not be loaded (see above). Retry there to pick one, or open a quest by its id.`}
      />
    );
  } else if (groupId === null && indexQuery.isSuccess) {
    blocked = (
      <EmptyState
        compact
        icon={<AssignmentRoundedIcon />}
        title={`Blizzard lists no ${plural}`}
        description="Its quest index for this region is empty. Try another way to browse, or open a quest by its id."
      />
    );
  }

  const countChip = (count: number | undefined, one: string, many: string): JSX.Element | null =>
    count !== undefined && count > 0 ? (
      <Chip size="small" label={pluralize(count, one, many)} />
    ) : null;

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Quests"
        documentTitle={groupName ? `${groupName} · Quests` : "Quests"}
        icon={<AssignmentRoundedIcon />}
        description="Every quest in Blizzard's game data, filed by zone, category and type. Page through a list with each quest's level, faction and rewards, then open one for its text, requirements and every reward."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {countChip(zoneIndexQuery.data?.length, "zone", "zones")}
            {countChip(categoryIndexQuery.data?.length, "category", "categories")}
            {countChip(typeIndexQuery.data?.length, "quest type", "quest types")}
          </>
        }
      />

      <SectionCard
        title="Find quests"
        description="Blizzard files quests by zone, category and type. Most sit under a zone, and many also under a category (holidays, classes, professions…) or a type (dungeon, raid, PvP…); some class, campaign and dungeon quests appear only under a category or type."
      >
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            useFlexGap
            alignItems={{ xs: "stretch", md: "flex-start" }}
          >
            <SegmentedControl
              size="small"
              label="Browse quests by"
              options={MODE_OPTIONS}
              value={mode}
              onChange={changeMode}
              sx={{
                // Full width on phones, so three labels never crowd the edge.
                width: { xs: "100%", md: "auto" },
                minHeight: 40,
                "& .MuiToggleButton-root": { flex: { xs: 1, md: "0 0 auto" }, px: 2 },
              }}
            />
            {indexQuery.isError ? (
              <ErrorState
                compact
                error={indexQuery.error}
                context={plural}
                onRetry={() => void indexQuery.refetch()}
                sx={PICKER_SX}
              />
            ) : (
              <QuestGroupPicker
                mode={mode}
                options={index}
                value={groupId}
                onChange={selectGroup}
                loading={indexQuery.isPending}
                sx={PICKER_SX}
              />
            )}
          </Stack>

          <Divider />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1.5, sm: 2 }}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{ m: 0, flex: "1 1 auto", minWidth: 0, maxWidth: "60ch" }}
            >
              Know a quest&rsquo;s id? Blizzard&rsquo;s API has no quest search, but any
              quest opens by its id: the number in its Wowhead address.
            </Typography>
            <QuestLookup onLookup={openQuest} sx={{ flexShrink: 0 }} />
          </Stack>
        </Stack>
      </SectionCard>

      <Box
        ref={listRef}
        sx={(theme) => ({
          scrollMarginTop: {
            xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
            md: `${theme.wc.layout.headerHeight.md + 16}px`,
          },
        })}
      >
        <QuestList
          // A fresh list per group, so filter text still inside its debounce
          // never carries over: shown but unapplied after the next list's
          // skeleton, or applied to a list it was not typed for.
          key={`${mode}:${groupId ?? ""}`}
          mode={mode}
          groupId={groupId}
          fallbackName={indexName}
          query={groupQuery}
          blocked={blocked}
          search={params.q.trim()}
          sort={sort}
          page={Math.max(1, parseId(params.page) ?? 1)}
          setParams={setParams}
          onOpenQuest={openListedQuest}
          filterInputRef={filterInputRef}
        />
      </Box>

      <QuestDialog
        open={questId !== null}
        questId={shownQuestId}
        fallbackName={fallbackQuestName}
        onClose={closeQuest}
        onBrowse={browseTo}
      />
    </Stack>
  );
};

export default QuestsPage;
