import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UIEvent } from "react";

import { LiveStatus } from "@/components/common/StateBlocks";
import { formatNumber } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Tokeniser                                                           */
/* ------------------------------------------------------------------ */

type TokenKind = "key" | "string" | "number" | "literal" | "punct";

type Token = { kind: TokenKind; text: string };

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

const JsonLine = memo(({ text }: { text: string }): JSX.Element => {
  const tokens = useMemo(() => tokenize(text), [text]);
  return (
    <span className="json-line">
      {tokens.map((token, index) => (
        <span key={index} className={`tk-${token.kind}`}>
          {token.text}
        </span>
      ))}
    </span>
  );
});
JsonLine.displayName = "JsonLine";

/* ------------------------------------------------------------------ */
/* Clipboard                                                           */
/* ------------------------------------------------------------------ */

const COPIED_STATUS_MS = 2000;

/**
 * Copies to the clipboard and reports "copied" for two seconds. Resolves to
 * false when the Clipboard API is unavailable (insecure context).
 */
export const useCopyToClipboard = (): {
  copied: boolean;
  copy: (value: string) => void;
} => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const copy = useCallback((value: string) => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setCopied(false);
        }, COPIED_STATUS_MS);
      })
      .catch(() => undefined);
  }, []);

  return { copied, copy };
};

export type CopyApiUrlButtonProps = {
  apiUrl: string;
  /** Names the request in the tooltip / status, e.g. the endpoint label. */
  label?: string;
};

/**
 * "Copy API URL" icon button with a polite "Copied" announcement. The URL
 * needs an Authorization header, so it is copied, never opened.
 */
