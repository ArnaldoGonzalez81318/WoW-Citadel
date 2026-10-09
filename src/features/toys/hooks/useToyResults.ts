import { useMemo } from "react";

import useToySourceScan from "@/features/toys/hooks/useToySourceScan";
import type { ToySourceScan } from "@/features/toys/hooks/useToySourceScan";
import { useToyEntries } from "@/features/toys/services/toyRecordStore";
import type { ToyEntries } from "@/features/toys/services/toyRecordStore";
import {
  TOY_SOURCE_TYPES,
  compareNewest,
  compareToyNames,
} from "@/features/toys/services/toyService";
import type { ToyRef, ToySort, ToySourceOption } from "@/features/toys/types";
import { humanizeEnum } from "@/lib/format";
import { rankByName } from "@/lib/fuzzyMatch";

const EMPTY: ToyRef[] = [];

const nameOf = (toy: ToyRef): string => toy.name;

type SourceCatalog = {
  options: ToySourceOption[];
  /** Every toy in the index has been read, so the counts are final. */
  allChecked: boolean;
};

/**
 * The filter's sources: the known codes plus any a record brought, each
 * under Blizzard's localized name once a record has carried it. Counts
 * only appear once every toy has been read (a partial count would mislead),
 * and a code no toy turned out to use is dropped then (unless selected, so
 * its empty list can say so).
 */
const buildSourceCatalog = (
  index: readonly ToyRef[],
  entries: ToyEntries,
  selected: string | null,
): SourceCatalog => {
  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  let checked = 0;
  index.forEach((toy) => {
    const entry = entries.get(toy.id);
    if (entry === undefined) {
      return;
    }
    checked += 1;
    const source = entry.record?.source;
    if (source) {
      if (!names.has(source.type)) {
        names.set(source.type, source.name);
      }
      counts.set(source.type, (counts.get(source.type) ?? 0) + 1);
    }
  });
  const allChecked = index.length > 0 && checked === index.length;
  const known = new Set(TOY_SOURCE_TYPES.map((source) => source.type));
  const extra = [...names.keys()]
    .filter((type) => !known.has(type))
    .map((type) => ({ type, name: humanizeEnum(type) }));
  const options = [...TOY_SOURCE_TYPES, ...extra]
    .map((source) => ({
      type: source.type,
      name: names.get(source.type) ?? source.name,
      count: allChecked ? (counts.get(source.type) ?? 0) : undefined,
    }))
    .filter((option) => !allChecked || (option.count ?? 0) > 0 || option.type === selected);
  return { options, allChecked };
};

export type ToyResults = {
  sourceOptions: ToySourceOption[];
  allChecked: boolean;
  /** The requested source when the filter offers it, else null. */
  source: string | null;
  /** Every toy the search and sort list, before the source filter. */
  candidates: ToyRef[];
  /**
   * The listed toys with the source, in list order, as far as every record
   * before them has been read: a match further down only shows once the
   * scan reaches it, so a page never reshuffles under the visitor.
   */
  matches: ToyRef[];
  /** No unread record is holding matches back (always true without a source). */
  settled: boolean;
  scan: ToySourceScan;
};

export type ToyResultsCriteria = {
  index: ToyRef[] | undefined;
  /** Trimmed; long enough to rank (the page checks). */
  search: string;
  sort: ToySort;
  requestedSource: string | null;
  /** Matches the source scan reads up to (see useToySourceScan). */
  scanTarget: number;
};

/**
 * The toy box's list: the index searched (ranked locally, typos and
 * half-typed words included) or sorted, then filtered by source as the
 * scan reads each listed toy's record.
 */
const useToyResults = ({
  index,
  search,
  sort,
  requestedSource,
  scanTarget,
}: ToyResultsCriteria): ToyResults => {
  const entries = useToyEntries();
  const toys = index ?? EMPTY;

  const catalog = useMemo(
    () => buildSourceCatalog(toys, entries, requestedSource),
    [toys, entries, requestedSource],
  );
  const source =
    requestedSource !== null && catalog.options.some((option) => option.type === requestedSource)
      ? requestedSource
      : null;

  const candidates = useMemo(() => {
    if (search !== "") {
      const ranked = rankByName(toys, search, nameOf, toys.length);
      if (sort === "match") {
        return ranked;
      }
      return [...ranked].sort(sort === "name" ? compareToyNames : compareNewest);
    }
    return [...toys].sort(sort === "name" ? compareToyNames : compareNewest);
  }, [toys, search, sort]);
  const candidateIds = useMemo(() => candidates.map((toy) => toy.id), [candidates]);

  const scan = useToySourceScan(candidateIds, { source, target: scanTarget });

  const filtered = useMemo(() => {
    if (source === null) {
      return { matches: candidates, settled: true };
    }
    const matches: ToyRef[] = [];
    for (const toy of candidates) {
      const entry = entries.get(toy.id);
      if (entry === undefined) {
        return { matches, settled: false };
      }
      if (entry.record?.source?.type === source) {
        matches.push(toy);
      }
    }
    return { matches, settled: true };
  }, [candidates, source, entries]);

  return {
    sourceOptions: catalog.options,
    allChecked: catalog.allChecked,
    source,
    candidates,
    matches: filtered.matches,
    settled: filtered.settled,
    scan,
  };
};

export default useToyResults;
