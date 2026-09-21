import { useCallback, useEffect, useState } from "react";

export const RECENT_SEARCHES_KEY = "wc:recent-searches";
export const MAX_RECENT_SEARCHES = 8;

export interface RecentSearches {
  /** Newest first. */
  recent: string[];
  push: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

const sameTerm = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase();

const sanitize = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }
    const term = entry.trim();
    if (term && !seen.some((existing) => sameTerm(existing, term))) {
      seen.push(term);
    }
  });
  return seen.slice(0, MAX_RECENT_SEARCHES);
};

const readStorage = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? sanitize(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
};

const writeStorage = (terms: string[]): void => {
  try {
    if (terms.length === 0) {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    } else {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(terms));
    }
  } catch {
    // Storage may be unavailable (private mode, quota); the in-memory list still works.
  }
};

const sameList = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((term, index) => term === right[index]);

/**
 * The last few submitted search terms, persisted in localStorage and kept
 * in sync across the header, the home hero and the search page (and across
 * tabs via the `storage` event).
 */
export const useRecentSearches = (): RecentSearches => {
  const [recent, setRecent] = useState<string[]>(readStorage);

  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== null && event.key !== RECENT_SEARCHES_KEY) {
        return;
      }
      const next = readStorage();
      setRecent((current) => (sameList(current, next) ? current : next));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const update = useCallback((updater: (current: string[]) => string[]) => {
    setRecent((current) => {
      const next = sanitize(updater(current));
      if (sameList(current, next)) {
        return current;
      }
      writeStorage(next);
      return next;
    });
  }, []);

  const push = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) {
        return;
      }
      update((current) => [
        trimmed,
        ...current.filter((existing) => !sameTerm(existing, trimmed)),
      ]);
    },
    [update],
  );

  const remove = useCallback(
    (term: string) => {
      update((current) =>
        current.filter((existing) => !sameTerm(existing, term)),
      );
    },
    [update],
  );

  const clear = useCallback(() => {
    update(() => []);
  }, [update]);

  return { recent, push, remove, clear };
};

export default useRecentSearches;
