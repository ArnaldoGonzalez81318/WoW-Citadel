import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import {
  fetchClassIcon,
  fetchFactionSourceCounts,
  fetchMountDetail,
  fetchMountFacets,
  fetchMountIndex,
} from "@/features/mounts/services/mountService";
import type { MountFactionType, MountFilterCriteria } from "@/features/mounts/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

/** Mounts, sources and records change with patches, not hours. */
export const STATIC_STALE_MS = 24 * 60 * 60_000;
/** A result page is static data too, but a visitor may page through many; an hour keeps the cache lean. */
export const PAGE_STALE_MS = 60 * 60_000;

/*
 * A page of 24 cards starts a render lookup per card as it nears the
 * viewport. Started together they would burst through the proxy, which
 * shares Blizzard's per-second quota with every other visitor (and Netlify
 * allows each IP 600 a minute); six at a time lands a page well inside a
 * second. Cards left behind by a page change cancel their queued lookups.
 */
const limitRenderFetch = createConcurrencyLimiter(6);

/*
 * Names are localized, so those keys carry the locale; counts are not
 * (the names they come with live in the facets query).
 */
export const mountKeys = {
  index: () => ["mounts", "index", env.region, env.locale] as const,
  facets: () => ["mounts", "facets", env.region, env.locale] as const,
  factionSources: (faction: MountFactionType) =>
    ["mounts", "faction-sources", faction, env.region] as const,
  /** A batch of search records by id: one index page, or a name search's matches. */
  records: (kind: "page" | "matches", ids: readonly number[]) =>
    ["mounts", "records", kind, ids.join(","), env.region, env.locale] as const,
  searchPage: (criteria: MountFilterCriteria, page: number) =>
    [
      "mounts",
      "search-page",
      criteria.source,
      criteria.faction,
      criteria.sort,
      page,
      env.region,
      env.locale,
    ] as const,
  detail: (mountId: number) => ["mounts", "detail", mountId, env.region, env.locale] as const,
  /** Not localized: an icon URL is the same in every locale. */
  classIcon: (classId: number) => ["mounts", "class-icon", classId, env.region] as const,
};

export const mountIndexQuery = () => ({
  queryKey: mountKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchMountIndex(signal),
  staleTime: STATIC_STALE_MS,
});

export const mountFacetsQuery = () => ({
  queryKey: mountKeys.facets(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchMountFacets(signal),
  staleTime: STATIC_STALE_MS,
});

export const factionSourceCountsQuery = (faction: MountFactionType) => ({
  queryKey: mountKeys.factionSources(faction),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchFactionSourceCounts(faction, signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by the dialog and the spotlight (null when Blizzard has no such mount). */
export const mountDetailQuery = (mountId: number) => ({
  queryKey: mountKeys.detail(mountId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchMountDetail(mountId, signal),
  staleTime: STATIC_STALE_MS,
});

export const classIconQuery = (classId: number) => ({
  queryKey: mountKeys.classIcon(classId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchClassIcon(classId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

/**
 * The shared creature-display render (same cache entry as the Creatures and
 * Journal pages), queued behind this page's own cap.
 */
export const mountRenderQuery = (displayId: number) => {
  const shared = creatureDisplayRenderQuery(displayId);
  return {
    ...shared,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      limitRenderFetch(() => shared.queryFn({ signal }), signal),
  };
};
