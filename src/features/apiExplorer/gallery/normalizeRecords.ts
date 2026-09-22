import type { ApiEndpointDefinition } from "@/features/apiExplorer/types";
import {
  buildPath,
  resolveLocalizedString,
  resolveNamespace,
  resolveParameterKey,
  summarizeEntry,
} from "@/features/apiExplorer/utils";
import type { SearchResult, SearchResultMeta } from "@/features/search/types";
import { env, getApiBaseUrl, shouldUseBlizzardProxy } from "@/lib/env";
import { getExternalLink } from "@/lib/externalLinks";
import { humanizeEnum } from "@/lib/format";

import type {
  DatasetProfile,
  GalleryStrategyId,
} from "@/features/apiExplorer/gallery/mediaStrategies";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type GalleryCard = SearchResult & {
  /** Unique across sections: `${endpointId}-${id}-${index}`. */
  key: string;
  sectionId: string;
  mediaRequestPath?: string;
  mediaRequestNamespace?: string;
  mediaRequestStrategy?: GalleryStrategyId;
  /** Filled by enrichment; drives the Wowhead link for talents. */
  spellId?: number;
  /** Filled by enrichment; drives the Wowhead link for heirlooms. */
  itemId?: number;
};

export type GallerySection = {
  id: string;
  label: string;
  cards: GalleryCard[];
  /** Deduped card count: the population every visible count describes. */
  totalEntries: number;
  /** The index request has not settled yet (no data, no error). */
  pending: boolean;
};

export type EndpointRequestDetails = {
  requestPath: string;
  queryParams: Record<string, string>;
  namespace: string | undefined;
};

export type RecordDetails = {
  /** " • "-joined facts for the card meta line. */
  details?: string;
  /** The same facts as labelled rows for the detail dialog. */
  meta: SearchResultMeta[];
};

const UNKNOWN_ENTRY = "Unknown entry";

/**
 * Shared name comparator: one ICU collator instead of a `localeCompare` per
 * comparison, with numeric ordering ("Rank 2" before "Rank 10").
 */
export const NAME_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export const compareCardNames = (a: GalleryCard, b: GalleryCard): number =>
  NAME_COLLATOR.compare(a.name, b.name);

/** DOM id of a section's SectionCard (jump chips, fragment links). */
export const gallerySectionDomId = (sectionId: string): string =>
  `gallery-section-${sectionId}`;

/* ------------------------------------------------------------------ */
/* Basic guards                                                        */
/* ------------------------------------------------------------------ */

export const asRecord = (
  value: unknown,
): Record<string, unknown> | undefined =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;

export const asAssetList = (
  value: unknown,
): Array<{ key?: string; value?: string }> =>
  Array.isArray(value)
    ? (value as Array<{ key?: string; value?: string }>)
    : [];

export const extractNumericPathSegment = (
  href: unknown,
  pattern: RegExp,
): number | undefined => {
  if (typeof href !== "string") {
    return undefined;
  }

  const match = href.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
};

/* ------------------------------------------------------------------ */
/* Power type icons (Blizzard exposes no media endpoint for them)      */
/* ------------------------------------------------------------------ */

export const POWER_TYPE_ICON_NAMES: Record<number, string> = {
  0: "inv_elemental_mote_mana",
  1: "ability_warrior_rampage",
  2: "ability_hunter_focusfire",
  3: "ability_rogue_quickrecovery",
  4: "ability_rogue_eviscerate",
  5: "spell_deathknight_frozenruneweapon",
  6: "spell_deathknight_runetap",
  7: "inv_misc_gem_amethyst_02",
  8: "spell_nature_starfall",
  9: "spell_holy_divinepurpose",
  10: "spell_nature_lightning",
  11: "spell_shaman_maelstromweapon",
  12: "ability_monk_chiswirl",
  13: "spell_priest_voidtendrils",
  16: "spell_arcane_arcane01",
  17: "ability_demonhunter_eyebeam",
  18: "ability_demonhunter_fierybrand",
  19: "ability_evoker_essenceburst",
  23: "inv_misc_questionmark",
  24: "achievement_boss_lichking",
  25: "ability_mount_drake_blue",
};

