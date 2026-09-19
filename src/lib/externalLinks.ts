import { getApiBaseUrl } from "@/lib/env";

/**
 * Entity kinds the app knows how to link out for. Mirrors the search
 * result `EntityKind`; unknown strings simply yield no link.
 */
export type ExternalLinkKind =
  | "item"
  | "spell"
  | "mount"
  | "npc"
  | "achievement"
  | "quest"
  | "azerite-essence"
  | "battlepet"
  | "title"
  | "realm"
  | "covenant"
  | "connected-realm"
  | "auction"
  | "generic";

export type ExternalLink = {
  url: string;
  label: string;
};

export const WOWHEAD_ORIGIN = "https://www.wowhead.com";

export const WOWHEAD_LABEL = "View on Wowhead";

/** Kinds Wowhead addresses directly by Blizzard id. */
const WOWHEAD_ID_PATHS: Partial<Record<ExternalLinkKind, string>> = {
  item: "item",
  spell: "spell",
  npc: "npc",
  achievement: "achievement",
  quest: "quest",
};

/** Kinds whose Blizzard id does not match Wowhead's: fall back to a name search. */
const WOWHEAD_SEARCH_KINDS: ReadonlySet<ExternalLinkKind> = new Set<ExternalLinkKind>(
  ["mount", "azerite-essence", "battlepet", "title", "realm"],
);

const isExternalLinkKind = (value: unknown): value is ExternalLinkKind =>
  typeof value === "string" &&
  (value in WOWHEAD_ID_PATHS || WOWHEAD_SEARCH_KINDS.has(value as ExternalLinkKind));

const normaliseId = (id: number | string | null | undefined): string | undefined => {
  if (typeof id === "number") {
    return Number.isInteger(id) && id > 0 ? String(id) : undefined;
  }
  if (typeof id === "string" && /^\d+$/.test(id.trim())) {
    return id.trim();
  }
  return undefined;
};

export const wowheadUrl = (kind: ExternalLinkKind, id: number | string): string | undefined => {
  const path = WOWHEAD_ID_PATHS[kind];
  const value = normaliseId(id);
  return path && value ? `${WOWHEAD_ORIGIN}/${path}=${value}` : undefined;
};

export const wowheadSearchUrl = (name: string): string | undefined => {
  const query = name.trim();
  return query.length > 0
    ? `${WOWHEAD_ORIGIN}/search?q=${encodeURIComponent(query)}`
    : undefined;
};

/**
 * Public page for an entity: Wowhead by id where a URL scheme exists, a
 * Wowhead name search for kinds without one, `undefined` otherwise (realm
 * groups, covenants, auctions, generic API records).
 */
export const getExternalLink = (
  kind: string | null | undefined,
  id?: number | string | null,
  name?: string | null,
): ExternalLink | undefined => {
  if (!isExternalLinkKind(kind)) {
    return undefined;
  }

  const direct = id !== undefined && id !== null ? wowheadUrl(kind, id) : undefined;
  if (direct) {
    return { url: direct, label: WOWHEAD_LABEL };
  }

  if (WOWHEAD_SEARCH_KINDS.has(kind) && name) {
    const url = wowheadSearchUrl(name);
    if (url) {
      return { url, label: WOWHEAD_LABEL };
    }
  }

  return undefined;
};

/**
 * The raw Blizzard API URL for a record (`_links.self.href` / `key.href`),
 * for the API explorer's "Copy API URL". Relative paths are resolved
 * against the configured API base; anything else is returned as-is.
 */
export const getApiRecordUrl = (
  href: string | null | undefined,
): string | undefined => {
  if (typeof href !== "string") {
    return undefined;
  }

  const value = href.trim();
  if (value.length === 0) {
    return undefined;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  try {
    return new URL(value, getApiBaseUrl()).toString();
  } catch {
    return undefined;
  }
};
