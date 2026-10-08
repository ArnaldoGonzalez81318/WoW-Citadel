import type { QueryClient } from "@tanstack/react-query";

import {
  fetchMediaOwnerName,
  fetchMediaPage,
  fetchMediaRecord,
  fetchMediaTagList,
  fetchMediaTagSummary,
  lookupMediaById,
} from "@/features/mediaSearch/services/mediaSearchService";
import type {
  MediaPageRequest,
  MediaTagListLoader,
} from "@/features/mediaSearch/services/mediaSearchService";
import type {
  MediaRecord,
  MediaScope,
  MediaTagId,
} from "@/features/mediaSearch/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

/** Static namespace: media only changes with a patch. */
const MEDIA_STALE_MS = 24 * 60 * 60_000;

/*
 * The kind picker counts all 19 tags on load: tiny one-result searches, but
 * started together they would burst through the proxy, which shares
 * Blizzard's per-second quota with every other visitor. Four at a time
 * fills the picker in a few round trips.
 */
const summaryLimiter = createConcurrencyLimiter(4);

type QueryContext = { signal: AbortSignal };

export const mediaSearchKeys = {
  summary: (tag: MediaTagId) =>
    ["media-search", env.region, "summary", tag] as const,
  page: (request: MediaPageRequest) =>
    [
      "media-search",
      env.region,
      "page",
      request.scope,
      request.order,
      request.from,
      request.page,
    ] as const,
  list: (tag: MediaTagId) => ["media-search", env.region, "list", tag] as const,
  lookup: (scope: MediaScope, id: number) =>
    ["media-search", env.region, "lookup", scope, id] as const,
  record: (path: string) =>
    ["media-search", env.region, "record", path] as const,
  // Owner names are localized; the media itself is not.
  owner: (kind: string, id: number) =>
    ["media-search", env.region, env.locale, "owner", kind, id] as const,
};

/** The scope a page query belongs to, for keeping the last page up while the next loads. */
export const PAGE_KEY_SCOPE_INDEX = 3;

export const mediaTagSummaryQuery = (tag: MediaTagId) => ({
  queryKey: mediaSearchKeys.summary(tag),
  queryFn: ({ signal }: QueryContext) =>
    summaryLimiter(() => fetchMediaTagSummary(tag, signal), signal),
  staleTime: MEDIA_STALE_MS,
});

export const mediaPageQuery = (request: MediaPageRequest) => ({
  queryKey: mediaSearchKeys.page(request),
  queryFn: ({ signal }: QueryContext) => fetchMediaPage(request, signal),
  staleTime: MEDIA_STALE_MS,
});

export const mediaTagListQuery = (tag: MediaTagId) => ({
  queryKey: mediaSearchKeys.list(tag),
  queryFn: ({ signal }: QueryContext) => fetchMediaTagList(tag, signal),
  staleTime: MEDIA_STALE_MS,
});

/**
 * A lookup reads a whole tag's list from the cache the grid fills, or
 * fetches it and stores it there for the grid and the next lookup. (Not
 * `ensureQueryData`: that applies the app's retry policy to the list and
 * the lookup's own query retries again on top.)
 */
const cachedTagList =
  (client: QueryClient, signal: AbortSignal): MediaTagListLoader =>
  async (tag) => {
    const key = mediaSearchKeys.list(tag);
    const state = client.getQueryState<MediaRecord[]>(key);
    if (
      state?.data !== undefined &&
      Date.now() - state.dataUpdatedAt < MEDIA_STALE_MS
    ) {
      return state.data;
    }
    const records = await fetchMediaTagList(tag, signal);
    client.setQueryData(key, records);
    return records;
  };

export const mediaLookupQuery = (scope: MediaScope, id: number) => ({
  queryKey: mediaSearchKeys.lookup(scope, id),
  queryFn: ({ signal, client }: QueryContext & { client: QueryClient }) =>
    lookupMediaById(scope, id, cachedTagList(client, signal), signal),
  staleTime: MEDIA_STALE_MS,
});

export const mediaRecordQuery = (path: string) => ({
  queryKey: mediaSearchKeys.record(path),
  queryFn: ({ signal }: QueryContext) => fetchMediaRecord(path, signal),
  staleTime: MEDIA_STALE_MS,
});

export const mediaOwnerQuery = (kind: string, id: number) => ({
  queryKey: mediaSearchKeys.owner(kind, id),
  queryFn: ({ signal }: QueryContext) => fetchMediaOwnerName(kind, id, signal),
  staleTime: MEDIA_STALE_MS,
});
