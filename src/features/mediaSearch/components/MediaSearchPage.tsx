import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FirstPageRoundedIcon from "@mui/icons-material/FirstPageRounded";
import ImageSearchRoundedIcon from "@mui/icons-material/ImageSearchRounded";
import {
  Box,
  Button,
  Chip,
  Pagination,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ExplorerFilterBar,
  SearchField,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import MediaDetailDialog from "@/features/mediaSearch/components/MediaDetailDialog";
import MediaKindPicker, {
  formatTagCount,
} from "@/features/mediaSearch/components/MediaKindPicker";
import type { TagSummaryState } from "@/features/mediaSearch/components/MediaKindPicker";
import MediaRecordGrid, {
  MediaGridSkeleton,
} from "@/features/mediaSearch/components/MediaRecordGrid";
import {
  DEFAULT_SCOPE,
  MEDIA_TAG_IDS,
  isMediaScope,
  isMediaTag,
  tagConfig,
} from "@/features/mediaSearch/config/mediaKinds";
import {
  PAGE_KEY_SCOPE_INDEX,
  mediaLookupQuery,
  mediaPageQuery,
  mediaTagListQuery,
  mediaTagSummaryQuery,
} from "@/features/mediaSearch/hooks/mediaSearchQueries";
import {
  MEDIA_PAGE_SIZE,
  isMediaPath,
  nextWindowStart,
  pageOfList,
  recordsWithId,
} from "@/features/mediaSearch/services/mediaSearchService";
import type {
  MediaOrder,
  MediaPage,
  MediaRecord,
  MediaScope,
  MediaTagSummary,
} from "@/features/mediaSearch/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import type { SearchParamsPatch } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = {
  tag: "",
  order: "",
  from: "",
  page: "",
  lookup: "",
  media: "",
};

const MAX_ID = 2_147_483_647;

/** Media ids start at 0 (guild crest emblem 0); a leading "#" is forgiven. */
const parseId = (value: string): number | null => {
  const trimmed = value.trim().replace(/^#/, "");
  if (!/^\d{1,10}$/.test(trimmed)) {
    return null;
  }
  const id = Number(trimmed);
  return id <= MAX_ID ? id : null;
};

const parsePage = (value: string): number | null => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : null;
};

