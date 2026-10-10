import { creatureDisplayKeys } from "@/features/creatures/hooks/creatureDisplayQueries";
import { fetchCreatureDisplayRender } from "@/features/creatures/services/creatureDisplayService";
import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import type { SearchResult } from "@/features/search/types";
import {
  fetchSpellIcon,
  spellKeys,
} from "@/features/spells/services/spellService";

/*
 * Search hits carry no artwork of their own, so every surface that renders
 * them (the /search grid and the header suggestion list) resolves it lazily.
 * This is the one place that knows which endpoint a kind's artwork comes from
 * and which cache entry it belongs in:
 *
 *   item      media/item/{id}                  itemKeys.media
 *   spell     media/spell/{id}                 spellKeys.icon
 *   mount     media/creature-display/{id}      creatureDisplayKeys.render
 *   npc       media/creature-display/{id}      creatureDisplayKeys.render
 *
 * Mounts and creatures have no media endpoint of their own; their artwork is
 * their creature display's render, and `search/mount` / `search/creature`
 * hand the display ids back inline on every hit, so it costs one request and
 * no detail lookup (`creatureDisplayId` on SearchResult).
 *
 * The keys are the explorers' own factories on purpose: an icon loaded in the
 * Items explorer, a render loaded in Mounts, Creatures or the Journal and the
 * same artwork here are one cache entry, fetched once.
 */

/** A react-query descriptor for one result's artwork. */
export type ResultMediaQuery = {
  queryKey: readonly unknown[];
  /** Resolves to `null` when Blizzard has no artwork (404), never throwing for it. */
  queryFn: (context: { signal: AbortSignal }) => Promise<string | null>;
};

/**
 * Where one result's artwork comes from, or `undefined` when the result
 * already carries a URL or its kind has no artwork to fetch. Callers add
 * their own `enabled` / `staleTime`, so the enrichment stays staggered and
 * never gates the grid it belongs to.
 */
export const resultMediaQuery = (
  result: SearchResult,
): ResultMediaQuery | undefined => {
  if (result.mediaUrl) {
    return undefined;
  }

  switch (result.kind) {
    case "item":
      return {
        queryKey: itemKeys.media(result.id),
        queryFn: ({ signal }) => fetchItemMediaUrl(result.id, signal),
      };
    case "spell":
      return {
        queryKey: spellKeys.icon(result.id),
        queryFn: ({ signal }) => fetchSpellIcon(result.id, signal),
      };
    case "mount":
    case "npc": {
      const displayId = result.creatureDisplayId;
      if (displayId === undefined) {
        return undefined;
      }
      return {
        queryKey: creatureDisplayKeys.render(displayId),
        queryFn: ({ signal }) => fetchCreatureDisplayRender(displayId, signal),
      };
    }
    default:
      return undefined;
  }
};
