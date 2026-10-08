import { blizzardClient } from "@/lib/blizzardClient";
import type { QueryParams } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  nameParam,
  nameParamFromTerms,
  namespace,
  optional404,
  sortByName,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import {
  MAX_SEARCH_PAGE_SIZE,
  narrowByTypedName,
  relaxedNameTerms,
} from "@/lib/nameSearch";
import type {
  Creature,
  CreatureFamily,
  CreatureFamilySummary,
  CreatureSearchCriteria,
  CreatureSearchPage,
  CreatureType,
  LocalizedString,
  NamedRef,
  PetSpecialization,
} from "@/features/creatures/types";

/*
 * Blizzard's creature search is not a bestiary: its index holds tameable
 * beasts, battle pets and companions and a few hundred others, so a raid
 * boss such as Ragnaros only finds "Lil' Ragnaros" (bosses live in the
 * Encounter Journal). It does filter on `type.id`, `family.id` and
 * `is_tameable`, and each hit carries the whole creature record (type,
 * family, display ids), so a page of cards costs one request plus one
 * render lookup per card.
 *
 *   search/creature                  records, 1,000 matches at most
 *   media/creature-display/{id}      600×600 "zoom" render (shared module)
 *   creature-family/index -> {id}    hunter pet family, its pet spec, icon
 *   playable-specialization/{id}     Ferocity / Tenacity / Cunning blurb
 */

/** Cards per page: 2, 3, 4 and 6 columns all end on a full row. */
export const CREATURE_PAGE_SIZE = 24;

type Reference = { id: number; name?: LocalizedString };

type CreatureResponse = {
  id: number;
  name?: LocalizedString;
  type?: Reference;
  family?: Reference;
  creature_displays?: Array<{ id?: number }>;
  is_tameable?: boolean;
};

type SearchResponse = {
  page?: number;
  pageCount?: number;
  resultCountCapped?: boolean;
  results?: Array<{ data: CreatureResponse }>;
};

type IndexResponse<K extends string> = {
  [key in K]?: Reference[];
};

