import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { formatNumber, humanizeEnum, toBcp47 } from "@/lib/format";
import type {
  LocalizedString,
  SourceLine,
  ToyItem,
  ToyRecord,
  ToyRef,
  ToySource,
  ToyUseText,
} from "@/features/toys/types";

/*
 * Blizzard's toy data, as the toy box uses it:
 *
 *   toy/index         every toy, toy id + name (1,135 on US); names only
 *   toy/{id}          the item it teaches, its source code and Blizzard's
 *                     own source text ("Vendor: Pogg\nZone: …")
 *   item/{itemId}     the tooltip: the "Use:" text with its cooldown, the
 *                     flavour line, binding and requirements
 *   media/item/{id}   the 56px icon (the Items explorer's shared entry)
 *
 * There is no toy search (search/toy is a 404) and the index carries no
 * sources, so a name search ranks the index locally and the source filter
 * has to read each toy's record (see useToySourceScan).
 */

/** Cards per page: 2, 3, 4 and 6 columns all end on a full row. */
export const TOY_PAGE_SIZE = 24;

/**
 * Every source code the US toy records use (all 1,135 checked), most toys
 * first: Drop 271, Vendor 251, Other 228 … Pet Battle 1. The API publishes
 * no index of them, so the names here are only stand-ins: each is replaced
 * by Blizzard's localized name as soon as a record carrying it has loaded,
 * a code no toy uses drops out of the filter once every toy has been
 * checked, and an unlisted code a record brings is added.
 */
export const TOY_SOURCE_TYPES: ReadonlyArray<ToySource> = [
  { type: "DROP", name: "Drop" },
  { type: "VENDOR", name: "Vendor" },
  { type: "OTHER", name: "Other" },
  { type: "WORLDEVENT", name: "World Event" },
  { type: "QUEST", name: "Quest" },
  { type: "PROFESSION", name: "Profession" },
  { type: "ACHIEVEMENT", name: "Achievement" },
  { type: "PROMOTION", name: "Promotion" },
  { type: "PETSTORE", name: "In-Game Shop" },
  { type: "TRADINGPOST", name: "Trading Post" },
  { type: "DISCOVERY", name: "Discovery" },
  { type: "WILDPET", name: "Pet Battle" },
];

const SOURCE_CODE_PATTERN = /^[A-Z][A-Z_]*$/;

/** A URL `source` value worth trying ("vendor" reads as VENDOR). */
export const toSourceCode = (value: string): string | null => {
  const code = value.trim().toUpperCase();
  return SOURCE_CODE_PATTERN.test(code) ? code : null;
};

/* ------------------------------------------------------------------ */
/* Wire types                                                          */
/* ------------------------------------------------------------------ */

type Reference = { id?: number; name?: LocalizedString };

type TypedReference = { type?: string; name?: LocalizedString };

type IndexResponse = {
  toys?: Array<{ id?: number; name?: LocalizedString }>;
};

type ToyResponse = {
  id: number;
  item?: Reference;
  source?: TypedReference;
  source_description?: LocalizedString;
  should_exclude_if_uncollected?: boolean;
  media?: { id?: number };
};

type DisplayString = { display_string?: LocalizedString };

type ItemResponse = {
  id: number;
  name?: LocalizedString;
  quality?: TypedReference;
  description?: LocalizedString;
  preview_item?: {
    name?: LocalizedString;
    quality?: TypedReference;
    binding?: TypedReference;
    unique_equipped?: LocalizedString;
    spells?: Array<{ spell?: Reference; description?: LocalizedString }>;
    description?: LocalizedString;
    requirements?: Record<string, DisplayString | undefined>;
    sell_price?: { value?: number };
  };
};

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

/** "1 toy", "1,135 toys" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/**
 * Blizzard's text arrives with "\r\n" or "\n" breaks and a blank line
 * between paragraphs. cleanMarkup folds every break into a space, so the
 * text is split first and each piece cleaned on its own.
 */
