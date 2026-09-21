import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

import {
  NAV_ITEMS,
  findNavItemByPath,
} from "@/components/layout/navigation/navConfig";
import type { IndexedNavItem } from "@/components/layout/navigation/navConfig";

/*
 * Cross-package contract
 * ----------------------
 * Every explorer page imported by CATEGORY_REGISTRY accepts
 * `CategoryExplorerProps` and forwards `eyebrow` / `breadcrumbs` to its own
 * `<PageHeader>`. The explorer renders the route's single h1; it must not
 * render a second page-level heading, and CategoryPage renders none of its
 * own. Until an explorer adopts the props they are ignored at runtime (the
 * loose cast in `define` keeps tsc clean either way).
 *
 * This module is pure TS + React.lazy: no MUI, no catalog import. The API
 * catalog is only reachable through the lazily loaded CategoryFamilyFallback.
 */

export type PageHeaderBreadcrumb = { label: string; to?: string };

/** Props every category explorer receives from CategoryPage. Explorers forward them to PageHeader. */
export type CategoryExplorerProps = {
  /** Nav section label, e.g. "Collectibles & Gear". */
  eyebrow?: string;
  /** [{label:"Home",to:"/"},{label:section.label},{label:navItem.label}] */
  breadcrumbs?: PageHeaderBreadcrumb[];
};

/** A nav item (which carries its apiCatalog `slug` and route `path`) plus its section. */
export type { IndexedNavItem };

type ExplorerModule<P> = { default: ComponentType<P> };

type LazyEntry<K extends string, P> = {
  /** Discriminant: lets CategoryPage narrow the fallback (which needs `item`). */
  kind: K;
  slug: string;
  load: () => Promise<ExplorerModule<P>>;
  Component: LazyExoticComponent<ComponentType<P>>;
};

/** A dedicated explorer page (items, spells, mounts, ...). */
export type CategoryEntry = LazyEntry<"explorer", CategoryExplorerProps>;

export type FamilyFallbackProps = CategoryExplorerProps & {
  item: IndexedNavItem;
};

/** The catch-all module for nav slugs without a dedicated explorer. */
export type FamilyFallbackEntry = LazyEntry<"fallback", FamilyFallbackProps>;

export type ResolvedCategoryEntry = CategoryEntry | FamilyFallbackEntry;

const CATEGORY_PATH_PREFIX = "/category/";

/**
 * Every nav item with its section. Only items whose `path` starts with
 * "/category/" are routable here; the others (achievements, connected realms)
 * stay in the index so "did you mean" can still suggest them.
 */
export const NAV_ITEM_INDEX: readonly IndexedNavItem[] = NAV_ITEMS;

export const normalizeSlug = (raw: string | undefined): string => {
  let decoded = raw ?? "";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Malformed escape sequence: fall through with the raw value.
  }
  return decoded.replace(/\/+$/, "").trim().toLowerCase();
};

/**
 * The nav item routed at `/category/<slug>`. Distinct from navConfig's
 * `findNavItemBySlug`, which matches `item.slug` and would also return items
 * routed elsewhere (achievements, connected realms).
 */
export const findRoutableCategoryItem = (
  slug: string,
): IndexedNavItem | undefined =>
  findNavItemByPath(`${CATEGORY_PATH_PREFIX}${slug}`);

export const buildCategoryHeaderProps = (
  item: IndexedNavItem,
): Required<CategoryExplorerProps> => ({
  eyebrow: item.section.label,
  breadcrumbs: [
    { label: "Home", to: "/" },
    { label: item.section.label },
    { label: item.label },
  ],
});

/**
 * Builds a registry entry. The import is cast so a component typed
 * `() => JSX.Element` and one typed with `CategoryExplorerProps` both compile.
 */
const define = <K extends string, P>(
  kind: K,
  slug: string,
  load: () => Promise<unknown>,
): LazyEntry<K, P> => {
  const typedLoad = load as () => Promise<ExplorerModule<P>>;
  return { kind, slug, load: typedLoad, Component: lazy(typedLoad) };
};

const explorer = (
  slug: string,
  load: () => Promise<unknown>,
): CategoryEntry => define("explorer", slug, load);

