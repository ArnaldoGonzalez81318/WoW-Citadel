import { isCancelledError, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toyQuery } from "@/features/toys/hooks/toyQueries";
import { getToyEntry, useToyEntries } from "@/features/toys/services/toyRecordStore";
import type { ToyEntry } from "@/features/toys/services/toyRecordStore";
import { isAbortError } from "@/lib/errors";

/*
 * The source filter's reader. The toy index lists names only, so a source
 * filter has to read the listed toys' records. It reads them in the order
 * the page lists them (the search's ranking, A to Z or newest first), so
 * matches arrive in display order, and only as far as the page on screen
 * needs (one match more, to know whether another page follows); the next
 * page, or "check all", reads on. A record any card or an earlier visit
 * already read is skipped (see toyRecordStore).
 *
 * Three readers each start at most one request every 450 ms: about 400 a
 * minute at most, leaving the rest of the proxy's 600 a minute per visitor
 * for the cards' icons. The whole US index (1,135 toys) takes under three
 * minutes, once a day. A failure stops the scan where it is; Resume picks up
 * from there.
 */
const SCAN_READERS = 3;
const SCAN_CYCLE_MS = 450;

/** Records a minute at the readers' pace, for the page's time estimate. */
export const SCAN_RECORDS_PER_MINUTE = Math.floor((SCAN_READERS * 60_000) / SCAN_CYCLE_MS);

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isUnread = (toyId: number): boolean => getToyEntry(toyId) === undefined;

/**
 * Matches among the toys read so far, counted only up to the first unread
 * one: what the page can already show without reshuffling.
 */
const settledMatches = (
  ids: readonly number[],
  source: string,
  get: (toyId: number) => ToyEntry | undefined = getToyEntry,
): number => {
  let count = 0;
  for (const toyId of ids) {
    const entry = get(toyId);
    if (entry === undefined) {
      return count;
    }
    if (entry.record?.source?.type === source) {
      count += 1;
    }
  }
  return count;
};

/** A record that stopped loading without an error (a card's cancelled lookup) and would not come back. */
const STALLED = new Error("Some toy records stopped loading before they could be checked.");

export type ToySourceScanOptions = {
  /** The source being filtered for, or null (no filter: nothing to read). */
  source: string | null;
  /** Settled matches wanted before the readers rest (Infinity: read every listed toy). */
  target: number;
};

export type ToySourceScan = {
  /** Listed toys whose record has been read (or that Blizzard has no record for). */
  checked: number;
  total: number;
  /** Every listed toy has been read. */
  complete: boolean;
  /** Records are being read now. */
  running: boolean;
  /** Resting: the page has the matches it needs and more are only read on request. */
  paused: boolean;
  /**
   * Why the scan stopped short. It stays up through a Resume (so the
   * focused button stays put) until the next record lands or it fails again.
   */
  error: Error | null;
  /** Starts again from the first unread toy. */
  resume: () => void;
};

/**
 * What the readers last reported, and for which source: a switch to another
 * source renders once before the effect restarts them, and that render must
 * not show the previous source's failure (or its Resume) as this one's.
 */
type RunState = { source: string | null; running: boolean; error: Error | null };

const IDLE: RunState = { source: null, running: false, error: null };

const sameRun = (a: RunState, b: RunState): boolean =>
  a.source === b.source && a.running === b.running && a.error === b.error;

