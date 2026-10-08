import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  creatureFamilyIndexQuery,
  creatureFamilyQuery,
} from "@/features/creatures/hooks/creatureQueries";
import type {
  CreatureFamily,
  CreatureFamilySummary,
  NamedRef,
} from "@/features/creatures/types";

/** One pet specialization's families, by name. */
export type PetFamilyGroup = {
  specialization: NamedRef;
  families: CreatureFamily[];
};

type FamilyDetails = {
  /** Every family loaded so far, in index order (by name). */
  families: CreatureFamily[];
  /** Some family records are still on their first load (or not started yet). */
  pending: boolean;
  /** Records with no data that have failed, including any being fetched again. */
  failed: Array<UseQueryResult<CreatureFamily>>;
  /** Some failed record is being fetched again (a Retry, or a remount). */
  retrying: boolean;
  /** The first failed record's error; null while every one is being retried. */
  error: Error | null;
};

/*
 * A refetch of a record that has no data puts it back to pending and clears
 * its error, so isPending alone cannot tell a first load from a Retry.
 * errorUpdateCount survives the refetch: a record that has failed before is
 * a failure being retried, not a first load, and stays in `failed` so its
 * banner (and the focused Retry button) stays put.
 *
 * Module scope, so react-query only re-runs it when a result changes.
 */
const combineFamilies = (results: UseQueryResult<CreatureFamily>[]): FamilyDetails => {
  const failed = results.filter(
    (result) => result.data === undefined && result.errorUpdateCount > 0,
  );
  return {
    families: results
      .map((result) => result.data)
      .filter((family): family is CreatureFamily => family !== undefined),
    pending: results.some((result) => result.isPending && result.errorUpdateCount === 0),
    failed,
    retrying: failed.some((result) => result.fetchStatus !== "idle"),
    error: failed.find((result) => result.isError)?.error ?? null,
  };
};

export type PetFamilyCatalog = FamilyDetails & {
  index: UseQueryResult<CreatureFamilySummary[]>;
  /** Hunter pet families by specialization, specs by name. */
  groups: PetFamilyGroup[];
  /** Families no hunter tames (other classes' minions), by name. */
  others: CreatureFamily[];
  /** The last error shown, kept while the failed records are retried. */
  shownError: Error | null;
  /** Refetches only the failed records that are not already being fetched. */
  retryFailed: () => void;
};

const EMPTY_INDEX: CreatureFamilySummary[] = [];

const groupBySpecialization = (
  families: CreatureFamily[],
): Pick<PetFamilyCatalog, "groups" | "others"> => {
  const bySpec = new Map<number, PetFamilyGroup>();
  const others: CreatureFamily[] = [];
  families.forEach((family) => {
    const spec = family.specialization;
    if (!spec) {
      others.push(family);
      return;
    }
    const group = bySpec.get(spec.id) ?? { specialization: spec, families: [] };
    group.families.push(family);
    bySpec.set(spec.id, group);
  });
  const groups = Array.from(bySpec.values()).sort((left, right) =>
    left.specialization.name.localeCompare(right.specialization.name),
  );
  return { groups, others };
};

/**
 * Every creature family with its hunter pet spec, grouped. Blizzard's index
 * has names only, so grouping needs each family's record: 84 small static
 * requests on US, six at a time (see creatureQueries), cached for a day.
 * `enabled` holds them back until the gallery nears the viewport, so a
 * visitor who only searches never pays for them.
 */
const usePetFamilyCatalog = (enabled: boolean): PetFamilyCatalog => {
  const index = useQuery(creatureFamilyIndexQuery());
  const summaries = index.data ?? EMPTY_INDEX;
  const details = useQueries({
    queries: summaries.map((summary) => ({
      ...creatureFamilyQuery(summary.id),
      enabled,
    })),
    combine: combineFamilies,
  });

  // A retried record has no error until it fails again, so the banner keeps
  // showing the last one meanwhile instead of a generic message.
  const [lastError, setLastError] = useState<Error | null>(null);
  if (details.error !== null && details.error !== lastError) {
    setLastError(details.error);
  }

  const { groups, others } = useMemo(
    () => groupBySpecialization(details.families),
    [details.families],
  );

  return {
    ...details,
    index,
    groups,
    others,
    shownError: details.error ?? lastError,
    // A record already being fetched again is left alone: refetch() would
    // cancel that attempt and start it over.
    retryFailed: () => {
      details.failed
        .filter((result) => result.fetchStatus === "idle")
        .forEach((result) => void result.refetch());
    },
  };
};

export default usePetFamilyCatalog;
