import LaunchRounded from "@mui/icons-material/LaunchRounded";
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Link,
  Skeleton,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { memo } from "react";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import type { SearchResult } from "@/features/search/types";
import { WOWHEAD_LABEL, getExternalLink } from "@/lib/externalLinks";
import { focusRing, lineClamp, qualityColor, truncate } from "@/theme";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ResultCardLayout = "auto" | "row" | "compact" | "tile";

export type ResultCardTone = "primary" | "secondary";

export type ResultCardMeta = {
  label: string;
  value: string;
};

/**
 * Optional presentation fields on a result. They are declared here as well
 * as on `SearchResult` so the card compiles against either shape; feature
 * packages populate them (`kind` drives the external link, `quality` the
 * colour accent).
 */
export type ResultCardExtras = {
  kind?: string;
  quality?: string;
  externalUrl?: string;
  externalLabel?: string;
  subtitle?: string;
  meta?: ResultCardMeta[];
};

export type ResultCardResult = SearchResult & ResultCardExtras;

export type ResultCardProps = {
  result: ResultCardResult;
  /** auto: row for 56px icons / no media, tile for artwork; or force one. */
  layout?: ResultCardLayout;
  /** Accent for the selected border and tag chip (secondary = gold value context). */
  tone?: ResultCardTone;
  /** Makes the card body a button; the external link stays a separate control. */
  onSelect?: (result: ResultCardResult) => void;
  /** Artwork height for the tile layout. */
  mediaHeight?: number;
  width?: number | string;
  showExternalLink?: boolean;
  selected?: boolean;
  /** Renders a same-height skeleton. */
  loading?: boolean;
  /** Position in the list (exposed as `data-index`). */
  index?: number;
};

export type ResolvedResultCardLayout = Exclude<ResultCardLayout, "auto">;

/* ------------------------------------------------------------------ */
/* Heights                                                             */
/* ------------------------------------------------------------------ */

export const RESULT_CARD_HEIGHTS = {
  row: 96,
  compact: 124,
  tileBase: 128,
} as const;

export const DEFAULT_MEDIA_HEIGHT = 160;

/**
 * Fixed height of a card for a layout, for grid cells and skeletons.
 * `auto` is measured as a tile (the tallest possibility).
 */
export const getResultCardHeight = (
  layout: ResultCardLayout,
  mediaHeight: number = DEFAULT_MEDIA_HEIGHT,
): number => {
  if (layout === "row") {
    return RESULT_CARD_HEIGHTS.row;
  }
  if (layout === "compact") {
    return RESULT_CARD_HEIGHTS.compact;
  }
  return mediaHeight + RESULT_CARD_HEIGHTS.tileBase;
};

const SMALL_ICON_PATTERN = /\/icons\/56\//;

export const resolveResultCardLayout = (
  layout: ResultCardLayout,
  result: Pick<ResultCardResult, "mediaUrl">,
): ResolvedResultCardLayout => {
  if (layout !== "auto") {
    return layout;
  }
  if (!result.mediaUrl || SMALL_ICON_PATTERN.test(result.mediaUrl)) {
    return "row";
  }
  return "tile";
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const firstText = (
  ...values: Array<string | undefined | null>
): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const joinMeta = (...parts: Array<string | undefined>): string | undefined => {
  const kept = parts.filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return kept.length > 0 ? kept.join(" · ") : undefined;
};

type ExternalLinkTarget = {
  href: string;
  label: string;
};

const resolveExternalLink = (
  result: ResultCardResult,
): ExternalLinkTarget | undefined => {
  if (result.externalUrl) {
    return {
      href: result.externalUrl,
      label: result.externalLabel ?? WOWHEAD_LABEL,
    };
  }

  const link = getExternalLink(result.kind, result.id, result.name);
  return link
    ? { href: link.url, label: result.externalLabel ?? link.label }
    : undefined;
};

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT =
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

type ExternalLinkProps = ExternalLinkTarget & {
  iconOnly?: boolean;
};

/** Sibling of the action area: never nested inside the card button. */
const ExternalLink = ({
  href,
  label,
  iconOnly = false,
}: ExternalLinkProps): JSX.Element => (
  <Link
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    variant="caption"
    aria-label={iconOnly ? label : undefined}
    title={iconOnly ? label : undefined}
    sx={(theme) => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 0.5,
      flexShrink: 0,
      minHeight: 32,
      minWidth: iconOnly ? 32 : undefined,
      paddingInline: iconOnly ? 0 : 1,
      marginInline: iconOnly ? 0 : -1,
      borderRadius: `${theme.wc.radius.sm}px`,
      color: theme.palette.primary.light,
      fontWeight: 500,
      whiteSpace: "nowrap",
      "& svg": { fontSize: 16 },
    })}
  >
    {iconOnly ? null : label}
    <LaunchRounded fontSize="inherit" aria-hidden="true" />
  </Link>
);

