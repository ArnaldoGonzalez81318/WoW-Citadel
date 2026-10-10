import type { QueryClient } from "@tanstack/react-query";

import {
  POWER_TYPE_ICON_NAMES,
  asAssetList,
  asRecord,
  buildRenderIconUrl,
  extractNumericPathSegment,
} from "@/features/apiExplorer/gallery/normalizeRecords";
import {
  resolveLocalizedString,
  resolveNamespace,
} from "@/features/apiExplorer/utils";
import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import type { SearchResultMeta } from "@/features/search/types";
import {
  fetchSpellIcon,
  spellKeys,
} from "@/features/spells/services/spellService";
import { BlizzardRequestError, blizzardClient } from "@/lib/blizzardClient";
import { env } from "@/lib/env";
import { isAbortError } from "@/lib/errors";
import type { ExternalLinkKind } from "@/lib/externalLinks";
import { humanizeEnum } from "@/lib/format";
import { pickAssetUrl } from "@/lib/mediaAssets";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type GalleryStrategyId =
  | "direct-media"
  | "talent-via-spell"
  | "pvp-talent-via-spell"
  | "race-via-racial-spell"
  | "heirloom-via-item"
  | "tech-talent-via-detail"
  | "tech-talent-tree-via-talent"
  | "class-via-detail"
  | "affix-via-detail"
  | "pet-via-detail"
  | "title-via-achievement";

export type MediaRequest = {
  path: string;
  namespace: string | undefined;
  strategy: GalleryStrategyId;
};

export type MediaQueryTarget = {
  token: string;
  path: string;
  namespace?: string;
  strategy: GalleryStrategyId;
};

export type MediaQueryResult = {
  url?: string;
  summary?: string;
  details?: string;
  tag?: string;
  meta?: SearchResultMeta[];
  /** Set by talent strategies so the card can link to Wowhead. */
  spellId?: number;
  /** Set by the heirloom strategy so the card can link to Wowhead. */
  itemId?: number;
  /** The record (or its media) does not exist: shown as the placeholder. */
  status?: "not-found";
};

export type MediaStrategyContext = {
  queryClient: QueryClient;
  signal?: AbortSignal;
};

export type MediaStrategy = (
  target: MediaQueryTarget,
  ctx: MediaStrategyContext,
) => Promise<MediaQueryResult>;

export type DatasetProfile = {
  /** Which detail/media request enriches a record of `endpointId`, if any. */
  buildMediaRequest: (
    record: Record<string, unknown>,
    endpointId: string,
  ) => MediaRequest | undefined;
  /** A media URL known without a request (power type icons). */
  staticMediaUrl?: (record: Record<string, unknown>) => string | undefined;
  /** Endpoint ids whose cards are also deduped by name (talent ranks). */
  dedupeByName?: string[];
  sortByName?: boolean;
  /** Card layout for the family's sections (compact by default). */
  layout?: "compact" | "row";
  /**
   * Public-page kind for `getExternalLink(kind, id, name)`, resolved from the
   * index record so every card carries its Wowhead link before enrichment.
   */
  externalLinkKind?: ExternalLinkKind;
};

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

const STATIC = (): string | undefined => resolveNamespace("static");

const noMediaRequest: DatasetProfile["buildMediaRequest"] = () => undefined;

const idOf = (record: Record<string, unknown>): number | undefined =>
  typeof record.id === "number" ? record.id : undefined;

const directMedia = (path: string): MediaRequest => ({
  path,
  namespace: STATIC(),
  strategy: "direct-media",
});

const detailRequest = (
  path: string,
  strategy: GalleryStrategyId,
): MediaRequest => ({ path, namespace: STATIC(), strategy });

