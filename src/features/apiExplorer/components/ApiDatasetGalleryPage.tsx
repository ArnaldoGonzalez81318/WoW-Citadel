import { Alert, Button, Chip, Stack } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { GRID_PRESETS } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import type { PageHeaderBreadcrumb } from "@/components/common/PageHeader";
import { getResultCardHeight } from "@/components/common/ResultCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
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
  gallerySectionDomId,
} from "@/features/apiExplorer/gallery/GallerySection";
import GalleryRecordDialog from "@/features/apiExplorer/gallery/GalleryRecordDialog";
import { DATASET_PROFILES } from "@/features/apiExplorer/gallery/mediaStrategies";
import { buildMediaQueryToken } from "@/features/apiExplorer/gallery/normalizeRecords";
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
const SKELETON_COUNT = 24;

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
 * One h2 section per source endpoint, each a virtualised ResultCard grid
 * enriched with media/detail hops as cards scroll into view. `q` and `sort`
 * live in the URL; the dialog reads the live card so enrichment that lands
 * after opening is shown in place.
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

  // Adopt the URL value (navigation, reset) without echoing it back or
  // rewriting what the user is still typing (the committed value is trimmed).
  useEffect(() => {
    setDraft((current) => (current.trim() === q ? current : q));
  }, [q]);

  useEffect(() => {
    setSelectedKey(null);
  }, [slug]);

  const commitFilter = useCallback(
    (value: string): void => {
      const trimmed = value.trim();
      setQ(trimmed.length >= MIN_FILTER_LENGTH ? trimmed : null, {
        replace: true,
      });
    },
    [setQ],
  );

  const clearFilter = useCallback((): void => {
    setDraft("");
    setQ(null, { replace: true });
  }, [setQ]);

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

  const {
    sections,
    visibleSections,
    totalRecords,
    matchCount,
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

  const showSkeleton =
    isLoading && sections.every((section) => section.cards.length === 0);
  const showNoMatches =
    !isLoading && !allFailed && filterActive && matchCount === 0;
  const showNoRecords =
    !isLoading && !allFailed && !filterActive && totalRecords === 0;
  const showMediaAlert = mediaErrorCount > dismissedMediaErrors;

  const summary = filterActive
    ? `Showing ${formatNumber(matchCount)} of ${formatNumber(totalRecords)}`
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
            {sections.length > 1 ? (
              <Chip size="small" label={`${sections.length} sections`} />
            ) : null}
          </>
        }
      />

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
          onChange={setDraft}
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
        {sections.length > 1 && visibleSections.length > 0 ? (
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
                label={section.label}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        ) : null}
      </ExplorerFilterBar>

      {showMediaAlert ? (
        <Alert
          severity="warning"
          onClose={() => setDismissedMediaErrors(mediaErrorCount)}
        >
          {formatNumber(mediaErrorCount)} previews couldn&apos;t load (Blizzard
          rate limit or missing media). Scroll to retry.
        </Alert>
      ) : null}

      {showSkeleton ? (
        <LoadingSkeleton
          variant="grid"
          columns={layout === "row" ? GRID_PRESETS.rows : GRID_PRESETS.compact}
          itemHeight={getResultCardHeight(layout)}
          count={SKELETON_COUNT}
          label="Loading records"
        />
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
              filterActive={filterActive}
              showCount={visibleSections.length > 1}
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