type NameProps = {
  name: string;
  lines: 1 | 2;
  quality?: string;
};

const Name = ({ name, lines, quality }: NameProps): JSX.Element => (
  <Typography
    variant="h6"
    component="span"
    sx={(theme) => ({
      ...(lines === 1 ? truncate : lineClamp(2)),
      display: lines === 1 ? "block" : "-webkit-box",
      minWidth: 0,
      color: quality ? qualityColor(theme, quality) : theme.palette.text.primary,
    })}
  >
    {name}
  </Typography>
);

type MetaLineProps = {
  text?: string;
};

const MetaLine = ({ text }: MetaLineProps): JSX.Element | null =>
  text ? (
    <Typography
      variant="caption"
      component="span"
      sx={{ ...truncate, display: "block", minWidth: 0, color: "text.secondary" }}
    >
      {text}
    </Typography>
  ) : null;

type TagChipProps = {
  label?: string;
  tone: ResultCardTone;
};

const TagChip = ({ label, tone }: TagChipProps): JSX.Element | null =>
  label ? (
    <Chip
      label={label}
      size="small"
      color={tone === "secondary" ? "secondary" : "default"}
      variant={tone === "secondary" ? "outlined" : "filled"}
      sx={{ flexShrink: 0, maxWidth: "100%" }}
    />
  ) : null;

type LoadingCardProps = {
  layout: ResolvedResultCardLayout;
  mediaHeight: number;
  width?: number | string;
};

const LoadingCard = ({
  layout,
  mediaHeight,
  width,
}: LoadingCardProps): JSX.Element => {
  const height = getResultCardHeight(layout, mediaHeight);
  const iconSize = layout === "compact" ? 40 : 56;

  return (
    <Card
      variant="outlined"
      aria-hidden="true"
      sx={(theme) => ({
        width: width ?? "100%",
        height: "100%",
        minHeight: height,
        display: "flex",
        flexDirection: layout === "row" ? "row" : "column",
        alignItems: layout === "row" ? "center" : "stretch",
        gap: layout === "row" ? 1.5 : 1,
        padding: layout === "tile" ? 0 : "0 16px",
        borderRadius: `${theme.wc.radius.lg}px`,
        boxSizing: "border-box",
      })}
    >
      {layout === "tile" ? (
        <Skeleton
          variant="rectangular"
          sx={{ height: mediaHeight, width: "100%", borderRadius: "0" }}
        />
      ) : (
        <Skeleton
          variant="rectangular"
          sx={(theme) => ({
            width: iconSize,
            height: iconSize,
            flexShrink: 0,
            marginTop: layout === "compact" ? "12px" : 0,
            borderRadius: `${theme.wc.radius.sm}px`,
          })}
        />
      )}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          padding: layout === "tile" ? "12px 16px" : 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 0.5,
        }}
      >
        <Skeleton variant="text" sx={{ fontSize: "0.9375rem", width: "70%" }} />
        <Skeleton variant="text" sx={{ fontSize: "0.75rem", width: "45%" }} />
      </Box>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* ResultCard                                                          */
/* ------------------------------------------------------------------ */

type BodyProps = {
  interactive: boolean;
  label: string;
  selected: boolean;
  direction: "row" | "column";
  onActivate: () => void;
  children: ReactNode;
};

/** CardActionArea when selectable, a plain Box otherwise; same layout either way. */
const Body = ({
  interactive,
  label,
  selected,
  direction,
  onActivate,
  children,
}: BodyProps): JSX.Element => {
  if (!interactive) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: direction,
          alignItems: "stretch",
          justifyContent: "flex-start",
        }}
      >
        {children}
      </Box>
    );
  }

  return (
    <CardActionArea
      onClick={onActivate}
      aria-label={label}
      aria-current={selected ? "true" : undefined}
      disableRipple
      sx={(theme) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: direction,
        alignItems: "stretch",
        justifyContent: "flex-start",
        textAlign: "left",
        borderRadius: "inherit",
        "&.Mui-focusVisible": focusRing(theme, true),
        "& .MuiCardActionArea-focusHighlight": { display: "none" },
      })}
    >
      {children}
    </CardActionArea>
  );
};