/** Per-family enrichment rules, keyed by slug (exactly the dataset families). */
export const DATASET_PROFILES: Record<string, DatasetProfile> = {
  pet: {
    externalLinkKind: "battlepet",
    buildMediaRequest: (record) => {
      const id = idOf(record);
      return id === undefined
        ? undefined
        : detailRequest(`/data/wow/pet/${id}`, "pet-via-detail");
    },
  },
  talent: {
    dedupeByName: ["talent-index"],
    buildMediaRequest: (record, endpointId) => {
      const id = idOf(record);

      if (endpointId === "talent-index" && id !== undefined) {
        return detailRequest(`/data/wow/talent/${id}`, "talent-via-spell");
      }

      if (endpointId === "pvp-talent-index" && id !== undefined) {
        return detailRequest(
          `/data/wow/pvp-talent/${id}`,
          "pvp-talent-via-spell",
        );
      }

      if (endpointId === "talent-tree-index") {
        const specId = extractNumericPathSegment(
          asRecord(record.key)?.href,
          /\/playable-specialization\/(\d+)/u,
        );
        if (specId !== undefined) {
          return directMedia(
            `/data/wow/media/playable-specialization/${specId}`,
          );
        }
      }

      return undefined;
    },
  },
  "playable-race": {
    sortByName: true,
    buildMediaRequest: (record) => {
      const id = idOf(record);
      return id === undefined
        ? undefined
        : detailRequest(
            `/data/wow/playable-race/${id}`,
            "race-via-racial-spell",
          );
    },
  },
  "playable-class": {
    sortByName: true,
    layout: "row",
    buildMediaRequest: (record) => {
      const id = idOf(record);
      return id === undefined
        ? undefined
        : detailRequest(`/data/wow/playable-class/${id}`, "class-via-detail");
    },
  },
  "playable-specialization": {
    sortByName: true,
    buildMediaRequest: (record) => {
      const id = idOf(record);
      return id === undefined
        ? undefined
        : directMedia(`/data/wow/media/playable-specialization/${id}`);
    },
  },
  heirloom: {
    buildMediaRequest: (record) => {
      const id = idOf(record);
      return id === undefined
        ? undefined
        : detailRequest(`/data/wow/heirloom/${id}`, "heirloom-via-item");
    },
  },
  "housing-decor": {
    buildMediaRequest: (record, endpointId) => {
      const id = idOf(record);
      if (id === undefined) {
        return undefined;
      }
      if (endpointId === "decor-index") {
        return directMedia(`/data/wow/media/decor/${id}`);
      }
      if (endpointId === "fixture-index") {
        return directMedia(`/data/wow/media/fixture/${id}`);
      }
      return undefined;
    },
  },
  "tech-talent": {
    buildMediaRequest: (record, endpointId) => {
      const id = idOf(record);
      if (id === undefined) {
        return undefined;
      }

      if (endpointId === "tech-talent-index") {
        return detailRequest(
          `/data/wow/tech-talent/${id}`,
          "tech-talent-via-detail",
        );
      }

      if (endpointId === "tech-talent-tree-index") {
        return detailRequest(
          `/data/wow/tech-talent-tree/${id}`,
          "tech-talent-tree-via-talent",
        );
      }

      return undefined;
    },
  },
  "power-type": {
    buildMediaRequest: noMediaRequest,
    staticMediaUrl: (record) => {
      const id = idOf(record);
      const iconName = id === undefined ? undefined : POWER_TYPE_ICON_NAMES[id];
      return iconName ? buildRenderIconUrl(iconName) : undefined;
    },
  },
  "mythic-keystone-affix": {
    sortByName: true,
    layout: "row",
    buildMediaRequest: (record) => {
      const id = idOf(record);
      return id === undefined
        ? undefined
        : detailRequest(`/data/wow/keystone-affix/${id}`, "affix-via-detail");
    },
  },
  title: {
    buildMediaRequest: (record) => {
      const id = idOf(record);
      return id === undefined
        ? undefined
        : detailRequest(`/data/wow/title/${id}`, "title-via-achievement");
    },
  },
  /*
   * Blizzard publishes no artwork for modified crafting: the category and
   * reagent slot type records carry only an id, a name and a description, and
   * `/data/wow/media/modified-crafting/...` is a 404. The letter fallback is
   * the whole picture here.
   */
  "modified-crafting": { buildMediaRequest: noMediaRequest },
  /*
   * These two families route to their own explorers today (see
   * CATEGORY_REGISTRY), so their profiles only apply if the dataset gallery
   * ever serves them again. Both reach an icon through the item that wears
   * the look / is the toy: `/data/wow/item-appearance/{id}` → `items[0].id`
   * and `/data/wow/toy/{id}` → `item.id`, then `/data/wow/media/item/{itemId}`.
   */
  "item-appearance": { buildMediaRequest: noMediaRequest },
  toy: { buildMediaRequest: noMediaRequest },
};

