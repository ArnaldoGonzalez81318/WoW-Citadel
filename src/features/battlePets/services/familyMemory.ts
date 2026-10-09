import { useSyncExternalStore } from "react";

import type { CatalogKind } from "@/features/battlePets/types";
import { env } from "@/lib/env";

/*
 * Blizzard's pet and ability indexes list names only, so a pet's family is
 * known once its record has been fetched, and filtering 2,179 pets by family
 * means fetching records. Every record the page sees (a card, the dialog,
 * a family scan) leaves its family here, and the map is kept in this
 * browser for a day: a family filter that took a minute the first time is
 * instant on the next visit, and costs no requests at all.
 *
 * Family ids are not localized, so that map is per region; the family names
 * learned from records are per locale. Storage can be missing or full (a
 * private window): the page then works from memory alone.
 */

/** Static game data: a day, like the records' own HTTP cache. */
const MAX_AGE_MS = 24 * 60 * 60_000;
const STORAGE_PREFIX = "wowcitadel:battle-pets:v1";
/** A burst of records re-renders the page a few times a second, not per record. */
const NOTIFY_DELAY_MS = 150;
const SAVE_DELAY_MS = 1_000;

/** A record Blizzard has no family for (or no record at all): never matches a filter. */
export const NO_FAMILY = -1;

type Persisted<V> = {
  savedAt: number;
  entries: Record<string, V>;
};

type Memory<V> = {
  key: string;
  /** When the stored map was started; all of it expires a day later. */
  startedAt: number;
  entries: Map<number, V>;
  version: number;
  /** The version subscribers last heard about (snapshots read this one). */
  published: number;
  listeners: Set<() => void>;
  notifyTimer: number | null;
  saveTimer: number | null;
};

/** When each stored map was started, as read back from storage. */
const startedAtByKey = new Map<string, number>();

const readStorage = <V>(
  key: string,
  isValue: (value: unknown) => value is V,
): Map<number, V> | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Persisted<unknown>> | null;
    const savedAt = parsed?.savedAt;
    const now = Date.now();
    if (
      typeof savedAt !== "number" ||
      savedAt > now ||
      now - savedAt >= MAX_AGE_MS ||
      typeof parsed?.entries !== "object" ||
      parsed.entries === null
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    const entries = new Map<number, V>();
    Object.entries(parsed.entries).forEach(([id, value]) => {
      const numericId = Number(id);
      if (Number.isInteger(numericId) && isValue(value)) {
        entries.set(numericId, value);
      }
    });
    // The day runs from the first record stored, not from the last save.
    startedAtByKey.set(key, savedAt);
    return entries;
  } catch {
    return null;
  }
};

const createMemory = <V>(key: string, isValue: (value: unknown) => value is V): Memory<V> => {
  const entries = readStorage(key, isValue) ?? new Map<number, V>();
  return {
    key,
    startedAt: startedAtByKey.get(key) ?? Date.now(),
    entries,
    version: 0,
    published: 0,
    listeners: new Set(),
    notifyTimer: null,
    saveTimer: null,
  };
};

const save = <V>(memory: Memory<V>): void => {
  const entries: Record<string, V> = {};
  memory.entries.forEach((value, id) => {
    entries[id] = value;
  });
  try {
    window.localStorage.setItem(
      memory.key,
      JSON.stringify({ savedAt: memory.startedAt, entries } satisfies Persisted<V>),
    );
  } catch {
    // Full or blocked storage: the map still works for this visit.
  }
};

const setEntry = <V>(memory: Memory<V>, id: number, value: V): void => {
  if (memory.entries.get(id) === value) {
    return;
  }
  memory.entries.set(id, value);
  memory.version += 1;
  if (memory.notifyTimer === null) {
    memory.notifyTimer = window.setTimeout(() => {
      memory.notifyTimer = null;
      memory.published = memory.version;
      memory.listeners.forEach((listener) => listener());
    }, NOTIFY_DELAY_MS);
  }
  if (memory.saveTimer === null) {
    memory.saveTimer = window.setTimeout(() => {
      memory.saveTimer = null;
      save(memory);
    }, SAVE_DELAY_MS);
  }
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const familyMemories = new Map<string, Memory<number>>();
const nameMemories = new Map<string, Memory<string>>();

const familyMemory = (kind: CatalogKind): Memory<number> => {
  const key = `${STORAGE_PREFIX}:families:${kind}:${env.region}`;
  let memory = familyMemories.get(key);
  if (!memory) {
    memory = createMemory(key, isNumber);
    familyMemories.set(key, memory);
  }
  return memory;
};

const nameMemory = (): Memory<string> => {
  const key = `${STORAGE_PREFIX}:family-names:${env.region}:${env.locale}`;
  let memory = nameMemories.get(key);
  if (!memory) {
    memory = createMemory(key, isText);
    nameMemories.set(key, memory);
  }
  return memory;
};

/*
 * useSyncExternalStore resubscribes whenever `subscribe` changes identity,
 * so each memory keeps one subscribe function.
 */
const subscribers = new WeakMap<object, (listener: () => void) => () => void>();
const subscribeTo = <V>(memory: Memory<V>): ((listener: () => void) => () => void) => {
  let subscribe = subscribers.get(memory);
  if (!subscribe) {
    subscribe = (listener) => {
      memory.listeners.add(listener);
      return () => {
        memory.listeners.delete(listener);
      };
    };
    subscribers.set(memory, subscribe);
  }
  return subscribe;
};

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

/** Every pet's (or ability's) family seen so far: id -> family id, or NO_FAMILY. */
export const knownFamilies = (kind: CatalogKind): ReadonlyMap<number, number> =>
  familyMemory(kind).entries;

export const rememberFamily = (
  kind: CatalogKind,
  id: number,
  familyId: number | undefined,
): void => {
  setEntry(familyMemory(kind), id, familyId ?? NO_FAMILY);
};

/**
 * The live map and a version that changes (at most a few times a second)
 * whenever it grows: memos that read the map list the version as a dependency.
 */
export const useKnownFamilies = (
  kind: CatalogKind,
): { families: ReadonlyMap<number, number>; version: number } => {
  const memory = familyMemory(kind);
  const version = useSyncExternalStore(subscribeTo(memory), () => memory.published);
  return { families: memory.entries, version };
};

/* ------------------------------------------------------------------ */
/* Family names                                                        */
/* ------------------------------------------------------------------ */

/** A family's name as a record spelled it, in the visitor's locale. */
export const rememberFamilyName = (familyId: number, name: string): void => {
  if (name.length > 0) {
    setEntry(nameMemory(), familyId, name);
  }
};

let namesSnapshot: { memory: Memory<string>; version: number; names: ReadonlyMap<number, string> } | null =
  null;

/** Family id -> its name from Blizzard's records, for the families seen so far. */
export const useLearnedFamilyNames = (): ReadonlyMap<number, string> => {
  const memory = nameMemory();
  const version = useSyncExternalStore(subscribeTo(memory), () => memory.published);
  if (!namesSnapshot || namesSnapshot.memory !== memory || namesSnapshot.version !== version) {
    namesSnapshot = { memory, version, names: new Map(memory.entries) };
  }
  return namesSnapshot.names;
};
