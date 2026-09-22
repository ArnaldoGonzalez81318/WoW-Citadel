import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
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
import type { SxProps, Theme } from "@mui/material/styles";
import {
  Fragment,
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
import {
  computeLineRange,
  cutAtLineBoundary,
  formatByteSize,
  JSON_LINE_HEIGHT,
  JSON_MAX_EAGER_CHARS,
  JSON_VIEWER_MAX_HEIGHT,
  JSON_VIRTUALIZE_ABOVE,
  tokenize,
} from "@/features/apiExplorer/workbench/jsonTokens";
import type { LineRange } from "@/features/apiExplorer/workbench/jsonTokens";
import { useCopyToClipboard } from "@/features/apiExplorer/workbench/useCopyToClipboard";
import { formatNumber } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Line                                                                */
/* ------------------------------------------------------------------ */

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

/** The tinted mono surface shared by the line viewer and the folded view. */
const jsonSurfaceSx: SxProps<Theme> = (theme) => ({
  margin: 0,
  padding: 2,
  maxHeight: JSON_VIEWER_MAX_HEIGHT,
  overflow: "auto",
  backgroundColor: theme.palette.surface.sunken,
  border: `1px solid ${theme.palette.border.subtle}`,
  borderRadius: `${theme.wc.radius.md}px`,
  fontFamily: theme.wc.fontMono,
  fontSize: "0.8125rem",
  lineHeight: `${JSON_LINE_HEIGHT}px`,
  whiteSpace: "pre",
  color: theme.palette.text.primary,
  "& .json-line": { display: "block", height: JSON_LINE_HEIGHT },
  "& .tk-key": { color: theme.palette.primary.light },
  "& .tk-string": { color: theme.palette.text.primary },
  "& .tk-number": { color: theme.palette.secondary.light },
  "& .tk-literal": { color: theme.palette.info.light },
  "& .tk-punct": { color: theme.palette.text.secondary },
  "& .json-fold": {
    all: "unset",
    cursor: "pointer",
    borderRadius: `${theme.wc.radius.sm}px`,
    "&:hover .tk-key": { textDecoration: "underline" },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.light}`,
      outlineOffset: 2,
    },
  },
});

/* ------------------------------------------------------------------ */
/* Folded view                                                         */
/* ------------------------------------------------------------------ */

/** Lines rendered for one unfolded key before the rest is elided. */
const FOLD_MAX_LINES = 1500;

/** A non-empty object or array: the only values worth folding. */
const isContainer = (value: unknown): value is object =>
  value !== null && typeof value === "object" && Object.keys(value).length > 0;

const summarizeValue = (value: unknown): string =>
  Array.isArray(value)
    ? value.length > 0
      ? `[…${formatNumber(value.length)}]`
      : "[]"
    : value !== null && typeof value === "object"
      ? isContainer(value)
        ? "{…}"
        : "{}"
      : (JSON.stringify(value) ?? "null");

type FoldedJsonProps = { data: object; label: string };

/**
 * The top-level object (or array) one entry per line, containers summarised
 * as `{…}` / `[…N]`; a key unfolds only its own value, indented in place.
 * Unfolded values are not virtualised, so very long ones are cut with a
 * line count; the line viewer shows everything.
 */
const FoldedJson = ({ data, label }: FoldedJsonProps): JSX.Element => {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set());
  const isArray = Array.isArray(data);

  useEffect(() => {
    setOpenKeys(new Set());
  }, [data]);

  const entries = useMemo<Array<[string, unknown]>>(
    () =>
      isArray
        ? (data as unknown[]).map((value, index) => [String(index), value])
        : Object.entries(data),
    [data, isArray],
  );

  const toggle = useCallback((key: string) => {
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const keyText = (key: string): string =>
    isArray ? key : JSON.stringify(key);

  return (
    <Box role="region" aria-label={`${label} JSON, folded`} sx={jsonSurfaceSx}>
      <span className="json-line tk-punct">{isArray ? "[" : "{"}</span>
      {entries.map(([key, value], index) => {
        const comma = index < entries.length - 1 ? "," : "";
        if (!isContainer(value)) {
          return (
            <JsonLine
              key={key}
              text={`  ${keyText(key)}: ${summarizeValue(value)}${comma}`}
            />
          );
        }

        const open = openKeys.has(key);
        const body = open ? JSON.stringify(value, null, 2).split("\n") : [];
        const shown = body.slice(
          1,
          Math.min(body.length - 1, FOLD_MAX_LINES + 1),
        );
        const elided = body.length - 2 - shown.length;

        return (
          <Fragment key={key}>
            <span className="json-line">
              {"  "}
              <button
                type="button"
                className="json-fold"
                aria-expanded={open}
                aria-label={`${open ? "Fold" : "Unfold"} ${keyText(key)}`}
                onClick={() => toggle(key)}
              >
                <span className={isArray ? "tk-number" : "tk-key"}>
                  {keyText(key)}
                </span>
                <span className="tk-punct">
                  {`: ${open ? body[0] : summarizeValue(value)}`}
                </span>
              </button>
              <span className="tk-punct">{open ? "" : comma}</span>
            </span>
            {shown.map((line, lineIndex) => (
              <JsonLine key={lineIndex} text={`  ${line}`} />
            ))}
            {open && elided > 0 ? (
              <span className="json-line tk-punct">
                {`    … ${formatNumber(elided)} more lines (turn off Fold keys for the full response)`}
              </span>
            ) : null}
            {open ? (
              <span className="json-line tk-punct">
                {`  ${body[body.length - 1]}${comma}`}
              </span>
            ) : null}
          </Fragment>
        );
      })}
      <span className="json-line tk-punct">{isArray ? "]" : "}"}</span>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* CopyApiUrlButton                                                    */
/* ------------------------------------------------------------------ */

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
          {copied ? (
            <CheckRoundedIcon fontSize="small" color="success" />
          ) : (
            <LinkRoundedIcon fontSize="small" />
          )}
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

const toFileName = (name: string): string =>
  `${name.replace(/\W+/g, "-").toLowerCase()}.json`;

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

type CopiedKind = "json" | "url";

const JsonViewer = ({
  data,
  label,
  fileName,
  apiUrl,
  defaultExpanded = true,
}: JsonViewerProps): JSX.Element => {
  const bodyId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const [folded, setFolded] = useState(false);
  const foldable = isContainer(data);
  const { copied, copy } = useCopyToClipboard<CopiedKind>();
  const scrollFrameRef = useRef<number | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  // The full text is needed for Copy / Download; only a bounded prefix is
  // split into lines and tokenised until the user asks for all of it.
  const fullText = useMemo(() => JSON.stringify(data, null, 2) ?? "", [data]);
  const truncated = !showAll && fullText.length > JSON_MAX_EAGER_CHARS;
  const text = useMemo(
    () =>
      truncated ? cutAtLineBoundary(fullText, JSON_MAX_EAGER_CHARS) : fullText,
    [fullText, truncated],
  );
  const lines = useMemo(() => text.split("\n"), [text]);
  // Blob.size counts UTF-8 bytes without retaining an encoded copy.
  const bytes = useMemo(() => new Blob([fullText]).size, [fullText]);
  const shownBytes = useMemo(
    () => (truncated ? new Blob([text]).size : bytes),
    [truncated, text, bytes],
  );
  const virtualized = lines.length > JSON_VIRTUALIZE_ABOVE;

  const [range, setRange] = useState<LineRange>(() =>
    computeLineRange(0, JSON_VIEWER_MAX_HEIGHT, lines.length),
  );

  // A new payload starts at the top again, showing its prefix only.
  useEffect(() => {
    setShowAll(false);
  }, [fullText]);

  useEffect(() => {
    setRange(computeLineRange(0, JSON_VIEWER_MAX_HEIGHT, lines.length));
    if (preRef.current) {
      preRef.current.scrollTop = 0;
    }
  }, [lines]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  const handleDownload = useCallback(() => {
    const blob = new Blob([fullText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = toFileName(fileName ?? label);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking before the navigation starts cancels the download in Firefox.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [fileName, fullText, label]);

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
        const next = computeLineRange(
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

  const sizeLabel = truncated
    ? `Showing first ${formatByteSize(shownBytes)} of ${formatByteSize(bytes)}`
    : `${formatNumber(lines.length)} ${
        lines.length === 1 ? "line" : "lines"
      } · ${formatByteSize(bytes)}`;

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
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <CodeRoundedIcon
            color="primary"
            fontSize="small"
            aria-hidden="true"
          />
          <Typography variant="subtitle2" component="p" sx={{ margin: 0 }}>
            {label} JSON
          </Typography>
        </Stack>
        <Chip size="small" label={sizeLabel} />
        {foldable ? (
          <Chip
            size="small"
            variant="outlined"
            clickable
            icon={<UnfoldLessRoundedIcon />}
            label="Fold keys"
            aria-pressed={folded}
            onClick={() => setFolded((current) => !current)}
          />
        ) : null}

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ marginLeft: { sm: "auto" } }}
        >
          <Tooltip title={copied === "json" ? "Copied" : "Copy JSON"}>
            <IconButton
              size="small"
              aria-label="Copy JSON"
              onClick={() => copy(fullText, "json")}
            >
              {copied === "json" ? (
                <CheckRoundedIcon fontSize="small" color="success" />
              ) : (
                <ContentCopyRoundedIcon fontSize="small" />
              )}
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
              startIcon={
                copied === "url" ? (
                  <CheckRoundedIcon color="success" />
                ) : (
                  <LinkRoundedIcon />
                )
              }
              onClick={() => copy(apiUrl, "url")}
            >
              {copied === "url" ? "Copied" : "Copy API URL"}
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

      {/* Always mounted and always visually hidden so it never reflows. */}
      <LiveStatus visuallyHidden component="span">
        {copied === null
          ? ""
          : copied === "json"
            ? "Copied JSON"
            : "Copied API URL"}
      </LiveStatus>

      <Collapse in={expanded} id={bodyId}>
        <Stack spacing={1}>
          {folded && foldable ? (
            <FoldedJson data={data} label={label} />
          ) : (
            <Box
              ref={preRef}
              component="pre"
              tabIndex={0}
              role="region"
              aria-label={`${label} raw JSON`}
              onScroll={handleScroll}
              sx={jsonSurfaceSx}
            >
              {virtualized && visibleStart > 0 ? (
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    display: "block",
                    height: visibleStart * JSON_LINE_HEIGHT,
                  }}
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
                    height: (lines.length - visibleEnd) * JSON_LINE_HEIGHT,
                  }}
                />
              ) : null}
            </Box>
          )}
          {truncated && !(folded && foldable) ? (
            <Button
              size="small"
              variant="text"
              onClick={() => setShowAll(true)}
              sx={{ alignSelf: "flex-start" }}
            >
              Show full response ({formatByteSize(bytes)})
            </Button>
          ) : null}
        </Stack>
      </Collapse>
    </Stack>
  );
};

export default JsonViewer;