/* ------------------------------------------------------------------ */
/* Shared hops                                                         */
/* ------------------------------------------------------------------ */

const SHARED_STALE_TIME_MS = 300_000;

const NO_ICON = "";

/**
 * The best asset URL in a media response. Asset keys differ per endpoint
 * (`icon` for items and spells, `tile` for journal instances, `bust` for
 * classes), so the shared preference order decides instead of `key === "icon"`.
 */
const pickMediaUrl = (data: unknown): string | undefined =>
  pickAssetUrl(asAssetList(asRecord(data)?.assets));

/**
 * One media hop through the query cache, so identical ids dedupe across cards
 * and pages. The cached value is the icon URL, or `NO_ICON` when the response
 * carries no usable asset (react-query rejects `undefined` data).
 *
 * `null` is tolerated on the way out because a key shared with an explorer may
 * already hold that explorer's own `string | null` (see `fetchExplorerIcon`).
 */
const fetchSharedIconUrl = async (
  ctx: MediaStrategyContext,
  queryKey: readonly unknown[],
  path: string,
  namespace: string | undefined,
): Promise<string | undefined> => {
  const url = await ctx.queryClient.fetchQuery<string | null>({
    queryKey,
    queryFn: async ({ signal }) =>
      pickMediaUrl(
        await blizzardClient.get<unknown>(path, { namespace }, { signal }),
      ) ?? NO_ICON,
    staleTime: SHARED_STALE_TIME_MS,
    retry: false,
  });

  return url === null || url === NO_ICON ? undefined : url;
};

/**
 * An icon that one of the dedicated explorers already owns, through *its* key
 * factory and *its* fetcher — so a talent's spell icon or an heirloom's item
 * icon is the same cache entry the Spells / Items explorers, `/search` and the
 * header search hold, instead of a second private copy of the same artwork.
 *
 * Passing the explorer's fetcher (not just its key) is what keeps the two
 * sides from disagreeing: both swallow a 404 into `null`, so a record with no
 * media leaves the card's fallback rather than marking the whole card
 * not-found, and neither can cache a shape the other misreads.
 */
const fetchExplorerIcon = async (
  ctx: MediaStrategyContext,
  queryKey: readonly unknown[],
  fetcher: (signal: AbortSignal) => Promise<string | null>,
): Promise<string | undefined> => {
  const url = await ctx.queryClient.fetchQuery<string | null>({
    queryKey,
    queryFn: ({ signal }) => fetcher(signal),
    staleTime: SHARED_STALE_TIME_MS,
    retry: false,
  });

  return url === null || url === NO_ICON ? undefined : url;
};

const fetchDetail = <T>(
  target: MediaQueryTarget,
  ctx: MediaStrategyContext,
): Promise<T> =>
  blizzardClient.get<T>(
    target.path,
    { namespace: target.namespace },
    { signal: ctx.signal },
  );

const joinDetails = (parts: Array<string | undefined>): string | undefined => {
  const kept = parts.filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return kept.length > 0 ? kept.join(" • ") : undefined;
};

const metaRows = (
  entries: Array<[label: string, value: string | undefined]>,
): SearchResultMeta[] =>
  entries
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].length > 0,
    )
    .map(([label, value]) => ({ label, value }));

const namesOf = (entries: Array<{ name?: unknown }> | undefined): string[] =>
  (entries ?? [])
    .map((entry) => resolveLocalizedString(entry.name))
    .filter((name) => name.length > 0);

/* ------------------------------------------------------------------ */
/* Strategies                                                          */
/* ------------------------------------------------------------------ */

