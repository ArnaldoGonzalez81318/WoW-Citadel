import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import type {
  ApiEndpointDefinition,
  ApiEndpointParameter,
  ApiFamilyConfig,
} from "@/features/apiExplorer/types";
import {
  buildPath,
  collectUrlStrings,
  matchPathTemplate,
  resolveNamespace,
  resolveParameterKey,
} from "@/features/apiExplorer/utils";
import { blizzardClient } from "@/lib/blizzardClient";
import { env, getApiBaseUrl } from "@/lib/env";

/* ------------------------------------------------------------------ */
/* Request resolution                                                  */
/* ------------------------------------------------------------------ */

export type EndpointRequestDetails = {
  /** Every parameter key → the value that will be sent (path and query). */
  values: Record<string, string>;
  /** Query-string parameters with `{locale}` placeholders resolved. */
  queryParams: Record<string, string>;
  /** Endpoint path with path parameters substituted. */
  requestPath: string;
  /** Path parameters that are still blank; the request cannot be sent. */
  unresolvedPathParams: ApiEndpointParameter[];
};

/** Sample path values for parameters that no sibling index can discover. */
export const SAMPLE_PATH_VALUES: Record<string, string> = {
  connectedRealmId: "4",
  raid: "vault-of-the-incarnates",
  faction: "alliance",
  questId: "2",
  achievementId: "6",
  pvpBracket: "2v2",
};

/** Every `*Id` parameter in the catalog is a numeric Blizzard id. */
export const isIdParameter = (key: string): boolean => /Id$/.test(key);

const isNumericId = (value: string): boolean => /^\d+$/.test(value);

/**
 * Resolves the values an endpoint request will use.
 *
 * Precedence per key: an explicit override → the catalog's curated default →
 * a value discovered from a sibling response → a sample value (path only).
 * `||` is deliberate: the catalog's empty-string defaults must not short-circuit.
 */
export const resolveEndpointRequest = (
  endpoint: ApiEndpointDefinition,
  overrides: Record<string, string>,
  discovered: Record<string, string> = {},
): EndpointRequestDetails => {
  const parameters = endpoint.parameters ?? [];

  const values = Object.fromEntries(
    parameters.map((parameter) => {
      const override = overrides[parameter.key]?.trim() ?? "";
      const curated = parameter.defaultValue?.trim() ?? "";
      const found = discovered[parameter.key]?.trim() ?? "";
      const sample =
        parameter.location === "path"
          ? (SAMPLE_PATH_VALUES[parameter.key] ?? "")
          : "";

      return [parameter.key, override || curated || found || sample];
    }),
  );

  const unresolvedPathParams = parameters.filter(
    (parameter) =>
      parameter.location === "path" && !(values[parameter.key] ?? "").trim(),
  );

  const queryParams = Object.fromEntries(
    parameters
      .filter((parameter) => parameter.location === "query")
      .map((parameter) => [
        resolveParameterKey(parameter.key),
        (values[parameter.key] ?? "").trim(),
      ])
      .filter((entry) => entry[1].length > 0),
  );

  return {
    values,
    queryParams,
    requestPath: buildPath(endpoint.path, values),
    unresolvedPathParams,
  };
};

type SettledResult = { isSuccess: boolean; data?: unknown };

/** Path parameter keys still blank after curated defaults and samples. */
export const collectUnresolvedKeys = (
  requests: EndpointRequestDetails[],
): Set<string> =>
  new Set(
    requests.flatMap((request) =>
      request.unresolvedPathParams.map((parameter) => parameter.key),
    ),
  );

const shallowEqualRecords = (
  left: Record<string, string>,
  right: Record<string, string>,
): boolean => {
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every((key) => left[key] === right[key])
  );
};

/**
 * Finds path values for parameters that are blank after curated defaults and
 * samples are applied, by matching the hrefs in sibling responses against the
 * family's path templates. Only genuinely unresolved keys are ever written, so
 * curated ids never churn once a search or index response arrives.
 *
 * Only templates that contain an unresolved key are matched, and the scan
 * stops as soon as every unresolved key has a value.
 */