type FamilyResponse = {
  id: number;
  name?: LocalizedString;
  specialization?: Reference;
  media?: { id?: number };
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

type SpecializationResponse = {
  id: number;
  name?: LocalizedString;
  gender_description?: {
    male?: LocalizedString;
    female?: LocalizedString;
  };
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const toRef = (reference: Reference | undefined, fallback: string): NamedRef | undefined =>
  reference && typeof reference.id === "number"
    ? { id: reference.id, name: localized(reference.name) || `${fallback} #${reference.id}` }
    : undefined;

/** Search hits and creature records share one shape (names are locale maps in search). */
const toCreature = (raw: CreatureResponse): Creature => ({
  id: raw.id,
  name: localized(raw.name) || `Creature #${raw.id}`,
  type: toRef(raw.type, "Type"),
  family: toRef(raw.family, "Family"),
  displayIds: (raw.creature_displays ?? [])
    .map((display) => display.id)
    .filter((id): id is number => typeof id === "number" && id > 0),
  isTameable: raw.is_tameable === true,
});

const iconOf = (media: MediaResponse | undefined): string | null => {
  const assets = media?.assets ?? [];
  return assets.find((asset) => asset.key === "icon")?.value ?? assets[0]?.value ?? null;
};

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/** Filters on top of the name terms (keys the proxy allow-lists). */
const filterParams = (criteria: CreatureSearchCriteria): QueryParams => ({
  ...(criteria.typeId !== null ? { "type.id": criteria.typeId } : {}),
  ...(criteria.familyId !== null ? { "family.id": criteria.familyId } : {}),
  ...(criteria.tameable !== null ? { is_tameable: criteria.tameable } : {}),
});

const EMPTY_PAGE = (page: number): CreatureSearchPage => ({
  creatures: [],
  page,
  pageCount: 0,
  total: 0,
  capped: false,
  narrowed: false,
});

/**
 * One page of creatures matching `criteria`, alphabetical. Relevance order
 * is not stable between pages (the same "Owl" turns up on pages 1 and 2),
 * so pages sort by name with the id breaking ties between namesakes.
 *
 * Blizzard matches whole words only: when nothing matches every word, the
 * last one is probably half typed ("Bloodfen Rap"), so the finished words
 * are searched again and the candidates narrowed here (see nameSearch).
 */
export const searchCreatures = async (
  criteria: CreatureSearchCriteria,
  page: number,
  signal?: AbortSignal,
): Promise<CreatureSearchPage> => {
  const filters = filterParams(criteria);
  const strict = await optional404(() =>
    blizzardClient.get<SearchResponse>(
      "/data/wow/search/creature",
      {
        namespace: namespace("static"),
        orderby: `name.${env.locale},id`,
        _page: page,
        _pageSize: CREATURE_PAGE_SIZE,
        ...(criteria.name ? nameParam(criteria.name) : {}),
        ...filters,
      },
      { signal },
    ),
  );

  const pageCount = strict?.pageCount ?? 0;
  // A page past the end of real matches is a stale page number, not a
  // half-typed word: report the page count so the caller can step back.
  if (pageCount > 0 || !criteria.name) {
    const creatures = (strict?.results ?? []).map((entry) => toCreature(entry.data));
    const resolvedPage = strict?.page ?? page;
    return {
      creatures,
      page: resolvedPage,
      pageCount,
      total: pageCount <= 1 && resolvedPage === 1 ? creatures.length : undefined,
      capped: strict?.resultCountCapped === true,
      narrowed: false,
    };
  }

  const relaxed = relaxedNameTerms(criteria.name);
  if (!relaxed) {
    return EMPTY_PAGE(page);
  }

  // Ranked by relevance (no `orderby`) so the closest names come first, then
  // sorted by name here like every other page.
  const candidates = await optional404(() =>
    blizzardClient.get<SearchResponse>(
      "/data/wow/search/creature",
      {
        namespace: namespace("static"),
        _page: 1,
        _pageSize: MAX_SEARCH_PAGE_SIZE,
        ...nameParamFromTerms(relaxed),
        ...filters,
      },
      { signal },
    ),
  );
  if (!candidates) {
    return EMPTY_PAGE(page);
  }

  const narrowed = narrowByTypedName(
    sortByName((candidates.results ?? []).map((entry) => toCreature(entry.data))),
    criteria.name,
    (creature) => creature.name,
    { page, pageSize: CREATURE_PAGE_SIZE },
  );
  if (narrowed.total === 0) {
    return EMPTY_PAGE(page);
  }
  return {
    creatures: narrowed.results,
    page,
    pageCount: narrowed.pageCount,
    total: narrowed.total,
    capped: (candidates.pageCount ?? 1) > 1 || candidates.resultCountCapped === true,
    narrowed: true,
  };
};

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

/** One creature, or null when Blizzard has no such id (404). */
export const fetchCreature = async (
  creatureId: number,
  signal?: AbortSignal,
): Promise<Creature | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<CreatureResponse>(
      `/data/wow/creature/${creatureId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return raw ? toCreature(raw) : null;
};

const fetchIndex = async <K extends string>(
  path: string,
  key: K,
  fallback: string,
  signal?: AbortSignal,
): Promise<NamedRef[]> => {
  const response = await blizzardClient.get<IndexResponse<K>>(
    path,
    { namespace: namespace("static") },
    { signal },
  );
  return sortByName(
    (response[key] ?? [])
      .map((entry) => toRef(entry, fallback))
      .filter((entry): entry is NamedRef => entry !== undefined),
  );
};

/** Every creature type, by name. */
export const fetchCreatureTypes = (signal?: AbortSignal): Promise<CreatureType[]> =>
  fetchIndex("/data/wow/creature-type/index", "creature_types", "Type", signal);

/** Every creature family, by name (hunter pet families and other classes' minions). */
export const fetchCreatureFamilyIndex = (
  signal?: AbortSignal,
): Promise<CreatureFamilySummary[]> =>
  fetchIndex("/data/wow/creature-family/index", "creature_families", "Family", signal);

/** A family's record: its hunter pet spec, if any, and whether it has an icon. */
export const fetchCreatureFamily = async (
  familyId: number,
  signal?: AbortSignal,
): Promise<CreatureFamily> => {
  const raw = await blizzardClient.get<FamilyResponse>(
    `/data/wow/creature-family/${familyId}`,
    { namespace: namespace("static") },
    { signal },
  );
  return {
    id: raw.id,
    name: localized(raw.name) || `Family #${raw.id}`,
    specialization: toRef(raw.specialization, "Specialization"),
    hasIcon: typeof raw.media?.id === "number",
  };
};

/** A family's 56px icon, or null when Blizzard has none (404). */
export const fetchCreatureFamilyIcon = async (
  familyId: number,
  signal?: AbortSignal,
): Promise<string | null> =>
  iconOf(
    await optional404(() =>
      blizzardClient.get<MediaResponse>(
        `/data/wow/media/creature-family/${familyId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  );

/**
 * A hunter pet specialization with its blurb ("Driven by a frenzied
 * persistence…") and icon. The icon may 404 (it stays null); any other
 * failure fails the spec so react-query retries it.
 */
export const fetchPetSpecialization = async (
  specId: number,
  signal?: AbortSignal,
): Promise<PetSpecialization> => {
  const [record, media] = await Promise.all([
    blizzardClient.get<SpecializationResponse>(
      `/data/wow/playable-specialization/${specId}`,
      { namespace: namespace("static") },
      { signal },
    ),
    optional404(() =>
      blizzardClient.get<MediaResponse>(
        `/data/wow/media/playable-specialization/${specId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  ]);
  const blurb = record.gender_description;
  return {
    id: record.id,
    name: localized(record.name) || `Specialization #${record.id}`,
    description:
      cleanMarkup(localized(blurb?.male) || localized(blurb?.female)) || undefined,
    iconUrl: iconOf(media),
  };
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "Beast · Wolf" */
export const creatureKindLine = (creature: Pick<Creature, "type" | "family">): string =>
  [creature.type?.name, creature.family?.name].filter(Boolean).join(" · ");

/** "1 creature", "24 creatures" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;