type TalentDetail = {
  description?: unknown;
  rank_descriptions?: Array<{ rank?: number; description?: unknown }>;
  spell?: { id?: number; name?: unknown };
  playable_class?: { name?: unknown; id?: number };
  playable_specialization?: { name?: unknown; id?: number };
  compatible_slots?: number[];
  unlock_player_level?: number;
};

const talentViaSpell: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<TalentDetail>(target, ctx);
  const spellId = detail?.spell?.id;
  const url =
    typeof spellId === "number"
      ? await fetchExplorerIcon(ctx, spellKeys.icon(spellId), (signal) =>
          fetchSpellIcon(spellId, signal),
        )
      : undefined;

  const rankedDescription = detail?.rank_descriptions
    ?.map((rank) => resolveLocalizedString(rank.description))
    .find((description) => description.length > 0);
  const summary =
    resolveLocalizedString(detail?.description) || rankedDescription;

  const spellName = resolveLocalizedString(detail?.spell?.name) || undefined;
  const level =
    typeof detail?.unlock_player_level === "number" &&
    detail.unlock_player_level > 0
      ? String(detail.unlock_player_level)
      : undefined;
  const slots =
    Array.isArray(detail?.compatible_slots) &&
    detail.compatible_slots.length > 0
      ? String(detail.compatible_slots.length)
      : undefined;
  const specialization =
    resolveLocalizedString(detail?.playable_specialization?.name) || undefined;
  const playableClass =
    resolveLocalizedString(detail?.playable_class?.name) || undefined;

  return {
    url,
    summary: summary || undefined,
    details: joinDetails([
      spellName,
      level ? `Level ${level}` : undefined,
      slots ? `${slots} PvP slots` : undefined,
    ]),
    tag: specialization ?? playableClass,
    meta: metaRows([
      ["Spell", spellName],
      ["Specialization", specialization],
      ["Class", playableClass],
      ["Level", level],
      ["PvP slots", slots],
    ]),
    spellId: typeof spellId === "number" ? spellId : undefined,
  };
};

type RaceDetail = {
  faction?: { type?: string; name?: unknown };
  is_allied_race?: boolean;
  racial_spells?: Array<{ id?: number; name?: unknown }>;
  playable_classes?: Array<{ id?: number; name?: unknown }>;
};

const raceViaRacialSpell: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<RaceDetail>(target, ctx);
  const spellId = detail?.racial_spells?.[0]?.id;
  const url =
    typeof spellId === "number"
      ? await fetchExplorerIcon(ctx, spellKeys.icon(spellId), (signal) =>
          fetchSpellIcon(spellId, signal),
        )
      : undefined;

  const faction = resolveLocalizedString(detail?.faction?.name) || undefined;
  const classes = namesOf(detail?.playable_classes).join(", ") || undefined;

  return {
    url,
    tag: faction,
    summary: classes,
    details: detail?.is_allied_race ? "Allied Race" : undefined,
    meta: metaRows([
      ["Faction", faction],
      ["Classes", classes],
      ["Allied race", detail?.is_allied_race ? "Yes" : undefined],
    ]),
  };
};

type HeirloomDetail = {
  item?: { id?: number };
};

const heirloomViaItem: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<HeirloomDetail>(target, ctx);
  const itemId = detail?.item?.id;
  if (typeof itemId !== "number") {
    return {};
  }

  const url = await fetchExplorerIcon(ctx, itemKeys.media(itemId), (signal) =>
    fetchItemMediaUrl(itemId, signal),
  );

  return { url, itemId };
};

type TechTalentDetail = {
  id?: number;
  description?: unknown;
  tier?: number;
  compatible_playstyle?: { name?: unknown; type?: string };
  spell_tooltip?: { description?: unknown };
  media?: { id?: number };
};

