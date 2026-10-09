import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import { formatNumber } from "@/lib/format";
import type {
  Essence,
  EssenceGroup,
  EssencePower,
  EssenceSummary,
  HeartItem,
  NamedRef,
  PowerSpell,
  RoleType,
  Specialization,
} from "@/features/azeriteEssences/types";

/*
 * Blizzard serves the Heart of Azeroth's essences as static data: 28 on US,
 * each with four ranks of a major and a minor power. The essence search
 * names every essence with its allowed specializations in one request (the
 * index only names them), which is what lets the page filter and group the
 * whole roster up front; the records with the powers load per card. Roles
 * and classes come from the specialization records, which the essences
 * name without either.
 */

type Reference = { id?: number; name?: LocalizedString };

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

type SearchResponse = {
  page?: number;
  pageCount?: number;
  results?: Array<{
    key?: { href?: string };
    data?: {
      name?: LocalizedString;
      allowed_specializations?: Reference[];
    };
  }>;
};

type EssenceResponse = {
  id: number;
  name?: LocalizedString;
  allowed_specializations?: Reference[];
  powers?: Array<{
    id: number;
    rank?: number;
    main_power_spell?: Reference;
    passive_power_spell?: Reference;
  }>;
};

type SpecializationResponse = {
  id: number;
  name?: LocalizedString;
  playable_class?: Reference;
  role?: { type?: string; name?: LocalizedString };
};

type SpellResponse = {
  id: number;
  name?: LocalizedString;
  description?: LocalizedString;
};

type ItemResponse = {
  id: number;
  name?: LocalizedString;
  quality?: { type?: string; name?: LocalizedString };
  preview_item?: {
    spells?: Array<{ description?: LocalizedString }>;
  };
};