export const CATEGORY_REGISTRY: Record<string, CategoryEntry> = {
  items: explorer("items", () => import("@/features/items/components/ItemsPage")),
  spells: explorer(
    "spells",
    () => import("@/features/spells/components/SpellsPage"),
  ),
  mounts: explorer(
    "mounts",
    () => import("@/features/mounts/components/MountsPage"),
  ),
  realm: explorer("realm", () => import("@/features/realms/components/RealmsPage")),
  "auction-house": explorer(
    "auction-house",
    () => import("@/features/auctionHouse/components/AuctionHousePage"),
  ),
  covenant: explorer(
    "covenant",
    () => import("@/features/covenants/components/CovenantPage"),
  ),
  "azerite-essence": explorer(
    "azerite-essence",
    () => import("@/features/azeriteEssences/components/AzeriteEssencePage"),
  ),
  "wow-token": explorer("wow-token", () => import("@/pages/WowTokenRoute")),
};

/**
 * Catch-all for nav slugs without a dedicated explorer: API dataset gallery,
 * endpoint family gallery, the creatures search view, or an "in progress"
 * empty state. It is the only module in this graph that imports the catalog.
 */
export const FAMILY_FALLBACK: FamilyFallbackEntry = define(
  "fallback",
  "__family__",
  () => import("@/pages/CategoryFamilyFallback"),
);

export const resolveCategoryEntry = (slug: string): ResolvedCategoryEntry =>
  CATEGORY_REGISTRY[slug] ?? FAMILY_FALLBACK;

const preloadCache = new Map<string, Promise<unknown>>();

/**
 * The chunk CategoryFamilyFallback will lazily render for `slug`, decided from
 * the nav item's status so no catalog import is needed here. Started alongside
 * the fallback chunk so the route pays one round trip instead of three.
 */
const preloadFallbackContent = (slug: string): Promise<unknown> | undefined => {
  if (slug === "creatures") {
    return import("@/features/search/components/SearchExperience");
  }
  if (findRoutableCategoryItem(slug)?.status === "gallery") {
    return import("@/features/apiExplorer/components/ApiDatasetGalleryPage");
  }
  return undefined;
};

/**
 * Starts fetching the explorer chunk for `slug` once. Safe to call on hover /
 * focus from the header or the home showcase; a failed load is forgotten so a
 * later attempt can retry.
 */
export const preloadCategory = (slug: string): void => {
  if (preloadCache.has(slug)) {
    return;
  }
  const entry = resolveCategoryEntry(slug);
  const nested =
    entry.kind === "fallback" ? preloadFallbackContent(slug) : undefined;
  const pending = Promise.all([entry.load(), nested]).catch(() => {
    preloadCache.delete(slug);
    return undefined;
  });
  preloadCache.set(slug, pending);
};

/** Iterative two-row Levenshtein distance. */
const levenshtein = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length];
};

const MAX_EDIT_DISTANCE = 2;
const MIN_SUBSTRING_LENGTH = 3;

const scoreSuggestion = (
  item: IndexedNavItem,
  slug: string,
): number | undefined => {
  if (item.slug === slug) {
    return 0;
  }
  if (
    item.slug.startsWith(slug) ||
    slug.startsWith(item.slug) ||
    item.id === slug ||
    item.label.toLowerCase() === slug
  ) {
    return 1;
  }
  if (
    slug.length >= MIN_SUBSTRING_LENGTH &&
    (item.slug.includes(slug) || slug.includes(item.slug))
  ) {
    return 2;
  }
  const distance = Math.min(
    levenshtein(slug, item.slug),
    levenshtein(slug, item.id),
  );
  return distance <= MAX_EDIT_DISTANCE ? 3 + distance : undefined;
};

export type CategorySuggestion = { label: string; to: string };

/** Up to `limit` nav items closest to a mistyped slug ("mount" -> Mount, "pets" -> Battle Pet). */
export const suggestCategories = (
  slug: string,
  limit = 3,
): CategorySuggestion[] => {
  if (!slug) {
    return [];
  }

  return NAV_ITEM_INDEX.flatMap((item) => {
    const score = scoreSuggestion(item, slug);
    return score === undefined ? [] : [{ item, score }];
  })
    .sort(
      (a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label),
    )
    .slice(0, limit)
    .map(({ item }) => ({ label: item.label, to: item.path }));
};