export const buildRenderIconUrl = (iconName: string): string =>
  `https://render.worldofwarcraft.com/${env.region}/icons/56/${iconName}.jpg`;

/* ------------------------------------------------------------------ */
/* Endpoint request                                                    */
/* ------------------------------------------------------------------ */

export const resolveEndpointRequest = (
  endpoint: ApiEndpointDefinition,
): EndpointRequestDetails => {
  const values = Object.fromEntries(
    (endpoint.parameters ?? []).map((parameter) => [
      parameter.key,
      parameter.defaultValue ?? "",
    ]),
  );

  const queryParams = Object.fromEntries(
    (endpoint.parameters ?? [])
      .filter((parameter) => parameter.location === "query")
      .map((parameter) => [
        resolveParameterKey(parameter.key),
        (values[parameter.key] ?? "").trim(),
      ])
      .filter((entry) => entry[1].length > 0),
  );

  return {
    requestPath: buildPath(endpoint.path, values),
    queryParams,
    namespace: resolveNamespace(endpoint.namespace),
  };
};

/* ------------------------------------------------------------------ */
/* Response shape                                                      */
/* ------------------------------------------------------------------ */

export const extractEntries = (data: unknown): unknown[] => {
  const record = asRecord(data);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.results)) {
    return record.results;
  }

  const firstArray = Object.values(record).find((value) =>
    Array.isArray(value),
  );
  return Array.isArray(firstArray) ? firstArray : [];
};

export const extractRecord = (
  entry: unknown,
): Record<string, unknown> | undefined => {
  const record = asRecord(entry);
  if (!record) {
    return undefined;
  }

  const dataRecord = asRecord(record.data);
  return dataRecord ?? record;
};

const MEDIA_URL_PATTERN =
  /render\.worldofwarcraft\.com|\/(icons|media)\/|\.(png|jpe?g|webp)$/i;
const DIRECT_IMAGE_PATTERN =
  /render\.worldofwarcraft\.com|\.(png|jpe?g|webp)$/i;

export const extractDirectMediaUrl = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return MEDIA_URL_PATTERN.test(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractDirectMediaUrl(entry);
      if (nested) {
        return nested;
      }
    }

    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const directAsset = asAssetList(record.assets)
    .map((asset) => asset.value)
    .find(
      (asset): asset is string => typeof asset === "string" && asset.length > 0,
    );

  if (directAsset) {
    return directAsset;
  }

  const directCandidates = [
    typeof record.icon === "string" ? record.icon : undefined,
    typeof record.image === "string" ? record.image : undefined,
    typeof record.href === "string" ? record.href : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const directMatch = directCandidates.find((candidate) =>
    DIRECT_IMAGE_PATTERN.test(candidate),
  );
  if (directMatch) {
    return directMatch;
  }

  for (const nested of Object.values(record)) {
    const nestedUrl = extractDirectMediaUrl(nested);
    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return undefined;
};

export const resolveCardMediaUrl = (
  profile: DatasetProfile | undefined,
  record: Record<string, unknown>,
): string | undefined =>
  profile?.staticMediaUrl?.(record) ?? extractDirectMediaUrl(record);

/* ------------------------------------------------------------------ */
/* Href                                                                */
/* ------------------------------------------------------------------ */

export const normalizeApiHref = (
  href: string,
  namespace: string | undefined,
): string => {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  const normalizedPath = href.startsWith("/") ? href : `/${href}`;

  if (shouldUseBlizzardProxy()) {
    const params = new URLSearchParams();
    if (namespace) {
      params.set("namespace", namespace);
    }
    params.set("locale", env.locale);
    return `${env.proxyPath}${normalizedPath}?${params.toString()}`;
  }

  const url = new URL(normalizedPath, getApiBaseUrl());
  if (namespace) {
    url.searchParams.set("namespace", namespace);
  }
  url.searchParams.set("locale", env.locale);
  return url.toString();
};

export const extractHref = (
  entry: unknown,
  fallbackPath: string,
  namespace: string | undefined,
): string => {
  const outer = asRecord(entry);
  const record = extractRecord(entry);

  const hrefCandidates = [
    asRecord(outer?.key)?.href,
    asRecord(record?._links)?.self &&
      asRecord(asRecord(record?._links)?.self)?.href,
    asRecord(record?.key)?.href,
    record?.href,
  ];

  const href = hrefCandidates.find(
    (candidate) => typeof candidate === "string" && candidate.length > 0,
  );
  return normalizeApiHref(
    (href as string | undefined) ?? fallbackPath,
    namespace,
  );
};

/* ------------------------------------------------------------------ */
/* Name / summary / details                                            */
/* ------------------------------------------------------------------ */

/** Enum-looking tokens ("SLOT_TYPE") are humanised; prose is kept as-is. */
const cleanLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return UNKNOWN_ENTRY;
  }

  return /^[A-Z0-9_-]+$/.test(trimmed) ? humanizeEnum(trimmed) : trimmed;
};