/** The search's documents carry no id field; their record link does. */
const ESSENCE_HREF_ID = /\/azerite-essence\/(\d+)(?:[/?#]|$)/;

/** Blizzard's documented page cap; 28 essences fit in one page. */
const SEARCH_PAGE_SIZE = 100;
/** A runaway pageCount must not page forever. */
const MAX_SEARCH_PAGES = 5;

/**
 * The Heart of Azeroth, the neck item essences were slotted into. Its id is
 * game knowledge; its name, quality and icon come from Blizzard.
 */
export const HEART_OF_AZEROTH_ITEM_ID = 158075;

export const ROLE_ORDER: readonly RoleType[] = ["TANK", "HEALER", "DAMAGE"];

/** English names for a role whose spec records have not named it. */
const ROLE_FALLBACK_NAMES: Record<RoleType, string> = {
  TANK: "Tank",
  HEALER: "Healer",
  DAMAGE: "Damage",
};

export const isRoleType = (value: unknown): value is RoleType =>
  value === "TANK" || value === "HEALER" || value === "DAMAGE";

/** "1 essence", "28 essences" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

const toRef = (reference: Reference | undefined): NamedRef | null =>
  typeof reference?.id === "number"
    ? { id: reference.id, name: localized(reference.name) }
    : null;

const toRefs = (references: Reference[] | undefined): NamedRef[] =>
  (references ?? [])
    .map(toRef)
    .filter((reference): reference is NamedRef => reference !== null);

const iconOf = (media: MediaResponse | undefined): string | null =>
  media?.assets?.find((asset) => asset.key === "icon")?.value ??
  media?.assets?.[0]?.value ??
  null;

/* ------------------------------------------------------------------ */
/* Essences                                                            */
/* ------------------------------------------------------------------ */

const fetchSearchPage = (page: number, signal?: AbortSignal): Promise<SearchResponse> =>
  blizzardClient.get<SearchResponse>(
    "/data/wow/search/azerite-essence",
    { namespace: namespace("static"), _pageSize: SEARCH_PAGE_SIZE, _page: page },
    { signal },
  );

/**
 * Every essence with its allowed specializations. The search answers with
 * every locale's name (it ignores `locale`), about 150 KB on US before
 * compression: still far cheaper than 28 records just to learn who can use
 * each essence.
 */
export const fetchEssenceList = async (signal?: AbortSignal): Promise<EssenceSummary[]> => {
  const first = await fetchSearchPage(1, signal);
  const pages = [first];
  const pageCount = Math.min(first.pageCount ?? 1, MAX_SEARCH_PAGES);
  for (let page = 2; page <= pageCount; page += 1) {
    pages.push(await fetchSearchPage(page, signal));
  }

  const byId = new Map<number, EssenceSummary>();
  pages.forEach((response) => {
    (response.results ?? []).forEach((result) => {
      const match = ESSENCE_HREF_ID.exec(result.key?.href ?? "");
      const id = match ? Number(match[1]) : NaN;
      if (!Number.isInteger(id) || id <= 0 || byId.has(id)) {
        return;
      }
      byId.set(id, {
        id,
        name: localized(result.data?.name) || `Essence #${id}`,
        specs: toRefs(result.data?.allowed_specializations),
      });
    });
  });
  return [...byId.values()];
};

const toPower = (raw: NonNullable<EssenceResponse["powers"]>[number]): EssencePower => ({
  id: raw.id,
  rank: raw.rank ?? 0,
  major: toRef(raw.main_power_spell),
  minor: toRef(raw.passive_power_spell),
});

/** An essence record, or null when Blizzard has none by that id. */
export const fetchEssence = async (
  essenceId: number,
  signal?: AbortSignal,
): Promise<Essence | null> => {
  const response = await optional404(() =>
    blizzardClient.get<EssenceResponse>(
      `/data/wow/azerite-essence/${essenceId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }
  return {
    id: response.id,
    name: localized(response.name) || `Essence #${essenceId}`,
    specs: toRefs(response.allowed_specializations),
    powers: (response.powers ?? []).map(toPower).sort((left, right) => left.rank - right.rank),
  };
};

/** An essence's 56px icon, or null when Blizzard has no media for it. */
export const fetchEssenceIcon = async (
  essenceId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/azerite-essence/${essenceId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return iconOf(media);
};

/* ------------------------------------------------------------------ */
/* Specializations                                                     */
/* ------------------------------------------------------------------ */

/** A specialization's class and role, or null when Blizzard has no such spec. */
export const fetchSpecialization = async (
  specId: number,
  signal?: AbortSignal,
): Promise<Specialization | null> => {
  const response = await optional404(() =>
    blizzardClient.get<SpecializationResponse>(
      `/data/wow/playable-specialization/${specId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }
  const role = response.role?.type;
  return {
    id: response.id,
    name: localized(response.name) || `Spec #${specId}`,
    playableClass: toRef(response.playable_class),
    role: isRoleType(role) ? role : null,
    roleName: localized(response.role?.name),
  };
};

export const fetchSpecIcon = async (
  specId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/playable-specialization/${specId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return iconOf(media);
};

/* ------------------------------------------------------------------ */
/* Power spells                                                        */
/* ------------------------------------------------------------------ */

/**
 * Tooltip paragraphs: Blizzard separates them with blank lines (CRLF), which
 * `cleanMarkup` would fold into one run of text.
 */
const toParagraphs = (description: string): string[] =>
  description
    .split(/(?:\r?\n){2,}/)
    .map((paragraph) => cleanMarkup(paragraph))
    .filter((paragraph) => paragraph.length > 0);

/**
 * A power's spell record and icon, side by side: the spell's media id is its
 * own id for every essence power probed, so the two need not wait on each
 * other. Null when Blizzard has no record of the spell.
 */
export const fetchPowerSpell = async (
  spellId: number,
  signal?: AbortSignal,
): Promise<PowerSpell | null> => {
  const [spell, media] = await Promise.all([
    optional404(() =>
      blizzardClient.get<SpellResponse>(
        `/data/wow/spell/${spellId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
    optional404(() =>
      blizzardClient.get<MediaResponse>(
        `/data/wow/media/spell/${spellId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  ]);
  if (!spell) {
    return null;
  }
  return {
    id: spell.id,
    name: localized(spell.name) || `Spell #${spellId}`,
    paragraphs: toParagraphs(localized(spell.description)),
    iconUrl: iconOf(media),
  };
};

/* ------------------------------------------------------------------ */
/* The Heart of Azeroth                                                */
/* ------------------------------------------------------------------ */

export const fetchHeartItem = async (signal?: AbortSignal): Promise<HeartItem | null> => {
  const response = await optional404(() =>
    blizzardClient.get<ItemResponse>(
      `/data/wow/item/${HEART_OF_AZEROTH_ITEM_ID}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }
  return {
    id: response.id,
    name: localized(response.name) || "Heart of Azeroth",
    qualityType: response.quality?.type ?? null,
    qualityName: localized(response.quality?.name),
    effect: cleanMarkup(localized(response.preview_item?.spells?.[0]?.description)),
  };
};

/* ------------------------------------------------------------------ */
/* Roles and groups                                                    */
/* ------------------------------------------------------------------ */

/** The roles an essence's known specializations play, in Tank, Healer, Damage order. */
export const rolesOf = (
  essence: EssenceSummary,
  specs: ReadonlyMap<number, Specialization>,
): RoleType[] => {
  const roles = new Set<RoleType>();
  essence.specs.forEach((ref) => {
    const role = specs.get(ref.id)?.role;
    if (role) {
      roles.add(role);
    }
  });
  return ROLE_ORDER.filter((role) => roles.has(role));
};

/** Distinct classes among an essence's known specializations. */
export const classCountOf = (
  essence: EssenceSummary,
  specs: ReadonlyMap<number, Specialization>,
): number => {
  const classes = new Set<number>();
  essence.specs.forEach((ref) => {
    const classId = specs.get(ref.id)?.playableClass?.id;
    if (classId !== undefined) {
      classes.add(classId);
    }
  });
  return classes.size;
};

/** Blizzard's name for each role, from the first spec record that plays it. */
export const roleNamesOf = (
  specs: ReadonlyMap<number, Specialization>,
): Record<RoleType, string> => {
  const names = { ...ROLE_FALLBACK_NAMES };
  const named = new Set<RoleType>();
  specs.forEach((spec) => {
    if (spec.role && spec.roleName && !named.has(spec.role)) {
      names[spec.role] = spec.roleName;
      named.add(spec.role);
    }
  });
  return names;
};

/**
 * Highest id first. Blizzard's ids loosely follow when essences were added,
 * but the API carries no date, and essences that launched together are in
 * no real order, so the page only says "highest essence ID first".
 */
export const byNewest = (left: EssenceSummary, right: EssenceSummary): number =>
  right.id - left.id;

/**
 * The roster split by the roles that can use each essence. Essences open to
 * more roles come first (the ones anyone could slot), then the single-role
 * groups in Tank, Healer, Damage order; essences whose specializations
 * could not be read go last.
 */
export const groupByRoles = (
  essences: readonly EssenceSummary[],
  specs: ReadonlyMap<number, Specialization>,
): EssenceGroup[] => {
  const groups = new Map<string, EssenceGroup>();
  essences.forEach((essence) => {
    const roles = rolesOf(essence, specs);
    const key = roles.length > 0 ? roles.join("+") : "UNKNOWN";
    const group = groups.get(key) ?? { key, roles, essences: [] };
    group.essences.push(essence);
    groups.set(key, group);
  });
  const rank = (group: EssenceGroup): number[] =>
    group.roles.length === 0
      ? [Number.MAX_SAFE_INTEGER]
      : [-group.roles.length, ...group.roles.map((role) => ROLE_ORDER.indexOf(role))];
  return [...groups.values()]
    .map((group) => ({ ...group, essences: [...group.essences].sort(byNewest) }))
    .sort((left, right) => {
      const a = rank(left);
      const b = rank(right);
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const delta = (a[index] ?? 0) - (b[index] ?? 0);
        if (delta !== 0) {
          return delta;
        }
      }
      return 0;
    });
};

/** "Every role", "Tank", "Tank & Damage"; the caller adds the noun. */
export const describeRoles = (
  roles: readonly RoleType[],
  names: Record<RoleType, string>,
): string => {
  if (roles.length === ROLE_ORDER.length) {
    return "Every role";
  }
  return roles.map((role) => names[role]).join(" & ");
};

/** The power names an essence shows, from its first rank (they hold across ranks). */
export const powerNamesOf = (
  essence: Essence | null | undefined,
): { major: string | null; minor: string | null } => {
  const first = essence?.powers[0];
  return {
    major: first?.major?.name || null,
    minor: first?.minor?.name || null,
  };
};

/** Every distinct power name of an essence, for the search. */
export const searchablePowerNames = (essence: Essence): string[] => {
  const names = new Set<string>();
  essence.powers.forEach((power) => {
    if (power.major?.name) {
      names.add(power.major.name);
    }
    if (power.minor?.name) {
      names.add(power.minor.name);
    }
  });
  names.delete(essence.name);
  return [...names];
};