const splitParagraphs = (value: string): string[] =>
  value
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((paragraph) => cleanMarkup(paragraph))
    .filter((paragraph) => paragraph.length > 0);

/** Blizzard's untranslated-placeholder tags ("[DNT]") carry no information. */
const PLACEHOLDER_LINE = /^\[[A-Z]+\]$/;

const toSourceLine = (line: string): SourceLine | undefined => {
  const text = cleanMarkup(line);
  if (text.length === 0 || PLACEHOLDER_LINE.test(text)) {
    return undefined;
  }
  const colon = text.indexOf(":");
  if (colon <= 0) {
    // A bare "Promotion" or "Black Market Auction House".
    return { value: text };
  }
  const label = text.slice(0, colon).trim();
  const value = text.slice(colon + 1).trim();
  // "Vendor:" with nothing after it is an empty template line: skip it.
  return value.length > 0 ? { label, value } : undefined;
};

/**
 * "Vendor: Pogg\nZone: Tol Barad Peninsula\nCost: 250" as label/value
 * lines. A blank line starts another block (a toy two vendors sell).
 */
export const parseSourceText = (value: string): SourceLine[][] =>
  value
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((block) =>
      block
        .split("\n")
        .map(toSourceLine)
        .filter((line): line is SourceLine => line !== undefined),
    )
    .filter((block) => block.length > 0);

const normalized = (value: string): string => value.trim().toLocaleLowerCase();

/**
 * The card's one line of where a toy comes from: "Pogg · Tol Barad
 * Peninsula" under a Vendor badge. The first line's label is dropped only
 * when it repeats the source's own name; "Treasure: Giant Draenor Clam"
 * under Drop keeps it. Undefined when the text adds nothing to the badge.
 */
export const sourceSummary = (record: ToyRecord): string | undefined => {
  const [first] = record.sourceBlocks;
  const [lead, ...rest] = first ?? [];
  if (!lead) {
    return undefined;
  }
  const sourceName = record.source ? normalized(record.source.name) : "";
  const leadText =
    lead.label === undefined
      ? lead.value
      : normalized(lead.label) === sourceName
        ? lead.value
        : `${lead.label}: ${lead.value}`;
  if (normalized(leadText) === sourceName) {
    return undefined;
  }
  // The zone is the next most telling line; the rest waits for the dialog.
  const zone = rest.find((line) => line.label !== undefined && /^zone$/i.test(line.label));
  return zone ? `${leadText} · ${zone.value}` : leadText;
};

/** " (1 Hr Cooldown)" closing the effect; English only (the word is the tell). */
const COOLDOWN_PATTERN = /\s*\(([^()]*\bCooldown)\)\s*$/i;

/**
 * A toy item's "Use:" description. Blizzard words it as the line that files
 * the toy away, a blank line, then the toy's own effect; a description
 * without that break is all effect.
 */
export const parseUseText = (value: string): ToyUseText | undefined => {
  const paragraphs = splitParagraphs(value);
  if (paragraphs.length === 0) {
    return undefined;
  }
  const [first, ...rest] = paragraphs;
  const learn = rest.length > 0 ? first : undefined;
  const effect = rest.length > 0 ? rest : [first];
  const last = effect[effect.length - 1];
  const match = COOLDOWN_PATTERN.exec(last);
  if (!match) {
    return { learn, effect };
  }
  const trimmed = last.slice(0, match.index).trim();
  return {
    learn,
    effect: trimmed.length > 0 ? [...effect.slice(0, -1), trimmed] : effect.slice(0, -1),
    cooldown: match[1].trim(),
  };
};

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

const collator = new Intl.Collator(toBcp47(env.locale), { sensitivity: "base" });

/** A to Z in the page's locale; namesakes (the two Tol Barad Searchlights) by id. */
export const compareToyNames = (left: ToyRef, right: ToyRef): number =>
  collator.compare(left.name, right.name) || left.id - right.id;

