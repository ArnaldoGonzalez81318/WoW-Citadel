import { fetchItemMediaUrl, itemKeys } from "@/features/items/services/itemService";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import {
  fetchClassIcon,
  fetchQuest,
  fetchQuestGroup,
  fetchQuestGroupIndex,
} from "@/features/quests/services/questService";
import type { QuestBrowseMode } from "@/features/quests/types";
import { fetchSpellIcon, spellKeys } from "@/features/spells/services/spellService";
import { env } from "@/lib/env";

/** Quests, zones and categories change with patches; a day is plenty. */
const STATIC_STALE_MS = 24 * 60 * 60_000;

/*
 * A page of the quest list starts up to 25 quest lookups as its rows near
 * the viewport. Started together they would burst through the proxy, which
 * shares Blizzard's per-second quota with every other visitor (and Netlify
 * allows each IP 600 a minute); six at a time drains a page in well under a
 * second. A page left behind (its rows unmount) cancels its queued lookups,
 * so the queue never holds more than one page (and an opened quest).
 */
const MAX_QUESTS_IN_FLIGHT = 6;
const limitQuestFetch = createConcurrencyLimiter(MAX_QUESTS_IN_FLIGHT);

/*
 * Names are localized, so those keys carry the locale; icons are not (the
 * render host is per region only).
 */
export const questKeys = {
  groupIndex: (mode: QuestBrowseMode) =>
    ["quest-group-index", mode, env.region, env.locale] as const,
  group: (mode: QuestBrowseMode, groupId: number) =>
    ["quest-group", mode, groupId, env.region, env.locale] as const,
  quest: (questId: number) => ["quest", questId, env.region, env.locale] as const,
  classIcon: (classId: number) => ["playable-class-icon", classId, env.region] as const,
};

export const questGroupIndexQuery = (mode: QuestBrowseMode) => ({
  queryKey: questKeys.groupIndex(mode),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchQuestGroupIndex(mode, signal),
  staleTime: STATIC_STALE_MS,
});

export const questGroupQuery = (mode: QuestBrowseMode, groupId: number) => ({
  queryKey: questKeys.group(mode, groupId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchQuestGroup(mode, groupId, signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by the list rows and the dialog, so opening a row costs nothing. */
export const questQuery = (questId: number) => ({
  queryKey: questKeys.quest(questId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitQuestFetch(() => fetchQuest(questId, signal), signal),
  staleTime: STATIC_STALE_MS,
});

export const classIconQuery = (classId: number) => ({
  queryKey: questKeys.classIcon(classId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchClassIcon(classId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

/** The Items explorer's own cache entry: an icon seen there costs nothing here. */
export const itemIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemMediaUrl(itemId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

/** The Spells explorer's cache entry, likewise. */
export const spellIconQuery = (spellId: number) => ({
  queryKey: spellKeys.icon(spellId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchSpellIcon(spellId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});
