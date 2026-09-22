import { Alert, Box, Button, Chip, Stack } from "@mui/material";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent } from "react";

import PageHeader from "@/components/common/PageHeader";
import type { PageHeaderBreadcrumb } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import {
  ExplorerFilterBar,
  SearchField,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import {
  getApiFamilyConfigBySlug,
  getApiFamilyTone,
} from "@/features/apiExplorer/config/apiCatalog";
import GallerySection, {
  GallerySectionError,
} from "@/features/apiExplorer/gallery/GallerySection";
import GalleryRecordDialog from "@/features/apiExplorer/gallery/GalleryRecordDialog";
import { DATASET_PROFILES } from "@/features/apiExplorer/gallery/mediaStrategies";
import {
  buildMediaQueryToken,
  gallerySectionDomId,
} from "@/features/apiExplorer/gallery/normalizeRecords";
import type { GalleryCard } from "@/features/apiExplorer/gallery/normalizeRecords";
import { useGallerySections } from "@/features/apiExplorer/gallery/useGallerySections";
import type { GallerySort } from "@/features/apiExplorer/gallery/useGallerySections";
import type { ApiFamilyConfig } from "@/features/apiExplorer/types";
import { useSearchParamState } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";

export type ApiDatasetGalleryPageProps = {
  slug: string;
  /** Nav section label, forwarded to PageHeader as the gold eyebrow. */
  eyebrow?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  /** Overrides the family label (minus its "API" suffix). */
  title?: string;
  description?: string;
};

const SORT_OPTIONS: ReadonlyArray<SegmentedOption<GallerySort>> = [
  { value: "api", label: "API order" },
  { value: "name", label: "A–Z" },
  { value: "id", label: "ID" },
];

const DEFAULT_SORT: GallerySort = "api";
const MIN_FILTER_LENGTH = 2;

const isGallerySort = (value: string): value is GallerySort =>
  SORT_OPTIONS.some((option) => option.value === value);

/**
 * Browsable gallery for a `presentation: "dataset"` API family. Guards the
 * slug, then hands a resolved family to the gallery body.
 */
const ApiDatasetGalleryPage = ({
  slug,
  eyebrow,
  breadcrumbs,
  title,
  description,
}: ApiDatasetGalleryPageProps): JSX.Element => {
  const family = getApiFamilyConfigBySlug(slug);

  if (!family || family.presentation !== "dataset") {
    return <EmptyState title="No dataset for this category" />;
  }

  return (
    <DatasetGallery
      family={family}
      eyebrow={eyebrow}
      breadcrumbs={breadcrumbs}
      title={title ?? family.label.replace(/\s+API$/u, "")}
      description={description ?? family.description}
    />
  );
};

type DatasetGalleryProps = {
  family: ApiFamilyConfig;
  eyebrow?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  title: string;
  description: string;
};

/**
 * Measured height of the sticky filter bar. It is two rows whenever jump
 * chips render, and any future change to its contents changes it again, so
 * the jump allowance is read from the DOM instead of guessed.
 */
const useMeasuredHeight = (ref: { current: HTMLElement | null }): number => {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    // The wrapper is `display: contents`; the bar is its first (only) child.
    const element = ref.current?.firstElementChild;
    if (!(element instanceof HTMLElement)) {
      return undefined;
    }

    const measure = (): void => {
      setHeight(Math.round(element.getBoundingClientRect().height));
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
};

/**
 * One h2 section per source endpoint, each a virtualised ResultCard grid
 * enriched with media/detail hops as cards scroll into view. `q` and `sort`
 * live in the URL; the dialog reads the live card so enrichment that lands
 * after opening is shown in place. CategoryPage remounts this per slug.
 */
const DatasetGallery = ({
  family,
  eyebrow,
  breadcrumbs,
  title,
  description,
}: DatasetGalleryProps): JSX.Element => {
  const { slug } = family;

  const [q, setQ] = useSearchParamState("q");
  const [sortParam, setSortParam] = useSearchParamState("sort", DEFAULT_SORT);
  const sort: GallerySort = isGallerySort(sortParam) ? sortParam : DEFAULT_SORT;

  const [draft, setDraft] = useState(q);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dismissedMediaErrors, setDismissedMediaErrors] = useState(0);

  const filterBarWrapperRef = useRef<HTMLDivElement | null>(null);
  const filterBarHeight = useMeasuredHeight(filterBarWrapperRef);

  // The last `q` this page wrote. Only a `q` that arrived from elsewhere
  // (back/forward) is adopted into the draft, so clearing a sub-minimum
  // filter below never wipes what the user is still typing.
  const committedRef = useRef(q);

  const commitQ = useCallback(
    (next: string | null): void => {
      committedRef.current = next ?? "";
      setQ(next, { replace: true });
    },
    [setQ],
  );

  useEffect(() => {
    if (q !== committedRef.current) {
      committedRef.current = q;
      setDraft(q);
    }
  }, [q]);

  const handleDraftChange = useCallback(
    (value: string): void => {
      setDraft(value);
      // SearchField never emits sub-minimum values, so backspacing "ab" to
      // "a" would otherwise leave q=ab applied to a field that shows "a".
      const length = value.trim().length;
      if (committedRef.current && length > 0 && length < MIN_FILTER_LENGTH) {
        commitQ(null);
      }
    },
    [commitQ],
  );

  const commitFilter = useCallback(
    (value: string): void => {
      const trimmed = value.trim();
      commitQ(trimmed.length >= MIN_FILTER_LENGTH ? trimmed : null);
    },
    [commitQ],
  );

  const clearFilter = useCallback((): void => {
    setDraft("");
    commitQ(null);
  }, [commitQ]);

  const handleSortChange = useCallback(
    (value: GallerySort): void => {
      setSortParam(value === DEFAULT_SORT ? null : value, { replace: true });
    },
    [setSortParam],
  );

  const handleSelect = useCallback((card: GalleryCard): void => {
    setSelectedKey(card.key);
  }, []);

  const closeDialog = useCallback((): void => {
    setSelectedKey(null);
  }, []);

  /*
   * A same-document fragment click is a POP navigation to the data router,
   * whose ScrollRestoration (keyed on pathname) then restores the position it
   * saved for this route and undoes the jump. Handling the click here keeps
   * the router out of it; the href stays for semantics and the hash is still
   * written to the URL. User-initiated scrollIntoView is allowed by design.
   */
  const jumpToSection = useCallback(
    (event: MouseEvent<HTMLElement>, sectionId: string): void => {
      const domId = gallerySectionDomId(sectionId);
      const target = document.getElementById(domId);
      if (!target) {
        return;
      }

      event.preventDefault();
      window.history.replaceState(window.history.state, "", `#${domId}`);
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
      }
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    },
    [],
  );

  const {
    visibleSections,
    sectionCount,
    totalRecords,
    matchCount,
    shownCount,
    loadMore,
    isLoading,
    isFetching,
    allFailed,
    sectionErrors,
    refetchSection,
    mediaErrorCount,
    mediaStatusByToken,
    onVisibleRangeChange,
    getCardByKey,
  } = useGallerySections({ family, filter: q, sort, selectedKey });

  const tone = getApiFamilyTone(family);
  const layout = DATASET_PROFILES[slug]?.layout ?? "compact";
  const filterActive = q.length > 0;
  const multiSection = sectionCount > 1;

  const selectedCard = getCardByKey(selectedKey);
  const selectedToken = selectedCard?.mediaRequestPath
    ? buildMediaQueryToken(
        selectedCard.mediaRequestPath,
        selectedCard.mediaRequestNamespace,
      )
    : undefined;
  const selectedStatus = selectedToken
    ? mediaStatusByToken.get(selectedToken)
    : undefined;
  const enriching = Boolean(selectedStatus?.isPending);
  const selectedError = selectedStatus?.isError
    ? selectedStatus.error
    : undefined;

  const showNoMatches =
    !isLoading && !allFailed && filterActive && matchCount === 0;
  const showNoRecords =
    !isLoading && !allFailed && !filterActive && totalRecords === 0;
  const showMediaAlert = mediaErrorCount > dismissedMediaErrors;

  // Large sections are paged, so the shown count can trail the match count.
  const summary =
    filterActive || shownCount < totalRecords
      ? `Showing ${formatNumber(shownCount)} of ${formatNumber(totalRecords)}`
      : `Showing ${formatNumber(totalRecords)} records`;

  return (
    <Stack sx={{ gap: (theme) => theme.wc.layout.sectionGap }}>
      <PageHeader
        title={title}
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        description={description}
        documentTitle={title}
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {!isLoading || totalRecords > 0 ? (
              <Chip
                size="small"
                label={`${formatNumber(totalRecords)} records`}
              />
            ) : null}
            {multiSection ? (
              <Chip size="small" label={`${sectionCount} sections`} />
            ) : null}
          </>
        }
      />

      <Box ref={filterBarWrapperRef} sx={{ display: "contents" }}>
        <ExplorerFilterBar
          sticky
          label="Filter records"
          progress={isFetching && !isLoading}
          summary={summary}
        >
          <SearchField
            label="Filter records by name"
            placeholder="Filter by name"
            value={draft}
            onChange={handleDraftChange}
            onDebouncedChange={commitFilter}
            onSubmit={commitFilter}
            onClear={clearFilter}
            minLength={MIN_FILTER_LENGTH}
          />
          <SegmentedControl<GallerySort>
            label="Sort"
            options={SORT_OPTIONS}
            value={sort}
            onChange={handleSortChange}
            size="small"
          />
          {visibleSections.length > 1 ? (
            <Stack
              component="nav"
              aria-label="Jump to section"
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              sx={{ flexBasis: "100%", minWidth: 0 }}
            >
              {visibleSections.map((section) => (
                <Chip
                  key={section.id}
                  component="a"
                  clickable
                  href={`#${gallerySectionDomId(section.id)}`}
                  onClick={(event: MouseEvent<HTMLElement>) =>
                    jumpToSection(event, section.id)
                  }
                  label={section.label}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          ) : null}
        </ExplorerFilterBar>
      </Box>

      {showMediaAlert ? (
        <Alert
          severity="warning"
          onClose={() => setDismissedMediaErrors(mediaErrorCount)}
        >
          {formatNumber(mediaErrorCount)} previews couldn&apos;t load (Blizzard
          rate limit or missing media). Scroll to retry.
        </Alert>
      ) : null}

      {allFailed && sectionErrors.length > 0 ? (
        <ErrorState
          error={sectionErrors[0].error}
          title="Couldn't load this dataset"
          context={title.toLowerCase()}
          onRetry={() => {
            sectionErrors.forEach((entry) => refetchSection(entry.endpoint.id));
          }}
        />
      ) : null}

      {showNoMatches ? (
        <EmptyState
          title={`No records match “${q}”`}
          description="Try a shorter name."
          action={
            <Button variant="outlined" onClick={clearFilter}>
              Clear filter
            </Button>
          }
        />
      ) : null}

      {showNoRecords ? (
        <EmptyState
          title="No live records"
          description="Blizzard returned no entries for this dataset."
        />
      ) : null}

      {!allFailed
        ? visibleSections.map((section) => (
            <GallerySection
              key={section.id}
              section={section}
              tone={tone}
              layout={layout}
              onSelect={handleSelect}
              onVisibleRangeChange={onVisibleRangeChange}
              onLoadMore={loadMore}
              filterActive={filterActive}
              headed={multiSection}
              stickyOffset={filterBarHeight}
            />
          ))
        : null}

      {!allFailed
        ? sectionErrors.map((entry) => (
            <GallerySectionError
              key={entry.endpoint.id}
              endpoint={entry.endpoint}
              error={entry.error}
              onRetry={() => refetchSection(entry.endpoint.id)}
            />
          ))
        : null}

      <GalleryRecordDialog
        card={selectedCard}
        enriching={enriching}
        error={selectedError}
        onClose={closeDialog}
        onRetry={selectedStatus?.refetch}
      />
    </Stack>
  );
};

export default ApiDatasetGalleryPage;