export const deriveDiscoveredPathValues = (
  family: ApiFamilyConfig,
  requests: EndpointRequestDetails[],
  results: SettledResult[],
  unresolvedKeys: Set<string> = collectUnresolvedKeys(requests),
): Record<string, string> => {
  const next: Record<string, string> = {};

  if (unresolvedKeys.size === 0) {
    return next;
  }

  const templates = family.endpoints.filter((candidate) =>
    Array.from(unresolvedKeys).some((key) => candidate.path.includes(`{${key}}`)),
  );
  if (templates.length === 0) {
    return next;
  }

  const remaining = new Set(unresolvedKeys);

  for (const result of results) {
    if (remaining.size === 0) {
      break;
    }
    if (!result.isSuccess) {
      continue;
    }

    for (const href of collectUrlStrings(result.data)) {
      if (remaining.size === 0) {
        break;
      }
      for (const candidate of templates) {
        const match = matchPathTemplate(candidate.path, href);
        if (!match) {
          continue;
        }

        Object.entries(match).forEach(([key, value]) => {
          if (!remaining.has(key)) {
            return;
          }
          // "/quest/index" must not become questId, nor "/quest/category".
          if (value === "index" || (isIdParameter(key) && !isNumericId(value))) {
            return;
          }
          next[key] = value;
          remaining.delete(key);
        });
      }
    }
  }

  return next;
};

/* ------------------------------------------------------------------ */
/* Query plumbing                                                      */
/* ------------------------------------------------------------------ */

const ENDPOINT_QUERY_PREFIX = "api-family-endpoint";
const ENDPOINT_STALE_TIME = 300_000;

const endpointQueryKey = (
  family: ApiFamilyConfig,
  endpoint: ApiEndpointDefinition,
  request: EndpointRequestDetails,
): readonly unknown[] => [
  ENDPOINT_QUERY_PREFIX,
  family.slug,
  endpoint.id,
  request.requestPath,
  request.queryParams,
  env.region,
  env.locale,
];

const fetchEndpoint = (
  endpoint: ApiEndpointDefinition,
  request: EndpointRequestDetails,
  signal: AbortSignal,
): Promise<unknown> =>
  blizzardClient.get<unknown>(
    request.requestPath,
    {
      ...request.queryParams,
      namespace: resolveNamespace(endpoint.namespace),
    },
    { signal },
  );

/**
 * The canonical Blizzard URL for "Copy API URL". It needs an Authorization
 * header, so it is only ever copied, never opened in a tab.
 */