const ResultCard = ({
  result,
  layout = "auto",
  tone = "primary",
  onSelect,
  mediaHeight = DEFAULT_MEDIA_HEIGHT,
  width,
  showExternalLink = true,
  selected = false,
  loading = false,
  index,
}: ResultCardProps): JSX.Element => {
  const resolvedLayout = resolveResultCardLayout(layout, result);

  if (loading) {
    return (
      <LoadingCard layout={resolvedLayout} mediaHeight={mediaHeight} width={width} />
    );
  }

  const interactive = Boolean(onSelect);
  const quality = result.quality;
  const external = showExternalLink ? resolveExternalLink(result) : undefined;
  const isRow = resolvedLayout === "row";
  const isTile = resolvedLayout === "tile";
  const accentEdge: "borderLeftColor" | "borderTopColor" = isTile
    ? "borderTopColor"
    : "borderLeftColor";

  const metaText = firstText(result.subtitle, result.summary, result.details);
  const typeLabel = firstText(result.typeLabel);
  const tag = firstText(result.tag);
  const structuredMeta = result.meta
    ?.map((entry) => joinMeta(entry.label, entry.value))
    .filter((entry): entry is string => Boolean(entry))
    .join(" · ");
  const rowMeta = joinMeta(
    metaText ?? structuredMeta,
    typeLabel !== tag ? typeLabel : undefined,
  );
  const compactMeta = metaText ?? structuredMeta ?? typeLabel;

  const handleActivate = (): void => {
    onSelect?.(result);
  };

  const cardSx = (theme: Theme) => {
    const accent = quality ? qualityColor(theme, quality) : undefined;
    const selectedColor =
      tone === "secondary"
        ? theme.palette.secondary.main
        : theme.palette.primary.main;

    return {
      position: "relative" as const,
      width: width ?? "100%",
      height: "100%",
      minHeight: getResultCardHeight(resolvedLayout, mediaHeight),
      boxSizing: "border-box" as const,
      display: "flex",
      flexDirection: isRow ? ("row" as const) : ("column" as const),
      alignItems: "stretch",
      overflow: "hidden",
      borderRadius: `${theme.wc.radius.lg}px`,
      borderColor: selected ? selectedColor : theme.palette.border.default,
      ...(accent
        ? {
            [isTile ? "borderTopWidth" : "borderLeftWidth"]: 3,
            [accentEdge]: accent,
          }
        : {}),
      transition: theme.transitions.create(
        ["border-color", "box-shadow", "transform"],
        {
          duration: theme.wc.motion.base,
          easing: theme.wc.motion.easing,
        },
      ),
      ...(interactive
        ? {
            [MOTION_HOVER]: {
              "&:hover": {
                borderColor: selected ? selectedColor : theme.palette.border.strong,
                ...(accent ? { [accentEdge]: accent } : {}),
                boxShadow: theme.palette.glow.card,
              },
            },
            [MOTION_HOVER_LIFT]: {
              "&:hover": {
                transform: "translateY(-2px)",
              },
            },
          }
        : {}),
    };
  };

  return (
    <Card
      variant="outlined"
      data-index={index}
      data-layout={resolvedLayout}
      sx={cardSx}
    >
      <Body
        interactive={interactive}
        label={result.name}
        selected={selected}
        direction={isRow ? "row" : "column"}
        onActivate={handleActivate}
      >
        {isRow ? (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              // 16px from the edge whether the accent edge is 3px or 1px.
              paddingLeft: quality ? "13px" : "15px",
              paddingRight: external ? 0.5 : 2,
            }}
          >
            <MediaTile
              src={result.mediaUrl}
              alt=""
              size={56}
              fallbackLabel={result.name}
            />
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              <Name name={result.name} lines={1} quality={quality} />
              <MetaLine text={rowMeta} />
            </Box>
            <TagChip label={tag} tone={tone} />
          </Box>
        ) : null}

        {resolvedLayout === "compact" ? (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              padding: "10px 12px 4px 10px",
            }}
          >
            <MediaTile
              src={result.mediaUrl}
              alt=""
              size={40}
              fallbackLabel={result.name}
            />
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              <Name name={result.name} lines={2} quality={quality} />
              <MetaLine text={compactMeta} />
            </Box>
          </Box>
        ) : null}

        {isTile ? (
          <>
            <Box sx={{ height: mediaHeight, flexShrink: 0, width: "100%" }}>
              <MediaTile
                src={result.mediaUrl}
                alt=""
                size="fill"
                fallbackLabel={result.name}
              />
            </Box>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                padding: "12px 16px 0",
              }}
            >
              <Name name={result.name} lines={2} quality={quality} />
              <MetaLine text={metaText ?? structuredMeta} />
            </Box>
          </>
        ) : null}
      </Body>

      {isRow ? (
        external ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              paddingRight: 1,
            }}
          >
            <ExternalLink href={external.href} label={external.label} iconOnly />
          </Box>
        ) : null
      ) : (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexShrink: 0,
            minHeight: 32,
            padding: isTile ? "2px 16px 10px" : "0 12px 4px 10px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
              flex: 1,
            }}
          >
            <TagChip label={tag} tone={tone} />
            {isTile && typeLabel && typeLabel !== tag ? (
              <Typography
                variant="caption"
                component="span"
                sx={{ ...truncate, color: "text.secondary", minWidth: 0 }}
              >
                {typeLabel}
              </Typography>
            ) : null}
          </Box>
          {external ? (
            <ExternalLink href={external.href} label={external.label} />
          ) : null}
        </Box>
      )}
    </Card>
  );
};

export default memo(ResultCard);