const techTalentViaDetail: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<TechTalentDetail>(target, ctx);
  const mediaId = detail?.media?.id ?? detail?.id;
  const url =
    typeof mediaId === "number"
      ? await fetchSharedIconUrl(
          ctx,
          ["tech-talent-media", mediaId, env.region],
          `/data/wow/media/tech-talent/${mediaId}`,
          target.namespace,
        )
      : undefined;

  const description =
    resolveLocalizedString(detail?.spell_tooltip?.description) ||
    resolveLocalizedString(detail?.description);
  const tier =
    typeof detail?.tier === "number" ? String(detail.tier) : undefined;
  const playstyle =
    resolveLocalizedString(detail?.compatible_playstyle?.name) || undefined;

  return {
    url,
    summary: description || undefined,
    details: joinDetails([tier ? `Tier ${tier}` : undefined, playstyle]),
    tag: playstyle,
    meta: metaRows([
      ["Tier", tier],
      ["Playstyle", playstyle],
    ]),
  };
};

type TechTalentTreeDetail = {
  playable_class?: { id?: number; name?: unknown };
  max_tiers?: number;
  talents?: Array<{ id?: number; name?: unknown }>;
};

/**
 * Tech talent trees have no media record of their own
 * (`/data/wow/media/tech-talent-tree/{id}` is a 404), but every tree lists its
 * talents and those do: the card shows its first talent's icon, through the
 * same detail → media hop the other strategies use. The media query key is
 * shared with `techTalentViaDetail`, so a talent fetched for both dedupes.
 */
const techTalentTreeViaTalent: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<TechTalentTreeDetail>(target, ctx);
  const talents = detail?.talents ?? [];
  const firstTalentId = talents.find(
    (talent) => typeof talent.id === "number",
  )?.id;
  const url =
    typeof firstTalentId === "number"
      ? await fetchSharedIconUrl(
          ctx,
          ["tech-talent-media", firstTalentId, env.region],
          `/data/wow/media/tech-talent/${firstTalentId}`,
          target.namespace,
        )
      : undefined;

  const playableClass =
    resolveLocalizedString(detail?.playable_class?.name) || undefined;
  const talentCount = talents.length > 0 ? String(talents.length) : undefined;
  const tiers =
    typeof detail?.max_tiers === "number" && detail.max_tiers > 0
      ? String(detail.max_tiers)
      : undefined;

  return {
    url,
    tag: playableClass,
    summary: namesOf(talents).slice(0, 6).join(", ") || undefined,
    details: joinDetails([
      playableClass,
      talentCount ? `${talentCount} talents` : undefined,
      tiers ? `${tiers} tiers` : undefined,
    ]),
    meta: metaRows([
      ["Class", playableClass],
      ["Talents", talentCount],
      ["Tiers", tiers],
    ]),
  };
};

type TitleDetail = {
  source?: {
    type?: { type?: string; name?: unknown };
    achievements?: Array<{ id?: number; name?: unknown }>;
  };
};

/**
 * Titles have no media endpoint (`/data/wow/media/title/{id}` is a 404), and
 * the record carries no icon. What it does carry is the achievement that
 * grants it, which has one: the card shows that achievement's icon and names
 * it, so the picture is the title's source rather than a guess. Titles with no
 * source — the old PvP ranks, the newest unreleased ones — keep the letter.
 */
const titleViaAchievement: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<TitleDetail>(target, ctx);
  const achievements = detail?.source?.achievements ?? [];
  const achievementId = achievements.find(
    (achievement) => typeof achievement.id === "number",
  )?.id;
  const url =
    typeof achievementId === "number"
      ? await fetchSharedIconUrl(
          ctx,
          ["achievement-media", achievementId, env.region],
          `/data/wow/media/achievement/${achievementId}`,
          target.namespace,
        )
      : undefined;

  const sourceType =
    resolveLocalizedString(detail?.source?.type?.name) ||
    (typeof detail?.source?.type?.type === "string"
      ? humanizeEnum(detail.source.type.type)
      : undefined);
  const achievementNames = namesOf(achievements).join(", ") || undefined;

  return {
    url,
    tag: sourceType,
    summary: achievementNames,
    meta: metaRows([
      ["Source", sourceType],
      ["Achievement", achievementNames],
    ]),
  };
};

type PlayableClassDetail = {
  id?: number;
  power_type?: { name?: unknown };
  specializations?: Array<{ name?: unknown }>;
  media?: { id?: number };
  playable_races?: unknown[];
};

