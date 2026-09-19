import { BlizzardRequestError } from "@/lib/blizzardClient";

export type ErrorSeverity = "error" | "warning" | "info";

export type BlizzardErrorDescription = {
  /** Short heading, e.g. "Rate limit reached". */
  title: string;
  /** One or two plain sentences safe to show to users. */
  message: string;
  severity: ErrorSeverity;
  /** Whether a "Retry" action makes sense. */
  retryable: boolean;
  /** HTTP status when the error came from Blizzard (0 for transport errors). */
  status?: number;
};

const hasName = (error: unknown, name: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === name;

/** A caller-initiated cancellation (react-query, unmount, superseded search). */
export const isAbortError = (error: unknown): boolean =>
  hasName(error, "AbortError");

export const isTimeoutError = (error: unknown): boolean =>
  hasName(error, "TimeoutError") ||
  (error instanceof BlizzardRequestError && error.isTimeout);

/** `fetch` rejects with a TypeError when the network or the proxy is unreachable. */
export const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError;

const errorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return undefined;
};

const lead = (context: string | undefined): string =>
  context && context.trim().length > 0
    ? `We couldn't load ${context.trim()}.`
    : "We couldn't load this data.";

const formatSeconds = (ms: number): string => {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
};

/** Blizzard's `detail` strings rarely end in punctuation; make them a sentence. */
const asSentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * Turns anything thrown by a Blizzard query into copy an ErrorState can show.
 *
 * @param context what was being loaded, as a noun phrase: "items",
 *   "the WoW Token price", "realm status". Used as "We couldn't load {context}."
 */
export const describeBlizzardError = (
  error: unknown,
  context?: string,
): BlizzardErrorDescription => {
  const intro = lead(context);

  if (error instanceof BlizzardRequestError) {
    if (error.isAuth) {
      return {
        title: "Blizzard credentials rejected",
        message: `${intro} Blizzard refused the request (HTTP ${error.status}). Check the VITE_BNET_* credentials in .env and restart the dev server.`,
        severity: "error",
        retryable: false,
        status: error.status,
      };
    }

    if (error.isRateLimited) {
      const wait = error.retryAfterMs
        ? `Try again in ${formatSeconds(error.retryAfterMs)}.`
        : "Try again in a moment.";
      return {
        title: "Rate limit reached",
        message: `${intro} Blizzard is throttling requests right now. ${wait}`,
        severity: "warning",
        retryable: true,
        status: error.status,
      };
    }

    if (error.isNotFound) {
      return {
        title: "Nothing found",
        message: context
          ? `Blizzard has no data for ${context.trim()}.`
          : "Blizzard has no data for this request.",
        severity: "info",
        retryable: false,
        status: error.status,
      };
    }

    if (error.isTimeout) {
      return {
        title: "Request timed out",
        message: `${intro} Blizzard took too long to answer. Check your connection and try again.`,
        severity: "warning",
        retryable: true,
        status: 0,
      };
    }

    if (error.reason === "invalid-json") {
      return {
        title: "Unexpected response",
        message: `${intro} Blizzard answered with something that wasn't data. Try again in a moment.`,
        severity: "error",
        retryable: true,
        status: error.status,
      };
    }

    if (error.status >= 500 || error.status === 0) {
      return {
        title: "Blizzard is having trouble",
        message: `${intro} Blizzard's API returned an error${
          error.status > 0 ? ` (HTTP ${error.status})` : ""
        }. Try again shortly.`,
        severity: "error",
        retryable: true,
        status: error.status,
      };
    }

    return {
      title: "Request rejected",
      message: `${intro} ${
        error.detail
          ? asSentence(error.detail)
          : `Blizzard rejected the request (HTTP ${error.status}).`
      }`,
      severity: "error",
      retryable: false,
      status: error.status,
    };
  }

  if (isAbortError(error)) {
    return {
      title: "Request cancelled",
      message: "The request was cancelled before it finished.",
      severity: "info",
      retryable: true,
    };
  }

  if (isTimeoutError(error)) {
    return {
      title: "Request timed out",
      message: `${intro} The request took too long. Check your connection and try again.`,
      severity: "warning",
      retryable: true,
      status: 0,
    };
  }

  if (isNetworkError(error)) {
    return {
      title: "You appear to be offline",
      message: `${intro} We couldn't reach Blizzard's API. Check your connection and try again.`,
      severity: "warning",
      retryable: true,
      status: 0,
    };
  }

  const detail = errorMessage(error);

  return {
    title: "Something went wrong",
    message: `${intro} ${
      detail ? asSentence(detail) : "An unexpected error occurred."
    }`,
    severity: "error",
    retryable: true,
  };
};
