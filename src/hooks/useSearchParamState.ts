import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export type SetSearchParamOptions = {
  /** Replace the current history entry instead of pushing (typing, toggles). */
  replace?: boolean;
  /**
   * Keep the current scroll position (default). Filters, sorts and view
   * switches refine the page the user is looking at, so the router must not
   * reset it to the top; pass `false` for a change that starts the page over
   * (a newly submitted search term).
   */
  preventScrollReset?: boolean;
};

const navigateOptions = (
  options: SetSearchParamOptions | undefined,
): { replace: boolean; preventScrollReset: boolean } => ({
  replace: options?.replace ?? false,
  preventScrollReset: options?.preventScrollReset ?? true,
});

export type SearchParamSetter = (
  next: string | null | undefined,
  options?: SetSearchParamOptions,
) => void;

const applyParam = (
  params: URLSearchParams,
  key: string,
  next: string | null | undefined,
  defaultValue: string,
): void => {
  if (
    next === null ||
    next === undefined ||
    next === "" ||
    next === defaultValue
  ) {
    params.delete(key);
  } else {
    params.set(key, next);
  }
};

/**
 * One URL search parameter as state. The URL is the source of truth: the
 * key is removed when the value is empty, null or equals `defaultValue`.
 *
 * `const [q, setQ] = useSearchParamState("q");`
 * `setQ("thunderfury", { replace: true })`
 *
 * Every `set` is a router navigation. Do not bind a controlled input's
 * `value`/`onChange` straight to this pair: keep the keystrokes in local
 * state (`SearchField` `value`/`onChange`) and write the URL from
 * `onDebouncedChange`, then reset the draft in an effect when the URL value
 * changes externally. Toggles, selects and chips can call `set` directly.
 */
export const useSearchParamState = (
  key: string,
  defaultValue = "",
): [string, SearchParamSetter] => {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;

  const set = useCallback<SearchParamSetter>(
    (next, options) => {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          applyParam(params, key, next, defaultValue);
          return params;
        },
        navigateOptions(options),
      );
    },
    [key, defaultValue, setSearchParams],
  );

  return [value, set];
};

export type SearchParamsPatch<D extends Record<string, string>> = Partial<
  Record<keyof D, string | null | undefined>
>;

export type SearchParamsRecordSetter<D extends Record<string, string>> = (
  patch: SearchParamsPatch<D>,
  options?: SetSearchParamOptions,
) => void;

const serializeDefaults = (defaults: Record<string, string>): string =>
  Object.keys(defaults)
    .sort()
    .map((key) => `${key}=${defaults[key]}`)
    .join("&");

/**
 * Several URL search parameters at once, with one navigation per update
 * (so `set({ class: "2", subclass: null })` cannot clobber itself).
 * Keys missing from the URL read as their default; setting a key to its
 * default, "" or null removes it.
 */
export const useSearchParamsRecord = <D extends Record<string, string>>(
  defaults: D,
): [D, SearchParamsRecordSetter<D>] => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Callers usually pass an inline literal; track the latest one by value
  // so the memoised record and setter stay stable across renders.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const defaultsKey = serializeDefaults(defaults);

  const values = useMemo(() => {
    const current = defaultsRef.current;
    const record: Record<string, string> = { ...current };
    Object.keys(current).forEach((key) => {
      const raw = searchParams.get(key);
      if (raw !== null) {
        record[key] = raw;
      }
    });
    return record as D;
  }, [searchParams, defaultsKey]);

  const set = useCallback<SearchParamsRecordSetter<D>>(
    (patch, options) => {
      setSearchParams(
        (previous) => {
          const current = defaultsRef.current;
          const params = new URLSearchParams(previous);
          Object.keys(patch).forEach((key) => {
            applyParam(
              params,
              key,
              patch[key as keyof D],
              current[key] ?? "",
            );
          });
          return params;
        },
        navigateOptions(options),
      );
    },
    [setSearchParams],
  );

  return [values, set];
};

export default useSearchParamState;
