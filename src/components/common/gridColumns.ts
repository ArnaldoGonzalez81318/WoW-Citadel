import { useSyncExternalStore } from "react";
import { useTheme } from "@mui/material/styles";
import type { Breakpoint, Theme } from "@mui/material/styles";

import { tokens } from "@/theme";

/**
 * Column counts per breakpoint. Missing keys inherit the nearest smaller
 * breakpoint, so `{ xs: 1, md: 2 }` is 1 column on xs/sm and 2 on md/lg/xl.
 */
export type GridColumns = {
  xs: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

export type GridPresetKey = keyof typeof tokens.wc.columns;

/** The shared card-grid presets from the theme (`theme.wc.columns`). */
export const GRID_PRESETS: Readonly<Record<GridPresetKey, GridColumns>> =
  tokens.wc.columns;

/** DESIGN: never more than 8 columns. */
export const MAX_GRID_COLUMNS = 8;

const clampColumns = (value: number): number =>
  Math.min(MAX_GRID_COLUMNS, Math.max(1, Math.floor(value)));

/** A preset key or an explicit column map → an explicit column map. */
export const resolveGridColumns = (
  columns: GridColumns | GridPresetKey,
): GridColumns =>
  typeof columns === "string" ? GRID_PRESETS[columns] : columns;

/**
 * Column count for `active`, walking down the breakpoint keys until a
 * defined value is found (`xs` is always defined).
 */
export const columnsForBreakpoint = (
  columns: GridColumns,
  active: Breakpoint,
  keys: readonly Breakpoint[],
): number => {
  const startIndex = Math.max(0, keys.indexOf(active));

  for (let index = startIndex; index >= 0; index -= 1) {
    const value = columns[keys[index]];
    if (typeof value === "number") {
      return clampColumns(value);
    }
  }

  return clampColumns(columns.xs);
};

/* ------------------------------------------------------------------ */
/* Breakpoint store (one matchMedia list per theme, shared by all grids) */
/* ------------------------------------------------------------------ */

type BreakpointStore = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => Breakpoint;
  getServerSnapshot: () => Breakpoint;
};

type MediaEntry = {
  key: Breakpoint;
  list: MediaQueryList;
};

const stripMediaPrefix = (query: string): string =>
  query.replace(/^@media\s*/i, "");

const createBreakpointStore = (
  breakpoints: Theme["breakpoints"],
): BreakpointStore => {
  const keys = breakpoints.keys;
  const smallest = keys[0];
  const canMatch =
    typeof window !== "undefined" && typeof window.matchMedia === "function";

  // One list per breakpoint above the smallest; `xs` is the fallback.
  const entries: MediaEntry[] = canMatch
    ? keys.slice(1).map((key) => ({
        key,
        list: window.matchMedia(stripMediaPrefix(breakpoints.up(key))),
      }))
    : [];

  const current = (): Breakpoint => {
    let active: Breakpoint = smallest;
    for (const entry of entries) {
      if (entry.list.matches) {
        active = entry.key;
      }
    }
    return active;
  };

  const listeners = new Set<() => void>();
  let snapshot = current();
  let attached = false;

  const handleChange = (): void => {
    const next = current();
    if (next !== snapshot) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    }
  };

  const attach = (): void => {
    if (attached) {
      return;
    }
    attached = true;
    snapshot = current();
    entries.forEach(({ list }) =>
      list.addEventListener("change", handleChange),
    );
  };

  const detach = (): void => {
    if (!attached) {
      return;
    }
    attached = false;
    entries.forEach(({ list }) =>
      list.removeEventListener("change", handleChange),
    );
  };

  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      attach();
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          detach();
        }
      };
    },
    // Reading `.matches` is synchronous and cheap; while no listener is
    // attached this keeps the snapshot honest instead of stale.
    getSnapshot: () => (attached ? snapshot : current()),
    getServerSnapshot: () => smallest,
  };
};

const storeCache = new WeakMap<Theme["breakpoints"], BreakpointStore>();

const getBreakpointStore = (
  breakpoints: Theme["breakpoints"],
): BreakpointStore => {
  let store = storeCache.get(breakpoints);
  if (!store) {
    store = createBreakpointStore(breakpoints);
    storeCache.set(breakpoints, store);
  }
  return store;
};

/** The active theme breakpoint key from one shared matchMedia subscription. */
export const useBreakpointKey = (): Breakpoint => {
  const theme = useTheme();
  const store = getBreakpointStore(theme.breakpoints);

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
};

/**
 * Current column count for a preset or explicit column map. Re-renders only
 * when the active breakpoint changes (one subscription per theme, not one
 * `useMediaQuery` per breakpoint per grid).
 */
export const useGridColumns = (
  columns: GridColumns | GridPresetKey,
): number => {
  const theme = useTheme();
  const active = useBreakpointKey();

  return columnsForBreakpoint(
    resolveGridColumns(columns),
    active,
    theme.breakpoints.keys,
  );
};

export type GridTemplateColumnsSx = {
  gridTemplateColumns: Partial<Record<Breakpoint, string>>;
};

/**
 * Responsive `gridTemplateColumns` for an sx object:
 * `sx={{ display: "grid", gap: 2, ...gridTemplateColumnsSx("tiles") }}`.
 */
export const gridTemplateColumnsSx = (
  columns: GridColumns | GridPresetKey,
): GridTemplateColumnsSx => {
  const resolved = resolveGridColumns(columns);
  const keys: Breakpoint[] = ["xs", "sm", "md", "lg", "xl"];
  const gridTemplateColumns: Partial<Record<Breakpoint, string>> = {};

  keys.forEach((key) => {
    const value = resolved[key];
    if (typeof value === "number") {
      gridTemplateColumns[key] =
        `repeat(${clampColumns(value)}, minmax(0, 1fr))`;
    }
  });

  return { gridTemplateColumns };
};
