/* ------------------------------------------------------------------ */
/* Tokeniser                                                           */
/* ------------------------------------------------------------------ */

export type TokenKind = "key" | "string" | "number" | "literal" | "punct";

export type Token = { kind: TokenKind; text: string };

const TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)|\b(true|false|null)\b/g;

/** Splits one line of pretty-printed JSON into tinted spans. */
export const tokenize = (line: string): Token[] => {
  const tokens: Token[] = [];
  const pattern = new RegExp(TOKEN_PATTERN.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null = pattern.exec(line);

  while (match !== null) {
    if (match.index > cursor) {
      tokens.push({ kind: "punct", text: line.slice(cursor, match.index) });
    }

    const [, quoted, colon, numeric, literal] = match;
    if (quoted !== undefined) {
      tokens.push({ kind: colon ? "key" : "string", text: quoted });
      if (colon) {
        tokens.push({ kind: "punct", text: colon });
      }
    } else if (numeric !== undefined) {
      tokens.push({ kind: "number", text: numeric });
    } else if (literal !== undefined) {
      tokens.push({ kind: "literal", text: literal });
    }

    cursor = match.index + match[0].length;
    match = pattern.exec(line);
  }

  if (cursor < line.length) {
    tokens.push({ kind: "punct", text: line.slice(cursor) });
  }

  return tokens;
};

/* ------------------------------------------------------------------ */
/* Viewer layout                                                       */
/* ------------------------------------------------------------------ */

/** Height of one rendered JSON line in px. */
export const JSON_LINE_HEIGHT = 20;
/** Max height of the scrolling `<pre>` in px. */
export const JSON_VIEWER_MAX_HEIGHT = 480;
/** Above this many lines only the visible window is rendered. */
export const JSON_VIRTUALIZE_ABOVE = 400;
/**
 * Payloads longer than this (in characters) are shown from the start only,
 * until the user asks for the full response. Bounds the split/tokenise work
 * and the retained line array for multi-MB responses.
 */
export const JSON_MAX_EAGER_CHARS = 4_000_000;

const OVERSCAN_BEFORE = 20;
const OVERSCAN_AFTER = 40;

export type LineRange = { start: number; end: number };

export const computeLineRange = (
  scrollTop: number,
  clientHeight: number,
  total: number,
): LineRange => {
  const start = Math.max(
    0,
    Math.floor(scrollTop / JSON_LINE_HEIGHT) - OVERSCAN_BEFORE,
  );
  const end = Math.min(
    total,
    start + Math.ceil(clientHeight / JSON_LINE_HEIGHT) + OVERSCAN_AFTER,
  );
  return { start, end };
};

/** "12.3 KB" below a megabyte, "4.0 MB" above. */
export const formatByteSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;

/**
 * Cuts `text` at the last line break before `limit` so the final rendered
 * line is never a torn token. Returns `text` unchanged when it fits.
 */
export const cutAtLineBoundary = (text: string, limit: number): string => {
  if (text.length <= limit) {
    return text;
  }
  const cut = text.lastIndexOf("\n", limit);
  return text.slice(0, cut > 0 ? cut : limit);
};
