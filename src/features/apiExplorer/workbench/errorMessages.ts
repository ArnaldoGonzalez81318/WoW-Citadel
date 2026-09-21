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
  retryable: boolean;
};

const joinSentences = (...parts: Array<string | undefined>): string =>
  parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ");

/**
 * The shared Blizzard error copy plus a hint specific to the workbench:
 * which index endpoint to take an id from, or which .env keys to check.
 */
export const describeEndpointError = (
  error: unknown,
  endpoint: ApiEndpointDefinition,
  family: ApiFamilyConfig,
): EndpointErrorCopy => {
  const base = describeBlizzardError(error, endpoint.label);

  if (base.status === 404) {
    const indexEndpoint = family.endpoints.find((candidate) =>
      candidate.id.endsWith("-index"),
    );
    const hint = joinSentences(
      `No ${endpoint.label} exists at this path.`,
      indexEndpoint ? `Try an id from ${indexEndpoint.label}.` : undefined,
    );
    return {
      title: base.title,
      message: joinSentences(base.message, hint),
      hint,
      retryable: base.retryable,
    };
  }

  if (base.status === 401 || base.status === 403) {
    const hint = "Check VITE_BNET_ACCESS_TOKEN or the proxy in .env.";
    return {
      title: base.title,
      message: joinSentences(base.message, hint),
      hint,
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
