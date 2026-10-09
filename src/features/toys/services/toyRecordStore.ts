import { useSyncExternalStore } from "react";

import { env } from "@/lib/env";
import type { SourceLine, ToyRecord } from "@/features/toys/types";

/*
 * Every toy record the page has read, kept in this browser for a day.
 *
 * The toy index lists names only, so filtering by source means reading each
 * toy's record: 1,135 requests on US, paced to stay well inside the proxy's
 * 600 a minute (see useToySourceScan). Losing that work on every reload
 * would make the filter cost minutes each visit; kept here (localStorage, per
 * region and locale) the next visit filters at once. It is only a cache: the
 * page works the same with storage blocked, it just reads the records again.
 *
 * Records reach it through toyQuery's queryFn, whichever card, dialog or
 * scan asked for them, and seed that query's initial data in turn.
 */

export type ToyEntry = {
  /** Null: Blizzard has no record for that toy (a 404). */
  record: ToyRecord | null;
  fetchedAt: number;
};

/** Toy records change with patches; a day matches the page's stale time. */
export const TOY_RECORD_MAX_AGE_MS = 24 * 60 * 60_000;

const STORAGE_KEY = `wc:toy-records:v1:${env.region}:${env.locale}`;
/** Writes are batched: a scan lands several records a second. */
const SAVE_DELAY_MS = 2_000;

type StoredEntry = [id: number, fetchedAt: number, record: ToyRecord | null];

let entries: Map<number, ToyEntry> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const isSourceLine = (value: unknown): value is SourceLine => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const line = value as Partial<SourceLine>;
  return typeof line.value === "string" && (line.label === undefined || typeof line.label === "string");
};

/** Storage is the visitor's to edit: anything not shaped like a record is dropped. */
const isToyRecord = (value: unknown): value is ToyRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Partial<ToyRecord>;
  return (
    typeof record.id === "number" &&
    typeof record.name === "string" &&
    typeof record.itemId === "number" &&
    typeof record.excludeIfUncollected === "boolean" &&
    (record.source === undefined ||
      (typeof record.source === "object" &&
        record.source !== null &&
        typeof record.source.type === "string" &&
        typeof record.source.name === "string")) &&
    Array.isArray(record.sourceBlocks) &&
    record.sourceBlocks.every((block) => Array.isArray(block) && block.every(isSourceLine))
  );
};

const isFresh = (fetchedAt: number, now: number): boolean =>
  Number.isFinite(fetchedAt) && fetchedAt <= now && now - fetchedAt < TOY_RECORD_MAX_AGE_MS;

const readStorage = (): Map<number, ToyEntry> => {
  const map = new Map<number, ToyEntry>();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) {
      return map;
    }
    const now = Date.now();
    parsed.forEach((entry: unknown) => {
      if (!Array.isArray(entry) || entry.length !== 3) {
        return;
      }
      const [id, fetchedAt, record] = entry as unknown[];
      if (
        typeof id === "number" &&
        typeof fetchedAt === "number" &&
        isFresh(fetchedAt, now) &&
        (record === null || (isToyRecord(record) && record.id === id))
      ) {
        map.set(id, { record, fetchedAt });
      }
    });
  } catch {
    // Storage blocked or the value unreadable: start empty.
  }
  return map;
};

const load = (): Map<number, ToyEntry> => {
  if (entries === null) {
    entries = readStorage();
  }
  return entries;
};

const save = (): void => {
  saveTimer = null;
  const now = Date.now();
  const stored: StoredEntry[] = [];
  load().forEach((entry, id) => {
    if (isFresh(entry.fetchedAt, now)) {
      stored.push([id, entry.fetchedAt, entry.record]);
    }
  });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Quota or private mode: the records still live in memory.
  }
};

/** Leaving the page within the batching delay still saves what it read. */
const flushOnHide = (): void => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    save();
  }
};
let flushListening = false;

const scheduleSave = (): void => {
  if (saveTimer === null) {
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  }
  if (!flushListening) {
    flushListening = true;
    window.addEventListener("pagehide", flushOnHide);
  }
};

/**
 * The record read for a toy (null: Blizzard has none), or undefined when unread.
 *
 * Only storage drops records older than a day (on load and save). One already
 * in memory stays read: if it silently turned unread at its age, the next
 * unrelated record landing would put a toy back in front of the source filter
 * with no reader left to fetch it. An old record is still refreshed, by the
 * toy query's own day-long stale time refetching it on the next mount.
 */
export const getToyEntry = (toyId: number): ToyEntry | undefined => load().get(toyId);

export type ToyEntries = {
  /** `getToyEntry`, from a snapshot that is replaced whenever a record lands. */
  get: (toyId: number) => ToyEntry | undefined;
};

let snapshot: ToyEntries = { get: getToyEntry };

export const putToyEntry = (toyId: number, record: ToyRecord | null, fetchedAt = Date.now()): void => {
  load().set(toyId, { record, fetchedAt });
  snapshot = { get: getToyEntry };
  listeners.forEach((listener) => listener());
  scheduleSave();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ToyEntries => snapshot;

/**
 * The store as render-time state: a new object whenever a record lands, so
 * memos that read records through it recompute (and only then).
 */
export const useToyEntries = (): ToyEntries =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
