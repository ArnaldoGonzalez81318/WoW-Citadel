import type {
  ApiEndpointDefinition,
  ApiEndpointParameter,
  ApiFamilyConfig,
} from "@/features/apiExplorer/types";
import { describeBlizzardError } from "@/lib/errors";

export type EndpointErrorCopy = {
  title: string;
  /** Full copy: the shared Blizzard message followed by `hint`, when any. */
  message: string;
  /**
   * The workbench-specific sentence alone, for callers that already render
   * the shared message through `ErrorState` (which derives it itself).
   */
  hint?: string;
  /**
   * A list endpoint (index or search) whose records carry ids the failing
   * endpoint accepts; callers render it as an "Open …" action.
   */
  suggestedEndpoint?: ApiEndpointDefinition;
  retryable: boolean;
};

const joinSentences = (...parts: Array<string | undefined>): string =>
  parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ");

const LIST_SUFFIX = /-(index|search)$/;

const pathParamKeys = (endpoint: ApiEndpointDefinition): string[] =>
  (endpoint.parameters ?? [])
    .filter((parameter) => parameter.location === "path")
    .map((parameter) => parameter.key)
    .sort();

const sameKeys = (left: string[], right: string[]): boolean =>
  left.length > 0 &&
  left.length === right.length &&
  left.every((key, index) => key === right[index]);

/**
 * The index or search endpoint whose records supply ids for `endpoint`:
 * its namesake (`item-class` → `item-class-index`) first, else a list whose
 * by-id sibling takes the same path parameters (`item-media` → `item-search`
 * via `item`). Lists of unrelated records (item classes for an item id) are
 * never suggested.
 */
export const findIdSourceEndpoint = (
  endpoint: ApiEndpointDefinition,
  family: ApiFamilyConfig,
): ApiEndpointDefinition | undefined => {
  const lists = family.endpoints.filter(
    (candidate) =>
      LIST_SUFFIX.test(candidate.id) && pathParamKeys(candidate).length === 0,
  );
  if (lists.length === 0) {
    return undefined;
  }

  const namesake = lists.find(
    (candidate) => candidate.id.replace(LIST_SUFFIX, "") === endpoint.id,
  );
  if (namesake) {
    return namesake;
  }

  const keys = pathParamKeys(endpoint);
  return lists.find((candidate) => {
    const stem = family.endpoints.find(
      (sibling) => sibling.id === candidate.id.replace(LIST_SUFFIX, ""),
    );
    return stem !== undefined && sameKeys(pathParamKeys(stem), keys);
  });
};

/**
 * The shared Blizzard error copy plus, for a 404, which list endpoint to
 * take an id from. The shared message already explains the status, so
 * nothing here repeats it.
 */
export const describeEndpointError = (
  error: unknown,
  endpoint: ApiEndpointDefinition,
  family: ApiFamilyConfig,
): EndpointErrorCopy => {
  const base = describeBlizzardError(error, endpoint.label);

  if (base.status === 404) {
    const suggestedEndpoint = findIdSourceEndpoint(endpoint, family);
    const hint = suggestedEndpoint
      ? `Try an id from ${suggestedEndpoint.label}.`
      : undefined;
    return {
      title: base.title,
      message: joinSentences(base.message, hint),
      hint,
      suggestedEndpoint,
      retryable: base.retryable,
    };
  }

  return {
    title: base.title,
    message: base.message,
    retryable: base.retryable,
  };
};

export type NeedsIdCopy = {
  title: string;
  description: string;
};

/** Empty-state copy for an endpoint whose path parameters are still blank. */
export const needsIdCopy = (params: ApiEndpointParameter[]): NeedsIdCopy => {
  const labels = params.map((parameter) => parameter.label);
  return {
    title: "Needs an id",
    description: `Enter ${labels.join(" and ")} and send the request.`,
  };
};