const classViaDetail: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<PlayableClassDetail>(target, ctx);
  const pathId = extractNumericPathSegment(
    target.path,
    /\/playable-class\/(\d+)/u,
  );
  const mediaId = detail?.media?.id ?? detail?.id ?? pathId;
  const url =
    typeof mediaId === "number"
      ? await fetchSharedIconUrl(
          ctx,
          ["playable-class-media", mediaId, env.region],
          `/data/wow/media/playable-class/${mediaId}`,
          target.namespace,
        )
      : undefined;

  const specializations = namesOf(detail?.specializations);
  const powerType =
    resolveLocalizedString(detail?.power_type?.name) || undefined;
  const raceCount = Array.isArray(detail?.playable_races)
    ? detail.playable_races.length
    : 0;

  return {
    url,
    tag: powerType,
    summary: specializations.join(", ") || undefined,
    details:
      specializations.length > 0
        ? `${specializations.length} specializations`
        : undefined,
    meta: metaRows([
      ["Power type", powerType],
      ["Specializations", specializations.join(", ") || undefined],
      ["Races", raceCount > 0 ? String(raceCount) : undefined],
    ]),
  };
};

type KeystoneAffixDetail = {
  id?: number;
  description?: unknown;
  media?: { id?: number };
};

/** Affix detail carries the effect text; its media record carries the icon. */
const affixViaDetail: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<KeystoneAffixDetail>(target, ctx);
  const pathId = extractNumericPathSegment(
    target.path,
    /\/keystone-affix\/(\d+)/u,
  );
  const mediaId = detail?.media?.id ?? detail?.id ?? pathId;
  const url =
    typeof mediaId === "number"
      ? await fetchSharedIconUrl(
          ctx,
          ["keystone-affix-media", mediaId, env.region],
          `/data/wow/media/keystone-affix/${mediaId}`,
          target.namespace,
        )
      : undefined;

  const description = resolveLocalizedString(detail?.description) || undefined;

  return {
    url,
    summary: description,
    meta: metaRows([["Effect", description]]),
  };
};

type BattlePetDetail = {
  id?: number;
  battle_pet_type?: { type?: string; name?: unknown };
  description?: unknown;
  source?: { type?: string; name?: unknown };
  abilities?: Array<{
    ability?: { name?: unknown; id?: number };
    slot?: number;
    required_level?: number;
  }>;
  is_capturable?: boolean;
  is_tradable?: boolean;
  is_alliance_only?: boolean;
  is_horde_only?: boolean;
  icon?: unknown;
  media?: { id?: number };
};

/**
 * Battle pet detail carries the icon URL directly; the media record is only
 * fetched when it does not. Type, source, description and abilities become
 * the card facts and dialog rows.
 */
const petViaDetail: MediaStrategy = async (target, ctx) => {
  const detail = await fetchDetail<BattlePetDetail>(target, ctx);
  const pathId = extractNumericPathSegment(target.path, /\/pet\/(\d+)/u);
  const mediaId = detail?.media?.id ?? detail?.id ?? pathId;
  const url =
    typeof detail?.icon === "string" && detail.icon.length > 0
      ? detail.icon
      : typeof mediaId === "number"
        ? await fetchSharedIconUrl(
            ctx,
            ["pet-media", mediaId, env.region],
            `/data/wow/media/pet/${mediaId}`,
            target.namespace,
          )
        : undefined;

  const petType =
    resolveLocalizedString(detail?.battle_pet_type?.name) ||
    (typeof detail?.battle_pet_type?.type === "string"
      ? humanizeEnum(detail.battle_pet_type.type)
      : undefined);
  const source =
    resolveLocalizedString(detail?.source?.name) ||
    (typeof detail?.source?.type === "string"
      ? humanizeEnum(detail.source.type)
      : undefined);
  const description = resolveLocalizedString(detail?.description) || undefined;
  const abilities = [...(detail?.abilities ?? [])]
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    .map((entry) => {
      const name = resolveLocalizedString(entry.ability?.name);
      if (name.length === 0) {
        return "";
      }
      return typeof entry.required_level === "number" &&
        entry.required_level > 1
        ? `${name} (level ${entry.required_level})`
        : name;
    })
    .filter((name) => name.length > 0);
  const faction = detail?.is_alliance_only
    ? "Alliance"
    : detail?.is_horde_only
      ? "Horde"
      : undefined;

  return {
    url,
    summary: description,
    details: joinDetails([petType, source]),
    tag: petType,
    meta: metaRows([
      ["Type", petType],
      ["Source", source],
      ["Abilities", abilities.join(", ") || undefined],
      ["Faction", faction],
      ["Capturable", detail?.is_capturable ? "Yes" : undefined],
      ["Tradable", detail?.is_tradable ? "Yes" : undefined],
    ]),
  };
};

