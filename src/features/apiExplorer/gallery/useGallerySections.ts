import {
  keepPreviousData,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { VisibleRange } from "@/components/common/VirtualizedCardGrid";
import { getDatasetSourceEndpoints } from "@/features/apiExplorer/config/apiCatalog";
import {
  DATASET_PROFILES,
  isRetryableBlizzardError,
  mediaRetryDelay,
  runMediaStrategy,
} from "@/features/apiExplorer/gallery/mediaStrategies";
import type {
  MediaQueryResult,
  MediaQueryTarget,
} from "@/features/apiExplorer/gallery/mediaStrategies";
import {
  buildMediaQueryToken,
  extractEntries,
  normalizeSectionCards,
  resolveEndpointRequest,
  sectionLabelForEndpoint,
} from "@/features/apiExplorer/gallery/normalizeRecords";
import type {
  EndpointRequestDetails,
  GalleryCard,
  GallerySection,
} from "@/features/apiExplorer/gallery/normalizeRecords";
import type {
  ApiEndpointDefinition,
  ApiFamilyConfig,
} from "@/features/apiExplorer/types";
import { blizzardClient } from "@/lib/blizzardClient";
import { env } from "@/lib/env";
import { getExternalLink } from "@/lib/externalLinks";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type GallerySort = "api" | "name" | "id";

export type VisibleGallerySection = GallerySection & {
  /** Cards matching the active filter (all cards when no filter). */
  matchCount: number;
};

export type SectionError = {
  endpoint: ApiEndpointDefinition;
  error: unknown;
};

export type MediaStatus = {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

export type UseGallerySectionsOptions = {
  family: ApiFamilyConfig;
  /** Lower-cased name filter; already debounced and >= 2 chars by the page. */
  filter: string;
  sort: GallerySort;
  /**
   * Key of the card open in the detail dialog. Its enrichment always runs,
   * even when the card sits outside the visible range or beyond the
   * per-section target cap, so the dialog never reports missing metadata
   * that was simply never requested.
   */
  selectedKey?: string | null;
};

export type UseGallerySectionsResult = {
  /** Every section with enriched cards, in catalog order. */
  sections: GallerySection[];
  /** Sections after filter + sort (sections with no match are dropped while filtering). */
  visibleSections: VisibleGallerySection[];
  totalRecords: number;
  matchCount: number;
  isLoading: boolean;
  isFetching: boolean;
  allFailed: boolean;
  sectionErrors: SectionError[];
  refetchSection: (endpointId: string) => void;
  mediaErrorCount: number;
  mediaStatusByToken: ReadonlyMap<string, MediaStatus>;
  onVisibleRangeChange: (sectionId: string, range: VisibleRange) => void;
  getCardByKey: (key: string | null) => GalleryCard | null;
};

/* ------------------------------------------------------------------ */
/* Constants + module-level combiners (stable identity for `combine`)  */
/* ------------------------------------------------------------------ */

const STALE_TIME_MS = 300_000;
const MAX_MEDIA_TARGETS_PER_SECTION = 40;
const EMPTY_RANGE: VisibleRange = { start: 0, end: 0 };

/*
 * The combined values are plain data only (no closures): QueriesObserver runs
 * them through `replaceEqualDeep`, so `data` keeps its identity until a query
 * actually changes and the memos below do not rerun on every render.
 */

type CombinedEndpointQueries = {
  data: unknown[];
  errors: Array<unknown | null>;
  isLoading: boolean;
  isFetching: boolean;
};

const combineEndpointQueries = (
  results: UseQueryResult<unknown>[],
): CombinedEndpointQueries => ({
  data: results.map((result) => result.data),
  errors: results.map((result) => result.error ?? null),
  isLoading: results.some((result) => result.isPending),
  isFetching: results.some((result) => result.isFetching),
});

type CombinedMediaQuery = {
  data: MediaQueryResult | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

const combineMediaQueries = (
  results: UseQueryResult<MediaQueryResult>[],
): CombinedMediaQuery[] =>
  results.map((result) => ({
    data: result.data,
    isPending: result.isPending || result.isFetching,
    isError: result.isError,
    error: result.error ?? null,
  }));

const endpointQueryKey = (
  slug: string,
  endpoint: ApiEndpointDefinition,
  request: EndpointRequestDetails,
): readonly unknown[] => [
  "api-dataset-gallery",
  slug,
  endpoint.id,
  request.requestPath,
  request.queryParams,
  env.region,
  env.locale,
];

/** No `name` in the key: identical detail/media targets dedupe across cards. */
const mediaQueryKey = (
  slug: string,
  target: MediaQueryTarget,
): readonly unknown[] => [
  "api-dataset-gallery-media",
  slug,
  target.path,
  target.namespace,
  target.strategy,
  env.region,
  env.locale,
];

const retryPolicy = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && isRetryableBlizzardError(error);

/** The enrichment request a card still needs, if any (cards with media skip it). */
const mediaTargetForCard = (
  card: GalleryCard,
): MediaQueryTarget | undefined => {
  if (!card.mediaRequestPath || !card.mediaRequestStrategy || card.mediaUrl) {
    return undefined;
  }

  return {
    token: buildMediaQueryToken(
      card.mediaRequestPath,
      card.mediaRequestNamespace,
    ),
    path: card.mediaRequestPath,
    namespace: card.mediaRequestNamespace,
    strategy: card.mediaRequestStrategy,
  };
};

const sortCards = (cards: GalleryCard[], sort: GallerySort): GalleryCard[] => {
  if (sort === "name") {
    return [...cards].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "id") {
    return [...cards].sort((a, b) => a.id - b.id);
  }
  return cards;
};

const applyEnrichment = (
  card: GalleryCard,
  enrichment: MediaQueryResult,
): GalleryCard => {
  const next: GalleryCard = {
    ...card,
    mediaUrl: card.mediaUrl ?? enrichment.url,
    summary: card.summary ?? enrichment.summary,
    details: enrichment.details ?? card.details,
    tag: card.tag ?? enrichment.tag,
    meta:
      enrichment.meta && enrichment.meta.length > 0
        ? enrichment.meta
        : card.meta,
    spellId: enrichment.spellId ?? card.spellId,
    itemId: enrichment.itemId ?? card.itemId,
  };

  const link =
    typeof next.spellId === "number"
      ? getExternalLink("spell", next.spellId, next.name)
      : typeof next.itemId === "number"
        ? getExternalLink("item", next.itemId, next.name)
        : undefined;

  if (link) {
    next.externalUrl = link.url;
    next.externalLabel = link.label;
  }

  return next;
};

/**
 * Merges landed enrichment into a section's cards. Returns the very same
 * section object when no card changed so VirtualizedCardGrid keeps its
 * `items` identity (F014).
 */
const enrichSection = <S extends GallerySection>(
  section: S,
  mediaResultByToken: ReadonlyMap<string, MediaQueryResult | undefined>,
): S => {
  let changed = false;

  const cards = section.cards.map((card) => {
    if (!card.mediaRequestPath) {
      return card;
    }
    const enrichment = mediaResultByToken.get(
      buildMediaQueryToken(card.mediaRequestPath, card.mediaRequestNamespace),
    );
    if (!enrichment || enrichment.status === "not-found") {
      return card;
    }
    changed = true;
    return applyEnrichment(card, enrichment);
  });

  return changed ? { ...section, cards } : section;
};

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export const useGallerySections = ({
  family,
  filter,
  sort,
  selectedKey = null,
}: UseGallerySectionsOptions): UseGallerySectionsResult => {
  const queryClient = useQueryClient();
  const slug = family.slug;
  const profile = DATASET_PROFILES[slug];

  const eligibleEndpoints = useMemo(
    () => getDatasetSourceEndpoints(family),
    [family],
  );

  const resolvedRequests = useMemo(
    () => eligibleEndpoints.map((endpoint) => resolveEndpointRequest(endpoint)),
    [eligibleEndpoints],
  );

  /* ---------------------------- index queries ------------------------ */

  const {
    data: endpointData,
    errors,
    isLoading,
    isFetching,
  } = useQueries({
    queries: eligibleEndpoints.map((endpoint, index) => {
      const request = resolvedRequests[index];

      return {
        queryKey: endpointQueryKey(slug, endpoint, request),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          blizzardClient.get<unknown>(
            request.requestPath,
            { ...request.queryParams, namespace: request.namespace },
            { signal },
          ),
        retry: retryPolicy,
        retryDelay: mediaRetryDelay,
        staleTime: STALE_TIME_MS,
        placeholderData: keepPreviousData,
      };
    }),
    combine: combineEndpointQueries,
  });

  const baseSections = useMemo<GallerySection[]>(
    () =>
      eligibleEndpoints.map((endpoint, index) => {
        const data = endpointData[index];
        const request = resolvedRequests[index];
        const entries = data ? extractEntries(data) : [];

        return {
          id: endpoint.id,
          label: sectionLabelForEndpoint(endpoint),
          cards: normalizeSectionCards(profile, entries, endpoint, request),
          totalEntries: entries.length,
        };
      }),
    [eligibleEndpoints, endpointData, resolvedRequests, profile],
  );

  /* ---------------------------- visible ranges ----------------------- */

  const [visibleRangesBySectionId, setVisibleRangesBySectionId] = useState<
    Record<string, VisibleRange>
  >({});

  useEffect(() => {
    setVisibleRangesBySectionId({});
  }, [slug]);

  const onVisibleRangeChange = useCallback(
    (sectionId: string, range: VisibleRange) => {
      setVisibleRangesBySectionId((current) => {
        const existing = current[sectionId];
        if (existing?.start === range.start && existing.end === range.end) {
          return current;
        }
        return { ...current, [sectionId]: range };
      });
    },
    [],
  );

  /* ---------------------------- filter + sort ------------------------ */

  /*
   * Filter and sort are applied to the un-enriched cards: names and ids never
   * change with enrichment, and the visible ranges the grid reports index
   * into THESE arrays, so media targets must be sliced from them.
   */
  const baseVisibleSections = useMemo<VisibleGallerySection[]>(() => {
    const query = filter.trim().toLowerCase();

    return baseSections
      .map((section) => {
        const matching =
          query.length > 0
            ? section.cards.filter((card) =>
                card.name.toLowerCase().includes(query),
              )
            : section.cards;

        return {
          ...section,
          cards: sortCards(matching, sort),
          matchCount: matching.length,
        };
      })
      .filter((section) => query.length === 0 || section.matchCount > 0);
  }, [baseSections, filter, sort]);

  /* ---------------------------- media targets ------------------------ */

  const baseCardsByKey = useMemo(() => {
    const map = new Map<string, GalleryCard>();
    baseSections.forEach((section) =>
      section.cards.forEach((card) => map.set(card.key, card)),
    );
    return map;
  }, [baseSections]);

  const mediaTargets = useMemo<MediaQueryTarget[]>(() => {
    const seen = new Set<string>();
    const targets: MediaQueryTarget[] = [];

    const addTarget = (card: GalleryCard): void => {
      const target = mediaTargetForCard(card);
      if (!target || seen.has(target.token)) {
        return;
      }
      seen.add(target.token);
      targets.push(target);
    };

    for (const section of baseVisibleSections) {
      const range = visibleRangesBySectionId[section.id] ?? EMPTY_RANGE;
      const start = Math.max(0, Math.min(section.cards.length, range.start));
      const end = Math.max(
        start,
        Math.min(
          section.cards.length,
          range.end,
          start + MAX_MEDIA_TARGETS_PER_SECTION,
        ),
      );

      for (const card of section.cards.slice(start, end)) {
        addTarget(card);
      }
    }

    const selectedCard =
      selectedKey === null ? undefined : baseCardsByKey.get(selectedKey);
    if (selectedCard) {
      addTarget(selectedCard);
    }

    return targets;
  }, [
    baseVisibleSections,
    baseCardsByKey,
    visibleRangesBySectionId,
    selectedKey,
  ]);

  const mediaData = useQueries({
    queries: mediaTargets.map((target) => ({
      queryKey: mediaQueryKey(slug, target),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        runMediaStrategy(target, { queryClient, signal }),
      retry: retryPolicy,
      retryDelay: mediaRetryDelay,
      staleTime: STALE_TIME_MS,
    })),
    combine: combineMediaQueries,
  });

  const mediaResultByToken = useMemo(() => {
    const map = new Map<string, MediaQueryResult | undefined>();
    mediaTargets.forEach((target, index) => {
      map.set(target.token, mediaData[index]?.data);
    });
    return map;
  }, [mediaData, mediaTargets]);

  const mediaStatusByToken = useMemo(() => {
    const map = new Map<string, MediaStatus>();
    mediaTargets.forEach((target, index) => {
      const entry = mediaData[index];
      if (entry) {
        map.set(target.token, {
          isPending: entry.isPending,
          isError: entry.isError,
          error: entry.error ?? undefined,
          refetch: () => {
            void queryClient.refetchQueries({
              queryKey: mediaQueryKey(slug, target),
              exact: true,
            });
          },
        });
      }
    });
    return map;
  }, [mediaData, mediaTargets, queryClient, slug]);

  /* ---------------------------- enriched sections -------------------- */

  const sections = useMemo<GallerySection[]>(
    () =>
      baseSections.map((section) => enrichSection(section, mediaResultByToken)),
    [baseSections, mediaResultByToken],
  );

  const visibleSections = useMemo<VisibleGallerySection[]>(
    () =>
      baseVisibleSections.map((section) =>
        enrichSection(section, mediaResultByToken),
      ),
    [baseVisibleSections, mediaResultByToken],
  );

  const cardsByKey = useMemo(() => {
    const map = new Map<string, GalleryCard>();
    sections.forEach((section) =>
      section.cards.forEach((card) => map.set(card.key, card)),
    );
    return map;
  }, [sections]);

  const getCardByKey = useCallback(
    (key: string | null): GalleryCard | null =>
      key === null ? null : (cardsByKey.get(key) ?? null),
    [cardsByKey],
  );

  /* ---------------------------- totals ------------------------------- */

  const totalRecords = useMemo(
    () => sections.reduce((sum, section) => sum + section.totalEntries, 0),
    [sections],
  );

  const matchCount = useMemo(
    () => visibleSections.reduce((sum, section) => sum + section.matchCount, 0),
    [visibleSections],
  );

  /* ---------------------------- errors ------------------------------- */

  const sectionErrors = useMemo<SectionError[]>(
    () =>
      eligibleEndpoints.flatMap((endpoint, index) => {
        const error = errors[index];
        return error ? [{ endpoint, error }] : [];
      }),
    [eligibleEndpoints, errors],
  );

  const refetchSection = useCallback(
    (endpointId: string) => {
      const index = eligibleEndpoints.findIndex(
        (endpoint) => endpoint.id === endpointId,
      );
      if (index < 0) {
        return;
      }
      void queryClient.refetchQueries({
        queryKey: endpointQueryKey(
          slug,
          eligibleEndpoints[index],
          resolvedRequests[index],
        ),
        exact: true,
      });
    },
    [eligibleEndpoints, resolvedRequests, queryClient, slug],
  );

  const allFailed =
    eligibleEndpoints.length > 0 && errors.every((error) => Boolean(error));

  const mediaErrorCount = useMemo(
    () => mediaData.filter((entry) => entry.isError).length,
    [mediaData],
  );

  return {
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
  };
};

export default useGallerySections;