/** Toy ids grow as toys are added, so the highest are the newest. */
export const compareNewest = (left: ToyRef, right: ToyRef): number => right.id - left.id;

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

const toyName = (id: number): string => `Toy #${id}`;

/** Every toy in Blizzard's order (the page sorts); one request, names only. */
export const fetchToyIndex = async (signal?: AbortSignal): Promise<ToyRef[]> => {
  const response = await blizzardClient.get<IndexResponse>(
    "/data/wow/toy/index",
    { namespace: namespace("static") },
    { signal },
  );
  const seen = new Set<number>();
  return (response.toys ?? []).flatMap((entry) => {
    if (typeof entry.id !== "number" || seen.has(entry.id)) {
      return [];
    }
    seen.add(entry.id);
    return [{ id: entry.id, name: localized(entry.name) || toyName(entry.id) }];
  });
};

const toSource = (reference: TypedReference | undefined): ToySource | undefined =>
  reference?.type
    ? { type: reference.type, name: localized(reference.name) || humanizeEnum(reference.type) }
    : undefined;

/**
 * One toy, or null when Blizzard has no record for it (an old or foreign
 * link). A record without an item id is no use to the page and counts as
 * missing too.
 */
export const fetchToy = async (toyId: number, signal?: AbortSignal): Promise<ToyRecord | null> => {
  const response = await optional404(() =>
    blizzardClient.get<ToyResponse>(
      `/data/wow/toy/${toyId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  const itemId = response?.item?.id ?? response?.media?.id;
  if (!response || typeof itemId !== "number") {
    return null;
  }
  return {
    id: response.id,
    name: localized(response.item?.name) || toyName(response.id),
    itemId,
    source: toSource(response.source),
    sourceBlocks: parseSourceText(localized(response.source_description)),
    excludeIfUncollected: response.should_exclude_if_uncollected === true,
  };
};

const text = (value: LocalizedString | undefined): string | undefined =>
  cleanMarkup(localized(value)) || undefined;

/** The game's order for requirement lines; any others follow. */
const REQUIREMENT_ORDER = [
  "playable_races",
  "playable_classes",
  "faction",
  "level",
  "skill",
  "reputation",
  "ability",
];

const requirementLines = (
  requirements: Record<string, DisplayString | undefined> | undefined,
): string[] => {
  if (!requirements) {
    return [];
  }
  const rank = (key: string): number => {
    const index = REQUIREMENT_ORDER.indexOf(key);
    return index < 0 ? REQUIREMENT_ORDER.length : index;
  };
  return Object.keys(requirements)
    .sort((left, right) => rank(left) - rank(right))
    .map((key) => text(requirements[key]?.display_string))
    .filter((line): line is string => line !== undefined);
};

/**
 * The toy's item: its tooltip as the dialog and the spotlight show it, or
 * null when Blizzard has no such item.
 */
export const fetchToyItem = async (itemId: number, signal?: AbortSignal): Promise<ToyItem | null> => {
  const response = await optional404(() =>
    blizzardClient.get<ItemResponse>(
      `/data/wow/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }
  const preview = response.preview_item ?? {};
  const sellPrice = preview.sell_price?.value;
  return {
    id: response.id,
    name: localized(response.name) || localized(preview.name) || `Item #${response.id}`,
    quality: toSource(response.quality ?? preview.quality),
    binding: text(preview.binding?.name),
    unique: text(preview.unique_equipped),
    uses: (preview.spells ?? [])
      .map((spell) => parseUseText(localized(spell.description)))
      .filter((use): use is ToyUseText => use !== undefined),
    description: text(preview.description) ?? text(response.description),
    requirements: requirementLines(preview.requirements),
    sellPrice:
      typeof sellPrice === "number" && Number.isFinite(sellPrice) && sellPrice > 0
        ? sellPrice
        : undefined,
  };
};