export const resolveName = (
  entry: unknown,
  record: Record<string, unknown>,
): string => {
  if (typeof entry === "string") {
    return cleanLabel(entry);
  }

  const displayString = resolveLocalizedString(record.display_string);
  if (displayString) {
    return displayString;
  }

  const directStringCandidates = [
    typeof record.slot_type === "string" ? cleanLabel(record.slot_type) : "",
    typeof record.type === "string" ? cleanLabel(record.type) : "",
    typeof record.category === "string" ? cleanLabel(record.category) : "",
  ];

  const directString = directStringCandidates.find(
    (candidate) => candidate.length > 0,
  );
  if (directString) {
    return directString;
  }

  return summarizeEntry(record);
};

export const buildSummary = (
  record: Record<string, unknown>,
): string | undefined => {
  const candidates = [
    resolveLocalizedString(record.description),
    resolveLocalizedString(asRecord(record.source)?.name),
    resolveLocalizedString(asRecord(record.quality)?.name),
    typeof record.level === "number" ? `Level ${record.level}` : "",
    typeof record.rank === "number" ? `Rank ${record.rank}` : "",
  ].filter((value) => value.length > 0);

  return candidates[0];
};

const NAMED_DETAIL_KEYS: ReadonlyArray<[key: string, label: string]> = [
  ["type", "Type"],
  ["category", "Category"],
  ["slot", "Slot"],
  ["slot_type", "Slot"],
  ["inventory_type", "Slot"],
  ["item_class", "Item class"],
  ["item_subclass", "Item subclass"],
];

/** A `{ name }` sub-record → its localised name, else its humanised `type`. */
const resolveNamedValue = (value: unknown): string => {
  const sub = asRecord(value);
  if (!sub) {
    return "";
  }

  const named = resolveLocalizedString(sub.name);
  if (named.length > 0) {
    return named;
  }

  return typeof sub.type === "string" ? humanizeEnum(sub.type) : "";
};