export const CopyApiUrlButton = ({
  apiUrl,
  label,
}: CopyApiUrlButtonProps): JSX.Element => {
  const { copied, copy } = useCopyToClipboard();
  const accessibleLabel = label ? `Copy API URL for ${label}` : "Copy API URL";

  return (
    <>
      <Tooltip title={copied ? "Copied" : "Copy API URL"}>
        <IconButton
          size="small"
          aria-label={accessibleLabel}
          onClick={() => copy(apiUrl)}
        >
          <LinkRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <LiveStatus visuallyHidden component="span">
        {copied ? "Copied API URL" : ""}
      </LiveStatus>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Viewer                                                              */
/* ------------------------------------------------------------------ */

const LINE_HEIGHT = 20;
const MAX_HEIGHT = 480;
const VIRTUALIZE_ABOVE = 400;
const OVERSCAN_BEFORE = 20;
const OVERSCAN_AFTER = 40;

type LineRange = { start: number; end: number };

const computeRange = (
  scrollTop: number,
  clientHeight: number,
  total: number,
): LineRange => {
  const start = Math.max(
    0,
    Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN_BEFORE,
  );
  const end = Math.min(
    total,
    start + Math.ceil(clientHeight / LINE_HEIGHT) + OVERSCAN_AFTER,
  );
  return { start, end };
};

const toFileName = (name: string): string =>
  `${name.replace(/\W+/g, "-").toLowerCase()}.json`;

const formatKilobytes = (bytes: number): string =>
  `${(bytes / 1024).toFixed(1)} KB`;

export type JsonViewerProps = {
  data: unknown;
  /** What the payload is, e.g. the endpoint label ("Quests Index"). */
  label: string;
  /** Download name without extension; defaults to `label`. */
  fileName?: string;
  /** When given, adds a "Copy API URL" action. Never opened in a tab. */
  apiUrl?: string;
  defaultExpanded?: boolean;
};

type CopiedKind = "json" | "url" | null;

const JsonViewer = ({
  data,
  label,
  fileName,
  apiUrl,
  defaultExpanded = true,
}: JsonViewerProps): JSX.Element => {
  const bodyId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState<CopiedKind>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  const text = useMemo(() => JSON.stringify(data, null, 2) ?? "", [data]);
  const lines = useMemo(() => text.split("\n"), [text]);
  const bytes = useMemo(() => new TextEncoder().encode(text).length, [text]);
  const virtualized = lines.length > VIRTUALIZE_ABOVE;

  const [range, setRange] = useState<LineRange>(() =>
    computeRange(0, MAX_HEIGHT, lines.length),
  );

  // A new payload starts at the top again.
  useEffect(() => {
    setRange(computeRange(0, MAX_HEIGHT, lines.length));
    if (preRef.current) {
      preRef.current.scrollTop = 0;
    }
  }, [lines]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  const announceCopied = useCallback((kind: Exclude<CopiedKind, null>) => {
    setCopied(kind);
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => {
      copiedTimerRef.current = null;
      setCopied(null);
    }, COPIED_STATUS_MS);
  }, []);

  const copyText = useCallback(
    (value: string, kind: Exclude<CopiedKind, null>) => {
      navigator.clipboard
        ?.writeText(value)
        .then(() => announceCopied(kind))
        .catch(() => undefined);
    },
    [announceCopied],
  );

  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = toFileName(fileName ?? label);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [fileName, label, text]);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLPreElement>) => {
      if (!virtualized) {
        return;
      }
      const element = event.currentTarget;
      if (scrollFrameRef.current !== null) {
        return;
      }
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const next = computeRange(
          element.scrollTop,
          element.clientHeight,
          lines.length,
        );
        setRange((current) =>
          current.start === next.start && current.end === next.end
            ? current
            : next,
        );
      });
    },
    [lines.length, virtualized],
  );

  const visibleStart = virtualized ? range.start : 0;
  const visibleEnd = virtualized ? range.end : lines.length;
  const visibleLines = useMemo(
    () => lines.slice(visibleStart, visibleEnd),
    [lines, visibleStart, visibleEnd],
  );

  const sizeLabel = `${formatNumber(lines.length)} ${
    lines.length === 1 ? "line" : "lines"
  } · ${formatKilobytes(bytes)}`;

  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <CodeRoundedIcon color="primary" fontSize="small" aria-hidden="true" />
          <Typography variant="subtitle2" component="p" sx={{ margin: 0 }}>
            {label} JSON
          </Typography>
        </Stack>
        <Chip size="small" label={sizeLabel} />

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ marginLeft: { sm: "auto" } }}
        >
          <Tooltip title="Copy JSON">
            <IconButton
              size="small"
              aria-label="Copy JSON"
              onClick={() => copyText(text, "json")}
            >
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download JSON">
            <IconButton
              size="small"
              aria-label="Download JSON"
              onClick={handleDownload}
            >
              <DownloadRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {apiUrl ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<LinkRoundedIcon />}
              onClick={() => copyText(apiUrl, "url")}
            >
              Copy API URL
            </Button>
          ) : null}
          <IconButton
            size="small"
            aria-label={expanded ? "Collapse JSON" : "Expand JSON"}
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => setExpanded((current) => !current)}
          >
            <ExpandMoreRoundedIcon
              fontSize="small"
              sx={(theme) => ({
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: theme.transitions.create("transform", {
                  duration: theme.wc.motion.base,
                }),
              })}
            />
          </IconButton>
        </Stack>
      </Stack>

      {/* Always mounted so the announcement registers; visible for 2 s. */}
      <LiveStatus visuallyHidden={copied === null}>
        {copied === null
          ? ""
          : copied === "json"
            ? "Copied JSON"
            : "Copied API URL"}
      </LiveStatus>

      <Collapse in={expanded} id={bodyId}>
        <Box
          ref={preRef}
          component="pre"
          tabIndex={0}
          role="region"
          aria-label={`${label} raw JSON`}
          onScroll={handleScroll}
          sx={(theme) => ({
            margin: 0,
            padding: 2,
            maxHeight: MAX_HEIGHT,
            overflow: "auto",
            backgroundColor: theme.palette.surface.sunken,
            border: `1px solid ${theme.palette.border.subtle}`,
            borderRadius: `${theme.wc.radius.md}px`,
            fontFamily: theme.wc.fontMono,
            fontSize: "0.8125rem",
            lineHeight: `${LINE_HEIGHT}px`,
            whiteSpace: "pre",
            color: theme.palette.text.primary,
            "& .json-line": { display: "block", height: LINE_HEIGHT },
            "& .tk-key": { color: theme.palette.primary.light },
            "& .tk-string": { color: theme.palette.text.primary },
            "& .tk-number": { color: theme.palette.secondary.light },
            "& .tk-literal": { color: theme.palette.info.light },
            "& .tk-punct": { color: theme.palette.text.secondary },
          })}
        >
          {virtualized && visibleStart > 0 ? (
            <Box
              component="span"
              aria-hidden="true"
              sx={{ display: "block", height: visibleStart * LINE_HEIGHT }}
            />
          ) : null}
          {visibleLines.map((line, index) => (
            <JsonLine key={visibleStart + index} text={line} />
          ))}
          {virtualized && visibleEnd < lines.length ? (
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                display: "block",
                height: (lines.length - visibleEnd) * LINE_HEIGHT,
              }}
            />
          ) : null}
        </Box>
      </Collapse>
    </Stack>
  );
};

export default JsonViewer;