const ORDER_OPTIONS: ReadonlyArray<{ value: MediaOrder; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

type SummaryStates = {
  states: ReadonlyMap<MediaScope, TagSummaryState>;
  failed: UseQueryResult<MediaTagSummary>[];
};

const combineSummaries = (
  results: UseQueryResult<MediaTagSummary>[],
): SummaryStates => ({
  states: new Map<MediaScope, TagSummaryState>(
    MEDIA_TAG_IDS.map((id, index) => [
      id,
      { summary: results[index].data, pending: results[index].isPending },
    ]),
  ),
  failed: results.filter((result) => result.isError),
});

/**
 * Media Search: Blizzard's index of every media record, by kind. Pick a kind
 * (each tile counts it and shows a sample image), page through its images
 * newest or oldest first, look a record up by id, and open any one for every
 * size the render CDN serves, its file id and the record it belongs to.
 * Kind, order, start id, page, lookup and open record all live in the URL.
 *
 * Blizzard stops every search at 1,000 results, so a big kind (200,000-odd
 * item icons) is read as a chain of searches: when one runs out of pages,
 * the next starts at the last id seen.
 */
const MediaSearchPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);

  /* ---------------- Selection (URL first, then defaults) ---------------- */

  const scope: MediaScope = isMediaScope(params.tag) ? params.tag : DEFAULT_SCOPE;
  const tag = tagConfig(scope);
  const order: MediaOrder = params.order === "oldest" ? "oldest" : "newest";
  // Unsortable kinds are loaded whole; a start id means nothing there.
  const from = tag.sortable ? parseId(params.from) : null;
  const page = parsePage(params.page) ?? 1;
  const lookupId = parseId(params.lookup);
  const mediaPath = isMediaPath(params.media) ? params.media : null;

  // Name the kind on screen in the address bar, and drop values that cannot
  // be read (a mistyped kind falls back to items rather than an error).
  useEffect(() => {
    const patch: SearchParamsPatch<typeof URL_DEFAULTS> = {};
    if (params.tag !== scope) {
      patch.tag = scope;
    }
    if (params.order !== "" && params.order !== "oldest") {
      patch.order = null;
    }
    if (params.from !== "" && from === null) {
      patch.from = null;
    }
    if (params.page !== "" && page === 1) {
      patch.page = null;
    }
    if (params.lookup !== "" && lookupId === null) {
      patch.lookup = null;
    }
    if (params.media !== "" && mediaPath === null) {
      patch.media = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [params, scope, from, page, lookupId, mediaPath, setParams]);

  /* ---------------- Data ---------------- */

  const summaries = useQueries({
    queries: MEDIA_TAG_IDS.map((id) => mediaTagSummaryQuery(id)),
    combine: combineSummaries,
  });
  const scopeSummary = summaries.states.get(scope)?.summary;

  const pagedQuery = useQuery({
    ...mediaPageQuery({ scope, order, from, page }),
    enabled: tag.sortable,
    // Within one kind the last page stays up (dimmed) while the next loads;
    // another kind has another layout, so it gets its own skeleton.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[PAGE_KEY_SCOPE_INDEX] === scope ? previous : undefined,
  });
  const listTag = !tag.sortable && isMediaTag(scope) ? scope : null;
  const listQuery = useQuery({
    ...mediaTagListQuery(listTag ?? "journal-instance"),
    enabled: listTag !== null,
  });
  const listPage = useMemo(
    () => (listQuery.data ? pageOfList(listQuery.data, order, page) : undefined),
    [listQuery.data, order, page],
  );

  const activeQuery = tag.sortable ? pagedQuery : listQuery;
  const pageData: MediaPage | undefined = tag.sortable ? pagedQuery.data : listPage;
  const refreshing = tag.sortable && pagedQuery.isPlaceholderData;
  const records = pageData?.records ?? [];
  const pageCount = pageData?.pageCount ?? 0;

  // An unsortable kind is already loaded whole for the grid, so its lookup
  // filters that same query (no request of its own, and its index has no
  // usable ids to search by); the other kinds ask Blizzard's search.
  const selectLookup = useCallback(
    (list: MediaRecord[]): MediaRecord[] =>
      lookupId === null ? [] : recordsWithId(list, lookupId),
    [lookupId],
  );
  const listLookupQuery = useQuery({
    ...mediaTagListQuery(listTag ?? "journal-instance"),
    enabled: listTag !== null && lookupId !== null,
    select: selectLookup,
  });
  const searchLookupQuery = useQuery({
    ...mediaLookupQuery(scope, lookupId ?? 0),
    enabled: lookupId !== null && listTag === null,
  });
  const lookupQuery = listTag !== null ? listLookupQuery : searchLookupQuery;

  // A page past the end (a shorter search after switching) falls back to the last one.
  useEffect(() => {
    if (pageData && !refreshing && pageCount > 0 && page > pageCount) {
      setParams({ page: pageCount > 1 ? String(pageCount) : null }, { replace: true });
    }
  }, [pageData, refreshing, page, pageCount, setParams]);

  /* ---------------- Detail dialog ---------------- */

  // The path outlives the URL param so the dialog never blanks while closing.
  const [shownPath, setShownPath] = useState<string | null>(mediaPath);
  if (mediaPath !== null && mediaPath !== shownPath) {
    setShownPath(mediaPath);
  }
  const [pickedRecord, setPickedRecord] = useState<MediaRecord | undefined>();
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (mediaPath === null) {
      openedHereRef.current = false;
    }
  }, [mediaPath]);

  const openRecord = useCallback(
    (record: MediaRecord): void => {
      openedHereRef.current = true;
      setPickedRecord(record);
      setParams({ media: record.path });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the record.
  const closeRecord = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ media: null }, { replace: true });
  }, [navigate, setParams]);

  // The grid already holds what a click opens; only a shared link fetches it.
  const knownRecord =
    pickedRecord?.path === shownPath
      ? pickedRecord
      : (records.find((record) => record.path === shownPath) ??
        lookupQuery.data?.find((record) => record.path === shownPath));

  /* ---------------- Lookup field ---------------- */

  const [draft, setDraft] = useState(params.lookup);
  const [draftError, setDraftError] = useState<string | null>(null);
  // Adopt lookups that arrive from the URL (Back, a shared link, a cleared lookup).
  useEffect(() => {
    setDraft(params.lookup);
    setDraftError(null);
  }, [params.lookup]);

  const submitLookup = (value: string): void => {
    if (value.trim() === "") {
      setParams({ lookup: null });
      return;
    }
    const id = parseId(value);
    if (id === null) {
      setDraftError("Enter a whole-number id, such as 19019.");
      return;
    }
    setDraftError(null);
    setParams({ lookup: String(id) });
  };

  /* ---------------- Navigation ---------------- */

  // A new page, kind or window is read from the top.
  const gridTopRef = useRef<HTMLDivElement>(null);
  const scrollToGrid = (): void => {
    gridTopRef.current?.scrollIntoView({ block: "start" });
  };

  const handleScopeChange = useCallback(
    (next: MediaScope): void => setParams({ tag: next, page: null, from: null }),
    [setParams],
  );
  const handleOrderChange = (next: MediaOrder): void =>
    setParams({ order: next === "oldest" ? next : null, page: null, from: null });
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    scrollToGrid();
  };
  const startAt = (id: number | null): void => {
    setParams({ from: id === null ? null : String(id), page: null });
    scrollToGrid();
  };

  /* ---------------- Labels ---------------- */

  const kindNoun = tag.noun;
  const firstId = records[0]?.id;
  const lastRecord = records[records.length - 1];
  const shownPage = pageData ? Math.min(pageData.page, pageCount) : page;
  // Not while the previous page stands in: its last id is not this page's.
  const onLastPage =
    pageData !== undefined && !refreshing && pageCount > 0 && page >= pageCount;
  const nextStart =
    pageData?.capped && onLastPage ? nextWindowStart(scope, order, lastRecord) : null;
  const towardsLabel = order === "newest" ? "older" : "newer";
  const startLabel = order === "newest" ? "Back to the newest" : "Back to the oldest";

  const summaryText = ((): string => {
    if (!pageData) {
      return activeQuery.isError ? `Could not load ${kindNoun}` : `Loading ${kindNoun}…`;
    }
    if (records.length === 0) {
      return `No ${kindNoun} found`;
    }
    return [
      `Page ${shownPage} of ${pageCount}`,
      firstId !== undefined && lastRecord ? `#${firstId} – #${lastRecord.id}` : undefined,
      from !== null
        ? `from #${from} ${order === "newest" ? "down" : "up"}`
        : scope !== "all" && scopeSummary
          ? `${formatTagCount(scopeSummary)} ${kindNoun}`
          : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
  })();

  /* ---------------- Render ---------------- */

  const renderGrid = (): JSX.Element => {
    if (!pageData && activeQuery.isError) {
      return (
        <ErrorState
          error={activeQuery.error}
          context={kindNoun}
          onRetry={() => void activeQuery.refetch()}
        />
      );
    }
    // A page past the end is about to fall back to the last one (see the
    // effect above): wait for it rather than flash "nothing found".
    if (!pageData || (pageCount > 0 && page > pageCount)) {
      return (
        <MediaGridSkeleton
          layout={tag.layout}
          count={tag.layout === "icon" ? 24 : 12}
          label={`Loading ${kindNoun}`}
        />
      );
    }
    if (records.length === 0) {
      return (
        <EmptyState
          icon={<ImageSearchRoundedIcon />}
          title={
            from !== null
              ? `No ${kindNoun} from #${from} ${order === "newest" ? "down" : "up"}`
              : `No ${kindNoun} in Blizzard's index`
          }
          description={
            from !== null
              ? `Blizzard's media search has nothing ${order === "newest" ? "at or below" : "at or above"} this id for this kind.`
              : "Blizzard's media search returned no records for this kind."
          }
          action={
            from !== null ? (
              <Button variant="outlined" onClick={() => startAt(null)}>
                {startLabel}
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <Stack spacing={2.5}>
        {activeQuery.isError ? (
          <ErrorState
            compact
            error={activeQuery.error}
            context="the next page"
            onRetry={() => void activeQuery.refetch()}
          />
        ) : null}
        <MediaRecordGrid
          label={`${tag.label}, page ${shownPage}`}
          records={records}
          layout={tag.layout}
          showKind={scope === "all"}
          busy={refreshing}
          onSelect={openRecord}
        />
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={Math.min(page, pageCount)}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={isPhone ? 0 : 1}
            size={isPhone ? "small" : "medium"}
            aria-label={`${tag.label} pages`}
            sx={{ alignSelf: "center" }}
          />
        ) : null}
        {nextStart !== null && lastRecord ? (
          <Stack spacing={1} alignItems="center" sx={{ textAlign: "center" }}>
            {/* Everything starts again at the last indexed id itself (see nextWindowStart). */}
            <Typography variant="body2" color="text.secondary" component="p" sx={{ margin: 0, maxWidth: "60ch" }}>
              {scope === "all"
                ? `Blizzard ends every search at 1,000 results. A new search starts again at #${nextStart} (kinds share ids, so a record or two may repeat), with the ${towardsLabel} ids.`
                : `Blizzard ends every search at 1,000 results. A new search picks up after #${lastRecord.id}, with the ${towardsLabel} ids.`}
            </Typography>
            <Button
              variant="outlined"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => startAt(nextStart)}
            >
              {scope === "all" ? `Continue from #${nextStart}` : `Continue past #${lastRecord.id}`}
            </Button>
          </Stack>
        ) : null}
      </Stack>
    );
  };

  const renderLookup = (id: number): JSX.Element => {
    if (lookupQuery.isPending) {
      return <MediaGridSkeleton layout={tag.layout} count={1} label={`Looking up id ${id}`} />;
    }
    if (lookupQuery.isError) {
      return (
        <ErrorState
          compact
          error={lookupQuery.error}
          context={`media with id ${id}`}
          onRetry={() => void lookupQuery.refetch()}
        />
      );
    }
    // Unsortable kinds have no id order to browse from.
    const browse = tag.sortable ? (
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          setParams({ from: String(id), page: null, lookup: null });
          scrollToGrid();
        }}
      >
        {`Browse ${kindNoun} from #${id}`}
      </Button>
    ) : undefined;
    if (lookupQuery.data.length === 0) {
      return (
        <EmptyState
          compact
          title={scope === "all" ? `No media with id ${id}` : `No ${kindNoun} with id ${id}`}
          description={
            scope === "all"
              ? "No kind in Blizzard's media index has a record with this id."
              : "Blizzard's media index has no record of this kind with this id. Try Everything to search every kind."
          }
          action={browse}
        />
      );
    }
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Box sx={{ width: "100%" }}>
          <MediaRecordGrid
            label={`Media with id ${id}`}
            records={lookupQuery.data}
            layout={tag.layout}
            showKind={scope === "all"}
            onSelect={openRecord}
          />
        </Box>
        {browse}
      </Stack>
    );
  };

  return (
    <Stack
      sx={{
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      }}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Media Search"
        documentTitle="Media Search"
        icon={<ImageSearchRoundedIcon />}
        description="Every image in Blizzard's media index: item, spell and achievement icons, creature renders, dungeon and raid tiles, guild crest pieces and more. Open one for each size the render CDN serves, its file id and the record it belongs to."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            <Chip size="small" label={`${MEDIA_TAG_IDS.length} media kinds`} />
          </>
        }
      />

      <SectionCard
        title="Media kinds"
        description="Each tile shows a sample image (the newest, where Blizzard can sort the kind) and how many records Blizzard's search finds (it stops counting at 1,000)."
      >
        <Stack spacing={1.5}>
          <MediaKindPicker
            value={scope}
            onChange={handleScopeChange}
            summaries={summaries.states}
          />
          {summaries.failed.length > 0 ? (
            <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={1}>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ margin: 0 }}>
                {`Counts for ${summaries.failed.length} ${summaries.failed.length === 1 ? "kind" : "kinds"} did not load; every kind still opens.`}
              </Typography>
              <Button
                size="small"
                // A count already being fetched again is left alone: refetch()
                // would cancel that attempt and start it over.
                onClick={() =>
                  summaries.failed
                    .filter((result) => result.fetchStatus === "idle")
                    .forEach((result) => void result.refetch())
                }
              >
                Retry counts
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </SectionCard>

      <ExplorerFilterBar
        label="Browse options"
        summary={summaryText}
        progress={refreshing || (activeQuery.isFetching && !activeQuery.isPending)}
      >
        <SearchField
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setDraftError(null);
          }}
          onSubmit={submitLookup}
          onClear={() => setParams({ lookup: null })}
          label={`Find ${kindNoun} by id`}
          placeholder={`Find ${kindNoun} by id`}
          size="small"
          loading={lookupId !== null && lookupQuery.isFetching}
          sx={{ flex: "1 1 240px", maxWidth: { md: 360 } }}
        />
        <Button variant="outlined" onClick={() => submitLookup(draft)}>
          Find
        </Button>
        <SegmentedControl
          label="Order"
          options={ORDER_OPTIONS}
          value={order}
          onChange={handleOrderChange}
          size="small"
        />
        {from !== null ? (
          <Button
            size="small"
            startIcon={<FirstPageRoundedIcon />}
            onClick={() => startAt(null)}
          >
            {startLabel}
          </Button>
        ) : null}
        {draftError ? (
          <Typography
            role="alert"
            variant="caption"
            color="warning.main"
            component="p"
            sx={{ margin: 0, flexBasis: "100%" }}
          >
            {draftError}
          </Typography>
        ) : null}
      </ExplorerFilterBar>

      {lookupId !== null ? (
        <SectionCard
          title={`Id ${lookupId}`}
          description={scope === "all" ? "Every kind with a record at this id" : `${tag.label} with this id`}
          actions={
            <Button size="small" onClick={() => setParams({ lookup: null })}>
              Clear lookup
            </Button>
          }
        >
          {renderLookup(lookupId)}
        </SectionCard>
      ) : null}

      <Box
        ref={gridTopRef}
        sx={{
          scrollMarginTop: {
            xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
            md: `${theme.wc.layout.headerHeight.md + 16}px`,
          },
        }}
      >
        <SectionCard
          title={tag.label}
          description={`${tag.about} ${MEDIA_PAGE_SIZE} per page, ${order === "newest" ? "newest" : "oldest"} ids first.`}
        >
          {renderGrid()}
        </SectionCard>
      </Box>

      <MediaDetailDialog
        open={mediaPath !== null}
        path={shownPath}
        knownRecord={knownRecord}
        onClose={closeRecord}
      />
    </Stack>
  );
};

export default MediaSearchPage;
