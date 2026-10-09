import { useMemo } from "react";

import useFamilyScan from "@/features/battlePets/hooks/useFamilyScan";
import type { FamilyScan } from "@/features/battlePets/hooks/useFamilyScan";
import { CATALOG_PAGE_SIZE } from "@/features/battlePets/services/battlePetService";
import type { CatalogKind, CatalogSort, IndexEntry } from "@/features/battlePets/types";
import { MIN_FUZZY_QUERY_LENGTH, rankByName } from "@/lib/fuzzyMatch";

export type CatalogListingOptions = {
  kind: CatalogKind;
  /** The index, or undefined while it loads. */
  entries: readonly IndexEntry[] | undefined;
  /** Trimmed. */
  search: string;
  sort: CatalogSort;
  familyId: number | null;
  /** 1-based, from the URL (it may be past the end until the page clamps it). */
  page: number;
};

export type CatalogListing = {
  /** After the name search and the sort, before the family filter. */
  ordered: IndexEntry[];
  /** A one-letter search: it would match nearly everything. */
  tooShort: boolean;
  /** How many entries the view lists, once that is known. */
  total: number | undefined;
  /** Matches known so far (the total once known). */
  found: number;
  /** The entries of `page`, as far as they are known. */
  pageEntries: IndexEntry[];
  pageCount: number;
  /** Cells of this page a family scan is still looking for. */
  pending: number;
  /** The family scan, when a family is picked. */
  scan: FamilyScan | null;
};

const EMPTY: IndexEntry[] = [];
const EMPTY_IDS: number[] = [];

const byName = (left: IndexEntry, right: IndexEntry): number =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) || left.id - right.id;

/** Ids grow with every patch, so the highest are the newest additions. */
const byNewest = (left: IndexEntry, right: IndexEntry): number => right.id - left.id;

/**
 * The page's list: the index searched by name (typos and half-typed words
 * included, best match first; a number also finds that id), sorted, then
 * filtered to one family and cut into pages of 24.
 *
 * The index has no families, so a family filter walks the list in order
 * fetching records (useFamilyScan) until the page on screen is full and one
 * more match says whether another page follows. Until the walk reaches the
 * end of the list the total is unknown: the pages offered are the ones
 * found so far, plus the one being looked for.
 */
const useCatalogListing = ({
  kind,
  entries,
  search,
  sort,
  familyId,
  page,
}: CatalogListingOptions): CatalogListing => {
  const all = entries ?? EMPTY;
  const idMatch = useMemo(
    () => (/^\d+$/.test(search) ? all.find((entry) => String(entry.id) === search) : undefined),
    [all, search],
  );
  const tooShort = search !== "" && search.length < MIN_FUZZY_QUERY_LENGTH && !idMatch;

  const ordered = useMemo(() => {
    if (search === "") {
      return [...all].sort(sort === "name" ? byName : byNewest);
    }
    if (tooShort) {
      return EMPTY;
    }
    const ranked = rankByName(all, search, (entry) => entry.name, all.length);
    const matches = idMatch ? [idMatch, ...ranked.filter((entry) => entry !== idMatch)] : ranked;
    if (sort === "match") {
      return matches;
    }
    return [...matches].sort(sort === "name" ? byName : byNewest);
  }, [all, search, sort, tooShort, idMatch]);

  const byId = useMemo(() => new Map(ordered.map((entry) => [entry.id, entry])), [ordered]);
  const ids = useMemo(
    () => (familyId === null ? EMPTY_IDS : ordered.map((entry) => entry.id)),
    [ordered, familyId],
  );

  const scan = useFamilyScan({
    kind,
    ids,
    familyId,
    wanted: page * CATALOG_PAGE_SIZE + 1,
    enabled: familyId !== null && entries !== undefined,
  });

  const start = (page - 1) * CATALOG_PAGE_SIZE;

  if (familyId === null) {
    return {
      ordered,
      tooShort,
      total: entries === undefined ? undefined : ordered.length,
      found: ordered.length,
      pageEntries: ordered.slice(start, start + CATALOG_PAGE_SIZE),
      pageCount: Math.max(1, Math.ceil(ordered.length / CATALOG_PAGE_SIZE)),
      pending: 0,
      scan: null,
    };
  }

  const found = scan.matches.length;
  const knownPages = Math.ceil(found / CATALOG_PAGE_SIZE);
  const pageEntries = scan.matches
    .slice(start, start + CATALOG_PAGE_SIZE)
    .map((id) => byId.get(id))
    .filter((entry): entry is IndexEntry => entry !== undefined);
  const complete = entries !== undefined && scan.complete;
  return {
    ordered,
    tooShort,
    total: complete ? found : undefined,
    found,
    pageEntries,
    pageCount: complete ? Math.max(1, knownPages) : Math.max(page, knownPages),
    pending:
      complete || scan.error !== null ? 0 : Math.max(0, CATALOG_PAGE_SIZE - pageEntries.length),
    scan,
  };
};

export default useCatalogListing;
