import type {
  CatalogEntry,
  CatalogKind,
} from "@/features/search/catalog/catalogSources";
import { env } from "@/lib/env";

/**
 * localStorage copy of the suggestion catalogue, so a returning visitor has
 * suggestions on their very first keystroke without waiting for the network.
 *
 * Every access is wrapped: `localStorage` throws on the first read in some
 * private-mode browsers and on every write once the origin's quota is full.
 */

/** Bump to invalidate every cached source (a shape or a source-id change). */
export const CATALOG_CACHE_VERSION = 1;

/** Names and the collections themselves move with a game patch, not an hour. */
export const CATALOG_TTL_MS = 7 * 24 * 60 * 60_000;

export type CachedSource = {
  version: number;
  region: string;
  locale: string;
  fetchedAt: number;
  entries: CatalogEntry[];
};

const KEY_PREFIX = "wc:catalog:";

/**
 * Region and locale are part of the key, not just the payload: names are
 * localized, so an `en_US` catalogue is worthless to a `de_DE` session and the
 * two must be able to coexist.
 */
const cacheKey = (sourceId: string): string =>
  `${KEY_PREFIX}v${CATALOG_CACHE_VERSION}:${env.region}:${env.locale}:${sourceId}`;

/**
 * Stored as `[id, name]` pairs with the kind recorded once. The five sources
 * are roughly 6,200 names; an array of `{ id, name, kind }` objects spends
 * about half its bytes repeating those three keys.
 */
type StoredSource = {
  v: number;
  r: string;
  l: string;
  /** `fetchedAt`. */
  t: number;
  k: CatalogKind;
  e: Array<[number, string]>;
};

const KINDS: readonly CatalogKind[] = ["item", "mount", "toy", "pet"];

const isKind = (value: unknown): value is CatalogKind =>
  typeof value === "string" && KINDS.includes(value as CatalogKind);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Anything read back from storage is untrusted — another tab, an older build
 * or a hand-edited value can put any shape under this key — so the payload is
 * validated field by field and a single surprise discards the whole entry.
 */
const decode = (raw: string): CachedSource | undefined => {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }

  const stored = parsed as Partial<StoredSource>;
  if (
    stored.v !== CATALOG_CACHE_VERSION ||
    stored.r !== env.region ||
    stored.l !== env.locale ||
    !isFiniteNumber(stored.t) ||
    !isKind(stored.k) ||
    !Array.isArray(stored.e)
  ) {
    return undefined;
  }

  const kind = stored.k;
  const entries: CatalogEntry[] = [];
  for (const pair of stored.e) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return undefined;
    }
    const [id, name] = pair as [unknown, unknown];
    if (!isFiniteNumber(id) || typeof name !== "string") {
      return undefined;
    }
    if (name.length > 0) {
      entries.push({ id, name, kind });
    }
  }

  if (entries.length === 0) {
    return undefined;
  }

  return {
    version: stored.v,
    region: stored.r,
    locale: stored.l,
    fetchedAt: stored.t,
    entries,
  };
};

const encode = (kind: CatalogKind, entries: readonly CatalogEntry[]): string =>
  JSON.stringify({
    v: CATALOG_CACHE_VERSION,
    r: env.region,
    l: env.locale,
    t: Date.now(),
    k: kind,
    e: entries.map((entry) => [entry.id, entry.name]),
  } satisfies StoredSource);

/** A cached source for this version, region and locale, or nothing usable. */
export const readCachedSource = (sourceId: string): CachedSource | undefined => {
  try {
    const raw = window.localStorage.getItem(cacheKey(sourceId));
    return raw ? decode(raw) : undefined;
  } catch {
    return undefined;
  }
};

const isQuotaExceeded = (error: unknown): boolean => {
  if (typeof DOMException === "undefined" || !(error instanceof DOMException)) {
    return false;
  }
  return (
    error.name === "QuotaExceededError" ||
    // Firefox's legacy name, and the pre-DOMException code both still ship.
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22
  );
};

/**
 * Persists one source. Failure is silent by design: the in-memory index is
 * already serving suggestions, so a full or unavailable store costs nothing
 * beyond a refetch next visit.
 */
export const writeCachedSource = (
  sourceId: string,
  entries: CatalogEntry[],
): void => {
  const [first] = entries;
  if (first === undefined) {
    // No kind to record, and an empty catalogue is not worth a key.
    return;
  }

  const key = cacheKey(sourceId);
  let payload: string;
  try {
    payload = encode(first.kind, entries);
  } catch {
    return;
  }

  try {
    window.localStorage.setItem(key, payload);
  } catch (error) {
    if (!isQuotaExceeded(error)) {
      return;
    }

    // The catalogue is the largest thing this app stores. Dropping the other
    // sources — all of them refetchable — buys room for this one instead of
    // losing every suggestion to whichever source happened to overflow.
    clearCatalogCache();
    try {
      window.localStorage.setItem(key, payload);
    } catch {
      // Still no room: give up, keep the session's in-memory copy.
    }
  }
};

/** Drops every cached source, including older versions, regions and locales. */
export const clearCatalogCache = (): void => {
  try {
    const storage = window.localStorage;
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null && key.startsWith(KEY_PREFIX)) {
        doomed.push(key);
      }
    }
    // Collected first: removing during the walk shifts the indices under it.
    doomed.forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing to clear if the store cannot be read.
  }
};

/**
 * `now` is a parameter rather than a `Date.now()` call so the rule stays pure
 * and testable. A `fetchedAt` in the future (a clock that moved backwards)
 * counts as stale rather than valid for the next seven days.
 */
export const isStale = (cached: CachedSource, now: number): boolean =>
  now < cached.fetchedAt || now - cached.fetchedAt >= CATALOG_TTL_MS;
