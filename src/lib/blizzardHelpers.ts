import { BlizzardRequestError } from "@/lib/blizzardClient";
import { env } from "@/lib/env";

/**
 * Blizzard returns names/descriptions either as a plain string (when a
 * `locale` is requested) or as a map of every locale (search endpoints).
 */
export type LocalizedString =
  | string
  | { [locale: string]: string | undefined };

const isNonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Resolves a localized value: string passthrough, then the configured
 * locale, then `en_US`, then the first non-empty translation, else "".
 */
export const localized = (
  value: LocalizedString | null | undefined,
  locale: string = env.locale,
): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  const preferred = value[locale];
  if (isNonEmpty(preferred)) {
    return preferred;
  }

  const english = value.en_US;
  if (isNonEmpty(english)) {
    return english;
  }

  for (const entry of Object.values(value)) {
    if (isNonEmpty(entry)) {
      return entry;
    }
  }

  return "";
};

/**
 * Strips WoW's inline markup from descriptions: colour codes (`|cAARRGGBB`
 * ... `|r`), line breaks (`|n`), texture tags (`|T...|t`) and hyperlinks
 * (`|H...|h[text]|h` keeps the text).
 */
export const cleanMarkup = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value
    .replace(/\|H[^|]*\|h(.*?)\|h/g, "$1")
    .replace(/\|T[^|]*\|t/g, "")
    .replace(/\|c[0-9A-Fa-f]{8}/g, "")
    .replace(/\|r/g, "")
    .replace(/\|n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export type NamespaceKind = "static" | "dynamic" | "profile";

/** `static-us`, `dynamic-eu`, ... for the configured region. */
export const namespace = (kind: NamespaceKind): string =>
  `${kind}-${env.region}`;

/**
 * Search endpoints filter on `name.<locale>`; this builds that query
 * parameter for the configured locale.
 */
export const nameParam = (
  value: string,
  locale: string = env.locale,
): Record<string, string> => ({
  [`name.${locale}`]: value.trim(),
});

/**
 * Runs `fn` and maps a not-found answer (404, or 204 no-content) to
 * `undefined`; every other error propagates.
 */
export const optional404 = async <T>(
  fn: () => Promise<T>,
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BlizzardRequestError && error.isNotFound) {
      return undefined;
    }
    throw error;
  }
};

const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("The operation was aborted", "AbortError");
  }
};

/**
 * Maps `items` through `fn` with at most `limit` calls in flight, in input
 * order, collecting settled results so one failure never sinks the batch.
 * Aborting `signal` stops scheduling new calls and rejects with the abort
 * reason so react-query can cancel silently.
 */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<R>[]> => {
  throwIfAborted(signal);

  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    while (cursor < items.length) {
      throwIfAborted(signal);
      const index = cursor;
      cursor += 1;

      try {
        results[index] = { status: "fulfilled", value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(Array.from({ length: workers }, runWorker));
  throwIfAborted(signal);

  return results;
};

export const isFulfilled = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => result.status === "fulfilled";

/** Values of the fulfilled entries, in order. */
export const fulfilledValues = <T>(
  results: readonly PromiseSettledResult<T>[],
): T[] => results.filter(isFulfilled).map((result) => result.value);

/**
 * `Promise.allSettled` that resolves with only the fulfilled values, in
 * order. Rejections are dropped (per-card enrichment must never gate a grid).
 */
export const settle = async <T>(
  promises: Iterable<T | PromiseLike<T>>,
): Promise<T[]> => fulfilledValues(await Promise.allSettled(promises));

/** Locale-aware `name` sort shared by the explorers. */
export const sortByName = <T extends { name: string }>(items: readonly T[]): T[] =>
  [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
