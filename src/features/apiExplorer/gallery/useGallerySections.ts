import {
  keepPreviousData,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

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
  compareCardNames,
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
  /**
   * More matching cards exist beyond `cards`: large sections are paged
   * (`GALLERY_PAGE_SIZE` at a time) so the document never grows to tens of
   * thousands of pixels; `loadMore(section.id)` reveals the next page.
   */
  hasMore: boolean;
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
  /**
   * Sections with something to show, after filter + sort: pending sections
   * (rendered as skeletons) and sections with at least one card (one match
   * while filtering). Settled-empty and failed endpoints are excluded.
   */
  visibleSections: VisibleGallerySection[];
  /** Sections that are pending or hold cards, ignoring the filter. */
  sectionCount: number;
  totalRecords: number;
  matchCount: number;
  /** Matching cards currently handed to the grids (after paging). */
  shownCount: number;
  /** Reveals the next `GALLERY_PAGE_SIZE` cards of a paged section. */
  loadMore: (sectionId: string) => void;
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

/** Sections with more matching cards than this are revealed a page at a time. */
export const GALLERY_PAGINATE_ABOVE = 200;
export const GALLERY_PAGE_SIZE = 96;

const EMPTY_PAGES: Record<string, number> = {};

/*
 * The combined value is plain data only (no closures): QueriesObserver runs
 * it through `replaceEqualDeep`, so `data` keeps its identity until a query
 * actually changes and the memos below do not rerun on every render. The
 * endpoint list is fixed per family, so the memoised combine is always
 * aligned with the queries.
 */

type CombinedEndpointQueries = {
  data: unknown[];
  errors: Array<unknown | null>;
  /** Per endpoint: no data yet and not failed. */
  pending: boolean[];
  isLoading: boolean;
  isFetching: boolean;
};

const combineEndpointQueries = (
  results: UseQueryResult<unknown>[],
): CombinedEndpointQueries => ({
  data: results.map((result) => result.data),
  errors: results.map((result) => result.error ?? null),
  pending: results.map((result) => result.isPending),
  isLoading: results.some((result) => result.isPending),
  isFetching: results.some((result) => result.isFetching),
});

/**
 * One media query's state, keyed by token. Media queries do NOT use
 * `combine`: its memoised result lags one render behind whenever the target
 * list changes, which would join card N's result to whichever card now sits
 * at index N. The raw result array is always aligned with the `queries`
 * passed in the same render, so the map is built from it directly and keeps
 * its identity (and each entry's) while nothing changed.
 */
type MediaEntry = {
  target: MediaQueryTarget;
  data: MediaQueryResult | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

type MediaByToken = ReadonlyMap<string, MediaEntry>;

const EMPTY_MEDIA: MediaByToken = new Map();

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
    return [...cards].sort(compareCardNames);
  }
  if (sort === "id") {
    return [...cards].sort((a, b) => a.id - b.id);
  }
  return cards;
};

/*
 * Enrichment is a pure function of (base card, enrichment data). Caching the
 * output per base card keeps enriched cards' identities stable across renders
 * (react-query keeps `data` identity via structural sharing), so
 * memo(ResultCard) bails out and VirtualizedCardGrid sees unchanged items.
 */
const enrichedCardCache = new WeakMap<
  GalleryCard,
  { enrichment: MediaQueryResult; card: GalleryCard }
>();

const applyEnrichment = (
  card: GalleryCard,
  enrichment: MediaQueryResult,
): GalleryCard => {
  const cached = enrichedCardCache.get(card);
  if (cached && cached.enrichment === enrichment) {
    return cached.card;
  }

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

  enrichedCardCache.set(card, { enrichment, card: next });
  return next;
};

/** Last enriched output per base section, so unchanged sections keep identity. */
const enrichedSectionCache = new WeakMap<GallerySection, GallerySection>();

/**
 * Merges landed enrichment into a section's cards. Returns the very same
 * section object when no card has enrichment, and the previously returned
 * object when every enriched card is identical to last time, so
 * VirtualizedCardGrid keeps its `items` identity (F014).
 */