export const buildPublicApiUrl = (
  endpoint: ApiEndpointDefinition,
  request: EndpointRequestDetails,
): string => {
  const url = new URL(request.requestPath, getApiBaseUrl());
  const namespace = resolveNamespace(endpoint.namespace);

  if (namespace) {
    url.searchParams.set("namespace", namespace);
  }
  url.searchParams.set("locale", env.locale);
  Object.entries(request.queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
};

type DiscoveryQueries = {
  queries: UseQueryResult<unknown>[];
  settled: SettledResult[];
};

/** Module-level so react-query can memoise the combined result. */
const combineDiscoveryQueries = (
  results: UseQueryResult<unknown>[],
): DiscoveryQueries => ({
  queries: results,
  settled: results.map((query) => ({
    isSuccess: query.isSuccess,
    data: query.data,
  })),
});

export type IndexEndpointQuery = {
  endpoint: ApiEndpointDefinition;
  request: EndpointRequestDetails;
  query: UseQueryResult<unknown>;
};

export type FamilyEndpointDiscovery = {
  /** One request per endpoint, resolved with no overrides and no discovery. */
  baselineRequests: EndpointRequestDetails[];
  /** Path values found in the sibling responses (only for blank params). */
  discoveredPathValues: Record<string, string>;
  /** Aligned to `family.endpoints`; `undefined` where the baseline is blocked. */
  indexQueries: Array<IndexEndpointQuery | undefined>;
};

export type FamilyEndpointDiscoveryOptions = {
  /**
   * `"all"` (default) fetches every resolvable endpoint, for callers that
   * render the responses (the family overview). `"discovery"` fetches only
   * when the family has a blank path parameter to discover, so a caller
   * that just wants `discoveredPathValues` never downloads payloads it will
   * not show.
   */
  mode?: "all" | "discovery";
};

type LatchedValues = { slug: string; values: Record<string, string> };

/**
 * Fetches every endpoint whose path resolves without discovery (indexes,
 * curated ids, samples) and derives path values for the rest from those
 * responses. The fetched set never depends on the discovered values, so
 * query keys are stable across renders, and a discovered value is latched
 * for the family's lifetime so it never flips with response arrival order.
 */
export const useFamilyEndpointDiscovery = (
  family: ApiFamilyConfig,
  options?: FamilyEndpointDiscoveryOptions,
): FamilyEndpointDiscovery => {
  const baselineRequests = useMemo(
    () =>
      family.endpoints.map((endpoint) =>
        resolveEndpointRequest(endpoint, {}, {}),
      ),
    [family],
  );

  const unresolvedKeys = useMemo(
    () => collectUnresolvedKeys(baselineRequests),
    [baselineRequests],
  );

  const fetchable = useMemo(
    () =>
      family.endpoints
        .map((endpoint, index) => ({
          endpoint,
          index,
          request: baselineRequests[index],
        }))
        .filter((entry) => entry.request.unresolvedPathParams.length === 0),
    [baselineRequests, family],
  );

  // In discovery mode, families with nothing to discover never fan out
  // (auction-house would otherwise download the commodities dump for a
  // panel nobody opened).
  const enabled = options?.mode !== "discovery" || unresolvedKeys.size > 0;

  const { queries, settled } = useQueries({
    queries: fetchable.map(({ endpoint, request }) => ({
      queryKey: endpointQueryKey(family, endpoint, request),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchEndpoint(endpoint, request, signal),
      enabled,
      retry: false,
      staleTime: ENDPOINT_STALE_TIME,
    })),
    combine: combineDiscoveryQueries,
  });

  // `settled` is structurally shared by react-query, so this only re-runs
  // when a response actually arrives or changes. Values already found are
  // kept (keys are only ever added), so consumers' query keys stay stable.
  const latchedRef = useRef<LatchedValues>({ slug: family.slug, values: {} });
  const discoveredPathValues = useMemo(() => {
    if (latchedRef.current.slug !== family.slug) {
      latchedRef.current = { slug: family.slug, values: {} };
    }
    const derived = deriveDiscoveredPathValues(
      family,
      baselineRequests,
      settled,
      unresolvedKeys,
    );
    const merged = { ...derived, ...latchedRef.current.values };
    if (!shallowEqualRecords(merged, latchedRef.current.values)) {
      latchedRef.current = { slug: family.slug, values: merged };
    }
    return latchedRef.current.values;
  }, [family, baselineRequests, settled, unresolvedKeys]);

  const indexQueries = useMemo(() => {
    const aligned: Array<IndexEndpointQuery | undefined> = family.endpoints.map(
      () => undefined,
    );
    fetchable.forEach((entry, position) => {
      aligned[entry.index] = {
        endpoint: entry.endpoint,
        request: entry.request,
        query: queries[position],
      };
    });
    return aligned;
  }, [family, fetchable, queries]);

  return { baselineRequests, discoveredPathValues, indexQueries };
};

export type UseEndpointRequestOptions = {
  family: ApiFamilyConfig;
  endpoint: ApiEndpointDefinition;
  /** Explicit values (from the URL or a form); blanks fall through. */
  values: Record<string, string>;
  /** Values found by `useFamilyEndpointDiscovery`. */
  discovered: Record<string, string>;
  enabled: boolean;
};

export type EndpointRequestState = {
  request: EndpointRequestDetails;
  query: UseQueryResult<unknown>;
  apiUrl: string;
};

/** One endpoint request; shares its cache with the family discovery queries. */
export const useEndpointRequest = ({
  family,
  endpoint,
  values,
  discovered,
  enabled,
}: UseEndpointRequestOptions): EndpointRequestState => {
  const request = useMemo(
    () => resolveEndpointRequest(endpoint, values, discovered),
    [endpoint, values, discovered],
  );

  const query = useQuery({
    queryKey: endpointQueryKey(family, endpoint, request),
    queryFn: ({ signal }) => fetchEndpoint(endpoint, request, signal),
    enabled: enabled && request.unresolvedPathParams.length === 0,
    retry: false,
    staleTime: ENDPOINT_STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const apiUrl = useMemo(
    () => buildPublicApiUrl(endpoint, request),
    [endpoint, request],
  );

  return { request, query, apiUrl };
};
