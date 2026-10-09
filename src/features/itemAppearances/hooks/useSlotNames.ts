import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { appearanceKeys } from "@/features/itemAppearances/hooks/appearanceQueries";
import type { Appearance, AppearancePage } from "@/features/itemAppearances/types";

/*
 * Blizzard names a slot only inside a search hit or an appearance record
 * (see slots.ts), so the menu learns its localized names from what the page
 * already holds: every search page and appearance record in the cache.
 */

export type SlotNames = ReadonlyMap<string, string>;

const startsWith = (key: QueryKey, prefix: readonly string[]): boolean =>
  prefix.every((part, index) => key[index] === part);

const collectNames = (queryClient: QueryClient): Map<string, string> => {
  const names = new Map<string, string>();
  queryClient
    .getQueriesData<AppearancePage>({ queryKey: appearanceKeys.searches() })
    .forEach(([, page]) => {
      page?.hits.forEach((hit) => {
        if (hit.slot?.name) {
          names.set(hit.slot.type, hit.slot.name);
        }
      });
    });
  queryClient
    .getQueriesData<Appearance | null>({ queryKey: appearanceKeys.appearances() })
    .forEach(([, record]) => {
      if (record?.slot?.name) {
        names.set(record.slot.type, record.slot.name);
      }
    });
  return names;
};

const sameNames = (
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean =>
  left.size === right.size &&
  [...left].every(([type, name]) => right.get(type) === name);

/** Slot type -> its localized name, for every slot the page has seen named. */
const useSlotNames = (): SlotNames => {
  const queryClient = useQueryClient();
  const [names, setNames] = useState<Map<string, string>>(() => collectNames(queryClient));

  useEffect(() => {
    // Keeps the old map when nothing new was learned, so 24 cards landing
    // do not re-render the page 24 times.
    const refresh = (): void => {
      const next = collectNames(queryClient);
      setNames((previous) => (sameNames(previous, next) ? previous : next));
    };
    // Anything that landed between the first render and this effect.
    refresh();
    return queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "success" &&
        (startsWith(event.query.queryKey, appearanceKeys.searches()) ||
          startsWith(event.query.queryKey, appearanceKeys.appearances()))
      ) {
        refresh();
      }
    });
  }, [queryClient]);

  return names;
};

export default useSlotNames;