const directMediaStrategy: MediaStrategy = async (target, ctx) => ({
  url: pickMediaUrl(await fetchDetail<unknown>(target, ctx)),
});

export const MEDIA_STRATEGIES: Record<GalleryStrategyId, MediaStrategy> = {
  "direct-media": directMediaStrategy,
  "talent-via-spell": talentViaSpell,
  "pvp-talent-via-spell": talentViaSpell,
  "race-via-racial-spell": raceViaRacialSpell,
  "heirloom-via-item": heirloomViaItem,
  "tech-talent-via-detail": techTalentViaDetail,
  "tech-talent-tree-via-talent": techTalentTreeViaTalent,
  "class-via-detail": classViaDetail,
  "affix-via-detail": affixViaDetail,
  "pet-via-detail": petViaDetail,
  "title-via-achievement": titleViaAchievement,
};

/* ------------------------------------------------------------------ */
/* Concurrency + error policy                                          */
/* ------------------------------------------------------------------ */

export const MAX_MEDIA_IN_FLIGHT = 6;

let inFlight = 0;
const waiters: Array<() => void> = [];

const abortReason = (signal: AbortSignal | undefined): unknown =>
  signal?.reason ??
  new DOMException("The operation was aborted.", "AbortError");

/** Resolves when a strategy slot is free; rejects if `signal` aborts first. */
const acquireSlot = (signal: AbortSignal | undefined): Promise<void> => {
  if (signal?.aborted) {
    return Promise.reject(abortReason(signal));
  }

  if (inFlight < MAX_MEDIA_IN_FLIGHT) {
    inFlight += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const grant = (): void => {
      signal?.removeEventListener("abort", onAbort);
      inFlight += 1;
      resolve();
    };
    const onAbort = (): void => {
      const index = waiters.indexOf(grant);
      if (index >= 0) {
        waiters.splice(index, 1);
      }
      reject(abortReason(signal));
    };

    waiters.push(grant);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

const releaseSlot = (): void => {
  inFlight = Math.max(0, inFlight - 1);
  const next = waiters.shift();
  next?.();
};

/**
 * Runs the strategy for `target` under a module-wide limit of
 * `MAX_MEDIA_IN_FLIGHT` concurrent executions. Aborts and retryable errors
 * propagate (react-query handles them); a 404 becomes `{ status: "not-found" }`.
 */
export const runMediaStrategy = async (
  target: MediaQueryTarget,
  ctx: MediaStrategyContext,
): Promise<MediaQueryResult> => {
  await acquireSlot(ctx.signal);

  try {
    return await MEDIA_STRATEGIES[target.strategy](target, ctx);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof BlizzardRequestError && error.status === 404) {
      return { status: "not-found" };
    }
    throw error;
  } finally {
    releaseSlot();
  }
};

/** 429 and 5xx are worth another attempt; everything else fails fast. */
export const isRetryableBlizzardError = (error: unknown): boolean =>
  error instanceof BlizzardRequestError &&
  (error.status === 429 || error.status >= 500);

/** Honours `Retry-After`, else exponential backoff (capped at 8s) with jitter. */
export const mediaRetryDelay = (attempt: number, error: unknown): number => {
  const retryAfterMs =
    error instanceof BlizzardRequestError ? error.retryAfterMs : undefined;

  return (
    (retryAfterMs ?? Math.min(1000 * 2 ** attempt, 8000)) + Math.random() * 300
  );
};