export const buildDetails = (
  record: Record<string, unknown>,
): RecordDetails => {
  const meta: SearchResultMeta[] = [];
  const seenLabels = new Set<string>();

  const push = (label: string, value: string): void => {
    if (value.length === 0 || seenLabels.has(label)) {
      return;
    }
    seenLabels.add(label);
    meta.push({ label, value });
  };

  if (typeof record.id === "number" || typeof record.id === "string") {
    push("ID", String(record.id));
  }

  for (const [key, label] of NAMED_DETAIL_KEYS) {
    push(label, resolveNamedValue(record[key]));
  }

  if (typeof record.level === "number") {
    push("Level", String(record.level));
  }
  if (typeof record.rank === "number") {
    push("Rank", String(record.rank));
  }

  Object.entries(record)
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .slice(0, 2)
    .forEach(([key, value]) => {
      push(humanizeEnum(key), String((value as unknown[]).length));
    });

  const detailParts = meta
    .filter((entry) => entry.label !== "ID")
    .map((entry) =>
      entry.label === "Level" || entry.label === "Rank"
        ? `${entry.label} ${entry.value}`
        : /^\d+$/.test(entry.value)
          ? `${entry.value} ${entry.label.toLowerCase()}`
          : entry.value,
    );
  const idPart = meta.find((entry) => entry.label === "ID");
  if (idPart) {
    detailParts.push(`ID ${idPart.value}`);
  }

  return {
    details: detailParts.length > 0 ? detailParts.join(" • ") : undefined,
    meta,
  };
};

/* ------------------------------------------------------------------ */
/* Dedupe / sort                                                       */
/* ------------------------------------------------------------------ */

export const dedupeCards = (cards: GalleryCard[]): GalleryCard[] => {
  const seen = new Set<string>();

  return cards.filter((card) => {
    const token = `${card.href}::${card.name}`.toLowerCase();
    if (seen.has(token)) {
      return false;
    }

    seen.add(token);
    return true;
  });
};

export const dedupeCardsByName = (cards: GalleryCard[]): GalleryCard[] => {
  const seen = new Set<string>();

  return cards.filter((card) => {
    const token = card.name.toLowerCase();
    if (seen.has(token)) {
      return false;
    }

    seen.add(token);
    return true;
  });
};

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export const sectionLabelForEndpoint = (
  endpoint: ApiEndpointDefinition,
): string => endpoint.label.replace(/\s+(Index|Search)$/u, "");

export const buildMediaQueryToken = (
  path: string,
  namespace: string | undefined,
): string => `${path}::${namespace ?? ""}`;

/**
 * Index entries → gallery cards for one section. Never capped: the grid is
 * virtualised and media enrichment is bounded by the visible range.
 */
export const normalizeSectionCards = (
  profile: DatasetProfile | undefined,
  entries: unknown[],
  endpoint: ApiEndpointDefinition,
  request: EndpointRequestDetails,
): GalleryCard[] => {
  const typeLabel = sectionLabelForEndpoint(endpoint);

  const cards = dedupeCards(
    entries
      .map((entry, index): GalleryCard => {
        const record = extractRecord(entry) ?? {};
        const name = resolveName(entry, record);
        const mediaRequest = profile?.buildMediaRequest(record, endpoint.id);
        const { details, meta } = buildDetails(record);
        const link = profile?.externalLinkKind
          ? getExternalLink(
              profile.externalLinkKind,
              typeof record.id === "number" ? record.id : undefined,
              name,
            )
          : undefined;

        return {
          key: `${endpoint.id}-${String(record.id ?? name ?? index)}-${index}`,
          sectionId: endpoint.id,
          id: typeof record.id === "number" ? record.id : index,
          name,
          href: extractHref(entry, request.requestPath, request.namespace),
          summary: buildSummary(record),
          details,
          meta: meta.length > 0 ? meta : undefined,
          mediaUrl: resolveCardMediaUrl(profile, record),
          mediaRequestPath: mediaRequest?.path,
          mediaRequestNamespace: mediaRequest?.namespace,
          mediaRequestStrategy: mediaRequest?.strategy,
          typeLabel,
          tag: resolveLocalizedString(asRecord(record.type)?.name) || undefined,
          externalUrl: link?.url,
          externalLabel: link?.label,
        };
      })
      .filter((card) => card.name !== UNKNOWN_ENTRY),
  );

  const displayCards = profile?.dedupeByName?.includes(endpoint.id)
    ? dedupeCardsByName(cards)
    : cards;

  if (profile?.sortByName) {
    displayCards.sort(compareCardNames);
  }

  return displayCards;
};
