import type { SearchParamsRecordSetter } from "@/hooks/useSearchParamState";

/*
 * Everything a view of the page needs to be shared: the mode, the Sets
 * view's search, name filter and page, the Appearances view's slot, order
 * and page, and the open set and appearance (both can be open: a piece of a
 * set opens over its set).
 */
export const URL_DEFAULTS = {
  mode: "",
  q: "",
  type: "",
  slot: "",
  sort: "",
  page: "",
  set: "",
  appearance: "",
};

export type AppearanceParams = typeof URL_DEFAULTS;

export type AppearanceParamsSetter = SearchParamsRecordSetter<AppearanceParams>;

export type BrowseMode = "sets" | "appearances";

/** `mode` in the URL: empty for the Sets view (the landing), `appearances` otherwise. */
export const parseMode = (value: string): BrowseMode =>
  value === "appearances" ? "appearances" : "sets";
