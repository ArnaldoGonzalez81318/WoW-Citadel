import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Route chunk preloaders keyed by route prefix. The import specifiers are
 * EXACTLY the ones App.tsx uses for its lazy routes so Vite dedupes the
 * chunk; a hover on a nav link therefore warms the same module promise the
 * router will await on click. Dynamic imports only: a static import would
 * pull every page into the shell bundle.
 */
type ChunkLoader = (path: string) => Promise<unknown>;

const CATEGORY_PREFIX = "/category/";

const ROUTE_CHUNKS: ReadonlyArray<{
  matches: (path: string) => boolean;
  /** Dedupe key; `perPath` keys by the full path instead (one warm-up per explorer). */
  key: string;
  perPath?: boolean;
  load: ChunkLoader;
}> = [
  {
    key: "category",
    perPath: true,
    matches: (path) => path.startsWith(CATEGORY_PREFIX),
    // CategoryPage is only a thin wrapper: chain into the registry so the
    // explorer chunk it will lazily render downloads in parallel rather than
    // after the wrapper has mounted. The registry is bundled with
    // CategoryPage, so the second import resolves from the same chunk.
    load: (path) =>
      Promise.all([
        import("@/pages/CategoryPage"),
        import("@/pages/categoryRegistry").then((registry) =>
          registry.preloadCategory(
            registry.normalizeSlug(path.slice(CATEGORY_PREFIX.length)),
          ),
        ),
      ]),
  },
  {
    key: "achievements",
    matches: (path) => path === "/achievements",
    load: () => import("@/features/achievements/components/AchievementsPage"),
  },
  {
    key: "connected-realms",
    matches: (path) => path === "/connected-realms",
    load: () =>
      import("@/features/connectedRealms/components/ConnectedRealmsPage"),
  },
  {
    key: "search",
    matches: (path) => path === "/search" || path.startsWith("/search?"),
    load: () => import("@/pages/SearchPage"),
  },
];

const preloaded = new Set<string>();

/**
 * Warms the lazy route chunk for `path` once per session. Failures are
 * swallowed: the router will retry the import on navigation and
 * RouteErrorBoundary handles a genuine chunk-load failure.
 */
export const preloadRouteChunk = (path: string): void => {
  const entry = ROUTE_CHUNKS.find((chunk) => chunk.matches(path));
  if (!entry) {
    return;
  }
  const key = entry.perPath ? path : entry.key;
  if (preloaded.has(key)) {
    return;
  }

  preloaded.add(key);
  entry.load(path).catch(() => {
    // Allow a retry on the next hover if the network hiccupped.
    preloaded.delete(key);
    return undefined;
  });
};

/** Blizzard's Game Data API documentation (footer Resources + mobile drawer). */
export const API_REFERENCE_URL =
  "https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis";

export const buildSearchUrl = (q: string): string =>
  `/search?q=${encodeURIComponent(q.trim())}`;

const TYPING_TAGS: ReadonlySet<string> = new Set([
  "INPUT",
  "TEXTAREA",
  "SELECT",
]);

/** True when a keystroke would be consumed by a text control. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (TYPING_TAGS.has(target.tagName)) {
    return true;
  }

  return target.isContentEditable;
};

/** Hover-intent handlers only apply to a real mouse (never touch or pen). */
export const isMouseLike = (event: ReactPointerEvent<Element>): boolean =>
  event.pointerType === "mouse";
