import {
  fetchCrestMediaUrl,
  fetchGuildCrestCatalog,
} from "@/features/guildCrests/services/guildCrestService";
import type { CrestPartKind } from "@/features/guildCrests/types";
import { env } from "@/lib/env";

/** Crest parts and palettes change with expansions, if ever; a day is plenty. */
const CREST_STALE_MS = 24 * 60 * 60_000;

/*
 * No locale in the keys: the crest index and its media records carry no
 * localized text (ids, colours and image URLs only).
 */
export const guildCrestKeys = {
  catalog: () => ["guild-crest-catalog", env.region] as const,
  media: (kind: CrestPartKind, mediaId: number) =>
    ["guild-crest-media", kind, mediaId, env.region] as const,
};

export const guildCrestCatalogQuery = () => ({
  queryKey: guildCrestKeys.catalog(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchGuildCrestCatalog(signal),
  staleTime: CREST_STALE_MS,
});

/** Only run when a derived art URL failed to load (see useCrestArt). */
export const crestMediaQuery = (kind: CrestPartKind, mediaId: number) => ({
  queryKey: guildCrestKeys.media(kind, mediaId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchCrestMediaUrl(kind, mediaId, signal),
  staleTime: CREST_STALE_MS,
});