export const useToySourceScan = (
  ids: readonly number[],
  { source, target }: ToySourceScanOptions,
): ToySourceScan => {
  const queryClient = useQueryClient();
  const entries = useToyEntries();
  const [attempt, setAttempt] = useState(0);
  const [run, setRunState] = useState<RunState>(IDLE);
  const setRun = useCallback((next: RunState): void => {
    setRunState((current) => (sameRun(current, next) ? current : next));
  }, []);
  // The error a Resume is retrying, kept until that run reads a record. It
  // belongs to its source: picking another one while the resumed read is
  // slow must not start that source's scan as "stopped".
  const heldErrorRef = useRef<{ source: string; error: Error } | null>(null);

  useEffect(() => {
    if (source === null) {
      heldErrorRef.current = null;
      setRun(IDLE);
      return undefined;
    }
    const filterSource = source;
    // "Check all" has no target to reach: skip the count.
    const enough = (): boolean =>
      Number.isFinite(target) && settledMatches(ids, filterSource) >= target;
    const idle: RunState = { source: filterSource, running: false, error: null };
    if (!ids.some(isUnread) || enough()) {
      heldErrorRef.current = null;
      setRun(idle);
      return undefined;
    }
    const held = heldErrorRef.current?.source === filterSource ? heldErrorRef.current.error : null;
    if (held === null) {
      heldErrorRef.current = null;
    }
    let cancelled = false;
    let failure: Error | null = null;
    setRun({ source: filterSource, running: true, error: held });

    const readAll = async (pending: readonly number[]): Promise<void> => {
      let cursor = 0;
      const reader = async (): Promise<void> => {
        while (!cancelled && failure === null && cursor < pending.length && !enough()) {
          const toyId = pending[cursor];
          cursor += 1;
          // A card (or an earlier pass) may have read it meanwhile.
          if (!isUnread(toyId)) {
            continue;
          }
          const started = Date.now();
          try {
            await queryClient.fetchQuery(toyQuery(toyId));
            if (!cancelled && heldErrorRef.current !== null) {
              heldErrorRef.current = null;
              setRun({ source: filterSource, running: true, error: null });
            }
          } catch (error) {
            // A card scrolled away cancelled the lookup this reader shared:
            // the next pass reads it again. Anything else stops the scan.
            if (!isCancelledError(error) && !isAbortError(error)) {
              failure = error instanceof Error ? error : new Error(String(error));
              return;
            }
          }
          const wait = SCAN_CYCLE_MS - (Date.now() - started);
          if (wait > 0 && !cancelled) {
            await pause(wait);
          }
        }
      };
      await Promise.all(Array.from({ length: SCAN_READERS }, reader));
    };

    const scan = async (): Promise<void> => {
      let pending = ids.filter(isUnread);
      while (!cancelled && failure === null && pending.length > 0 && !enough()) {
        await readAll(pending);
        if (cancelled || failure !== null || enough()) {
          break;
        }
        const left = ids.filter(isUnread);
        // A pass that read nothing new would only spin.
        if (left.length >= pending.length) {
          failure = STALLED;
        }
        pending = left;
      }
      if (!cancelled) {
        heldErrorRef.current = null;
        setRun({ source: filterSource, running: false, error: failure });
      }
    };
    void scan();

    return () => {
      cancelled = true;
    };
  }, [source, ids, target, attempt, queryClient, setRun]);

  const active = source !== null;
  // Only what the readers said about this source counts (see RunState).
  const current = active && run.source === source ? run : IDLE;
  const error = current.error;
  const resume = useCallback((): void => {
    heldErrorRef.current = source !== null && error !== null ? { source, error } : null;
    setAttempt((count) => count + 1);
  }, [source, error]);

  const checked = useMemo(
    () => ids.reduce((count, toyId) => (entries.get(toyId) === undefined ? count : count + 1), 0),
    [ids, entries],
  );
  const enough = useMemo(
    () =>
      source !== null &&
      Number.isFinite(target) &&
      settledMatches(ids, source, entries.get) >= target,
    [ids, source, target, entries],
  );
  const complete = checked === ids.length;
  // Work left and nothing wrong counts as running from the render that asks
  // for it, not only once the effect has started the readers.
  const running = active && !complete && (current.running || (error === null && !enough));

  return {
    checked,
    total: ids.length,
    complete,
    running,
    paused: active && !complete && !running && error === null,
    error,
    resume,
  };
};

export default useToySourceScan;