const enrichSection = <S extends GallerySection>(
  section: S,
  mediaByToken: MediaByToken,
): S => {
  let changed = false;

  const cards = section.cards.map((card) => {
    if (!card.mediaRequestPath) {
      return card;
    }
    const enrichment = mediaByToken.get(
      buildMediaQueryToken(card.mediaRequestPath, card.mediaRequestNamespace),
    )?.data;
    if (!enrichment || enrichment.status === "not-found") {
      return card;
    }
    changed = true;
    return applyEnrichment(card, enrichment);
  });

  if (!changed) {
    return section;
  }

  const previous = enrichedSectionCache.get(section) as S | undefined;
  if (
    previous &&
    previous.cards.length === cards.length &&
    previous.cards.every((card, index) => card === cards[index])
  ) {
    return previous;
  }

  const next: S = { ...section, cards };
  enrichedSectionCache.set(section, next);
  return next;
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

  const endpointQueries = useMemo(
    () =>
      eligibleEndpoints.map((endpoint, index) => {
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
    [eligibleEndpoints, resolvedRequests, slug],
  );

  const {
    data: endpointData,
    errors,
    pending: endpointPending,
    isLoading,
    isFetching,
  } = useQueries({
    queries: endpointQueries,
    combine: combineEndpointQueries,
  });

  const baseSections = useMemo<GallerySection[]>(
    () =>
      eligibleEndpoints.map((endpoint, index) => {
        const data = endpointData[index];
        const request = resolvedRequests[index];
        const entries = data ? extractEntries(data) : [];
        const cards = normalizeSectionCards(
          profile,
          entries,
          endpoint,
          request,
        );

        return {
          id: endpoint.id,
          label: sectionLabelForEndpoint(endpoint),
          cards,
          totalEntries: cards.length,
          pending: endpointPending[index] === true,
        };
      }),
    [
      eligibleEndpoints,
      endpointData,
      endpointPending,
      resolvedRequests,
      profile,
    ],
  );

  /* ---------------------------- visible ranges ----------------------- */

  // CategoryPage remounts the gallery per slug, so no slug reset is needed.
  const [visibleRangesBySectionId, setVisibleRangesBySectionId] = useState<
    Record<string, VisibleRange>
  >({});

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

  /* ---------------------------- paging ------------------------------- */

  /*
   * Pages revealed per section, valid for one (filter, sort) combination: a
   * new filter or order starts every section at its first page again.
   */
  const pagingKey = `${filter.trim().toLowerCase()} ${sort}`;
  const [paging, setPaging] = useState<{
    key: string;
    pages: Record<string, number>;
  }>({ key: pagingKey, pages: EMPTY_PAGES });
  const pagesBySectionId =
    paging.key === pagingKey ? paging.pages : EMPTY_PAGES;

  const loadMore = useCallback(
    (sectionId: string) => {
      setPaging((current) => {
        const pages = current.key === pagingKey ? current.pages : EMPTY_PAGES;
        return {
          key: pagingKey,
          pages: { ...pages, [sectionId]: (pages[sectionId] ?? 1) + 1 },
        };
      });
    },
    [pagingKey],
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
        const sorted = sortCards(matching, sort);
        const limit =
          sorted.length > GALLERY_PAGINATE_ABOVE
            ? (pagesBySectionId[section.id] ?? 1) * GALLERY_PAGE_SIZE
            : sorted.length;

        return {
          ...section,
          cards: sorted.length > limit ? sorted.slice(0, limit) : sorted,
          matchCount: matching.length,
          hasMore: sorted.length > limit,
        };
      })
      .filter(
        (section) =>
          section.pending ||
          (section.cards.length > 0 &&
            (query.length === 0 || section.matchCount > 0)),
      );
  }, [baseSections, filter, sort, pagesBySectionId]);

  const sectionCount = useMemo(
    () =>
      baseSections.filter(
        (section) => section.pending || section.cards.length > 0,
      ).length,
    [baseSections],
  );

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

  const mediaQueries = useMemo(
    () =>
      mediaTargets.map((target) => ({
        queryKey: mediaQueryKey(slug, target),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          runMediaStrategy(target, { queryClient, signal }),
        retry: retryPolicy,
        retryDelay: mediaRetryDelay,
        staleTime: STALE_TIME_MS,
      })),
    [mediaTargets, slug, queryClient],
  );

  // No `combine` here on purpose: see MediaEntry.
  const mediaResults = useQueries({ queries: mediaQueries });

  const previousMediaRef = useRef<MediaByToken>(EMPTY_MEDIA);

  const mediaByToken = useMemo<MediaByToken>(() => {
    const previous = previousMediaRef.current;
    const next = new Map<string, MediaEntry>();
    let unchanged = previous.size === mediaTargets.length;

    mediaTargets.forEach((target, index) => {
      const result = mediaResults[index];
      if (!result) {
        unchanged = false;
        return;
      }

      const isPending = result.isPending || result.isFetching;
      const error = result.error ?? null;
      const old = previous.get(target.token);
      const entry =
        old &&
        old.data === result.data &&
        old.isPending === isPending &&
        old.isError === result.isError &&
        old.error === error
          ? old
          : {
              target,
              data: result.data,
              isPending,
              isError: result.isError,
              error,
            };

      if (entry !== old) {
        unchanged = false;
      }
      next.set(target.token, entry);
    });

    const resolved = unchanged ? previous : next;
    previousMediaRef.current = resolved;
    return resolved;
  }, [mediaResults, mediaTargets]);

  const mediaStatusByToken = useMemo(() => {
    const map = new Map<string, MediaStatus>();
    mediaByToken.forEach((entry, token) => {
      map.set(token, {
        isPending: entry.isPending,
        isError: entry.isError,
        error: entry.error ?? undefined,
        refetch: () => {
          void queryClient.refetchQueries({
            queryKey: mediaQueryKey(slug, entry.target),
            exact: true,
          });
        },
      });
    });
    return map;
  }, [mediaByToken, queryClient, slug]);

  /* ---------------------------- enriched sections -------------------- */

  const sections = useMemo<GallerySection[]>(
    () => baseSections.map((section) => enrichSection(section, mediaByToken)),
    [baseSections, mediaByToken],
  );

  const visibleSections = useMemo<VisibleGallerySection[]>(
    () =>
      baseVisibleSections.map((section) =>
        enrichSection(section, mediaByToken),
      ),
    [baseVisibleSections, mediaByToken],
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

  const shownCount = useMemo(
    () =>
      visibleSections.reduce((sum, section) => sum + section.cards.length, 0),
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

  const mediaErrorCount = useMemo(() => {
    let count = 0;
    mediaByToken.forEach((entry) => {
      if (entry.isError) {
        count += 1;
      }
    });
    return count;
  }, [mediaByToken]);

  return {
    sections,
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
  };
};

export default useGallerySections;
