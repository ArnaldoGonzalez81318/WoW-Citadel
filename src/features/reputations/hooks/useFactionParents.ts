import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { reputationKeys } from "@/features/reputations/hooks/reputationQueries";
import type { Faction, FactionRef } from "@/features/reputations/types";
import { env } from "@/lib/env";

/*
 * Blizzard records a faction's children, never its parent, and only a
 * header's own record says which factions it folds. Rather than fetch every
 * header up front, the page learns parents from the records it already holds:
 * the 14 root groups (always loaded) cover every first-level faction, and a
 * sub-group (The Tillers, Horde Forces) joins as soon as its card or dialog
 * has loaded it. A faction whose parent is not known yet simply shows none.
 */

export type FactionParents = ReadonlyMap<number, FactionRef>;

const isFactionKey = (key: QueryKey): boolean =>
  key[0] === reputationKeys.factions()[0] &&
  key[2] === env.region &&
  key[3] === env.locale;

const collectParents = (queryClient: QueryClient): Map<number, FactionRef> => {
  const parents = new Map<number, FactionRef>();
  queryClient
    .getQueriesData<Faction | null>({ queryKey: reputationKeys.factions() })
    .forEach(([key, record]) => {
      if (!record || !isFactionKey(key)) {
        return;
      }
      record.children.forEach((child) => {
        // A faction listed twice keeps its first parent, so paths never flip.
        if (child.id !== record.id && !parents.has(child.id)) {
          parents.set(child.id, { id: record.id, name: record.name });
        }
      });
    });
  return parents;
};

/** Faction id -> the header that lists it, from every cached faction record. */
export const useFactionParents = (): FactionParents => {
  const queryClient = useQueryClient();
  const [parents, setParents] = useState(() => collectParents(queryClient));

  useEffect(() => {
    // Anything that landed between the first render and this effect.
    setParents(collectParents(queryClient));
    return queryClient.getQueryCache().subscribe((event) => {
      // Only a header's record adds parents: 25 leaf cards landing must not
      // re-render the page 25 times.
      if (
        event.type === "updated" &&
        event.action.type === "success" &&
        isFactionKey(event.query.queryKey)
      ) {
        const record = event.query.state.data as Faction | null | undefined;
        if (record && record.children.length > 0) {
          setParents(collectParents(queryClient));
        }
      }
    });
  }, [queryClient]);

  return parents;
};

/**
 * The headers above `factionId`, outermost first ("Classic", "Horde"), as far
 * as they are known. Guarded against a cycle in the data.
 */
export const pathOf = (factionId: number, parents: FactionParents): FactionRef[] => {
  const path: FactionRef[] = [];
  const seen = new Set<number>([factionId]);
  let parent = parents.get(factionId);
  while (parent && !seen.has(parent.id)) {
    path.unshift(parent);
    seen.add(parent.id);
    parent = parents.get(parent.id);
  }
  return path;
};
