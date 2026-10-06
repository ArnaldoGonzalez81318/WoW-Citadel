import { useEffect, useMemo, useRef, useState } from "react";

import {
  isStale,
  readCachedSource,
  writeCachedSource,
} from "@/features/search/catalog/catalogCache";
import type {
  CatalogEntry,
  CatalogSource,
} from "@/features/search/catalog/catalogSources";
import { CATALOG_SOURCES } from "@/features/search/catalog/catalogSources";

export type CatalogIndexState = {
  entries: CatalogEntry[];
  /**
   * Every planned source has settled — from cache, from the network, or by
   * failing. Until then an empty `entries` means "still loading", not
   * "nothing to suggest".
   */
  ready: boolean;
  loadedSourceIds: string[];
};

type SourceResult = {
  id: string;
  entries: CatalogEntry[];
};

type CatalogPlan = {
  /** Served straight from localStorage, before any network. */
  seeded: readonly SourceResult[];
  /** Missing or past its TTL, to fetch in priority order. */
  pending: readonly CatalogSource[];
};

const EMPTY_STATE: CatalogIndexState = {
  entries: [],
  ready: false,
  loadedSourceIds: [],
};

/** Priority at which a source is "the long tail" and a metered link skips it. */
const LOW_PRIORITY = 2;

const IDLE_TIMEOUT_MS = 2_000;
const FALLBACK_DELAY_MS = 300;

/* ------------------------------------------------------------------ */
/* Connection                                                          */
/* ------------------------------------------------------------------ */

/** `navigator.connection` is not in lib.dom; only the two fields we honour. */
type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

const SLOW_EFFECTIVE_TYPES: ReadonlySet<string> = new Set(["2g", "slow-2g"]);

const isMeteredConnection = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }

  const { connection } = navigator as Navigator & {
    connection?: NetworkInformationLike;
  };
  if (typeof connection !== "object" || connection === null) {
    return false;
  }

  return (
    connection.saveData === true ||
    (typeof connection.effectiveType === "string" &&
      SLOW_EFFECTIVE_TYPES.has(connection.effectiveType))
  );
};

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

/**
 * Runs `task` when the browser is otherwise idle, so a megabyte of catalogue
 * never competes with the search the person is actually running. Returns its
 * canceller.
 */
const scheduleIdle = (task: () => void): (() => void) => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(task, {
      timeout: IDLE_TIMEOUT_MS,
    });
    return () => {
      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(handle);
      }
    };
  }

  const handle = setTimeout(task, FALLBACK_DELAY_MS);
  return () => clearTimeout(handle);
};

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

const buildPlan = (now: number): CatalogPlan => {
  const metered = isMeteredConnection();
  const seeded: SourceResult[] = [];
  const pending: CatalogSource[] = [];

  [...CATALOG_SOURCES]
    .sort((left, right) => left.priority - right.priority)
    .forEach((source) => {
      const cached = readCachedSource(source.id);
      if (cached) {
        seeded.push({ id: source.id, entries: cached.entries });
      }

      // Honour a metered connection by skipping the long tail's download; a
      // cached copy still serves, however stale.
      if (metered && source.priority >= LOW_PRIORITY) {
        return;
      }

      // Stale-while-revalidate: the cached entries above are already being
      // served, this only queues the refresh behind them.
      if (!cached || isStale(cached, now)) {
        pending.push(source);
      }
    });

  return { seeded, pending };
};

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

/**
 * The local name catalogue behind instant suggestions.
 *
 * Pass `enabled` true once the person has engaged the search box; the hook
 * then seeds itself from localStorage and refreshes missing or stale sources
 * in the background. It never throws and never logs: a source that fails is
 * simply absent from `entries`.
 */
export const useCatalogIndex = (enabled: boolean): CatalogIndexState => {
  const planRef = useRef<CatalogPlan | undefined>(undefined);
  // Built during render rather than in an effect so a returning visitor's
  // cached names are in hand for the very first keystroke, with neither a
  // commit nor a request in between.
  if (enabled && planRef.current === undefined) {
    planRef.current = buildPlan(Date.now());
  }
  const plan = enabled ? planRef.current : undefined;

  const [fetched, setFetched] = useState<readonly SourceResult[]>([]);
  const [settled, setSettled] = useState(false);
  /** How far through `plan.pending` the background walk has got. */
  const cursorRef = useRef(0);

  useEffect(() => {
    const current = planRef.current;
    if (!enabled || !current || current.pending.length === 0) {
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    let cancelScheduled: (() => void) | undefined;

    const runNext = (): void => {
      if (cancelled) {
        return;
      }

      if (cursorRef.current >= current.pending.length) {
        setSettled(true);
        return;
      }

      const source = current.pending[cursorRef.current];

      void source
        .fetchEntries(controller.signal)
        .then((entries) => {
          if (cancelled || entries.length === 0) {
            return;
          }
          writeCachedSource(source.id, entries);
          // One state update per source: appending name by name would
          // re-render the header six thousand times.
          setFetched((results) => [
            ...results.filter((result) => result.id !== source.id),
            { id: source.id, entries },
          ]);
        })
        .catch(() => {
          // A failed source is simply absent; suggestions degrade, and a
          // console message here would fire on every cancelled navigation.
        })
        .finally(() => {
          // Left where it is on unmount so a remount retries the source it
          // cut short rather than skipping it.
          if (cancelled) {
            return;
          }
          cursorRef.current += 1;
          cancelScheduled = scheduleIdle(runNext);
        });
    };

    // One source at a time, each waiting for idle time of its own.
    cancelScheduled = scheduleIdle(runNext);

    return () => {
      cancelled = true;
      cancelScheduled?.();
      controller.abort();
    };
  }, [enabled]);

  return useMemo<CatalogIndexState>(() => {
    if (!plan) {
      return EMPTY_STATE;
    }

    // A refreshed source replaces the copy seeded from cache.
    const byId = new Map<string, CatalogEntry[]>();
    plan.seeded.forEach((result) => byId.set(result.id, result.entries));
    fetched.forEach((result) => byId.set(result.id, result.entries));

    // Declaration order, so the entry list is stable no matter which source
    // happened to land first.
    const loadedSourceIds = CATALOG_SOURCES.filter((source) =>
      byId.has(source.id),
    ).map((source) => source.id);

    return {
      entries: loadedSourceIds.flatMap((id) => byId.get(id) ?? []),
      ready: settled || plan.pending.length === 0,
      loadedSourceIds,
    };
  }, [fetched, plan, settled]);
};

export default useCatalogIndex;
