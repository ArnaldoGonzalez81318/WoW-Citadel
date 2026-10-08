import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import {
  Box,
  Button,
  ButtonBase,
  Pagination,
  Skeleton,
  Stack,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import {
  gridTemplateColumnsSx,
  useGridColumns,
} from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { EmptyState, LiveStatus } from "@/components/common/StateBlocks";
import useCrestArt from "@/features/guildCrests/hooks/useCrestArt";
import { tintMatrix } from "@/features/guildCrests/services/guildCrestService";
import type { CrestColor, CrestPart } from "@/features/guildCrests/types";
import { formatNumber } from "@/lib/format";

/**
 * Columns for the designer's right-hand column (beside the preview on md+),
 * so a tile stays 56–140px wide at every width.
 */
export const EMBLEM_COLS: GridColumns = { xs: 4, sm: 6, md: 6, lg: 8 };
/**
 * Six full rows a page (24 tiles on phones, 48 on wide screens) rather than
 * a fixed 25: a ragged last row reads as a missing emblem. The tiles cost no
 * API requests (their art URLs are derived), only small CDN images.
 */
export const EMBLEM_ROWS = 6;
const TILE_GAP = 1;
const NEUTRAL_FIELD = "#2A3242";

const plural = (count: number): string =>
  `${formatNumber(count)} ${count === 1 ? "emblem" : "emblems"}`;

/** "#042" -> "42"; anything but digits is not an emblem number. */
const normalizeTerm = (raw: string): string | null => {
  const trimmed = raw.trim().replace(/^#/, "");
  if (trimmed === "") {
    return "";
  }
  return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, "") : null;
};

type EmblemTileProps = {
  emblem: CrestPart;
  pressed: boolean;
  emblemColor?: CrestColor;
  backgroundColor?: CrestColor;
  onSelect: (emblemId: number) => void;
};

const tileSx = (pressed: boolean) => (theme: Theme) => ({
  position: "relative" as const,
  display: "block",
  width: "100%",
  aspectRatio: "1 / 1",
  overflow: "hidden",
  borderRadius: `${theme.wc.radius.md}px`,
  border: `1px solid ${pressed ? theme.palette.primary.main : theme.palette.border.subtle}`,
  boxShadow: pressed ? `inset 0 0 0 1px ${theme.palette.primary.main}` : "none",
  transition: theme.transitions.create(["border-color", "box-shadow"], {
    duration: theme.wc.motion.fast,
  }),
  "@media (hover: hover)": {
    "&:hover": {
      borderColor: pressed ? theme.palette.primary.main : theme.palette.border.strong,
    },
  },
  // A soft vignette, so the flat field reads as cloth rather than a sticker.
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    boxShadow: `inset 0 0 18px ${alpha("#000000", 0.38)}`,
  },
});

/**
 * One emblem in the crest's own colours: the emblem colour multiplied into
 * the art on the background colour, so the grid previews the real result.
 */
const EmblemTile = memo(function EmblemTile({
  emblem,
  pressed,
  emblemColor,
  backgroundColor,
  onSelect,
}: EmblemTileProps): JSX.Element {
  const art = useCrestArt("emblem", emblem);
  const filterId = `emblem-tile-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  return (
    <ButtonBase
      aria-pressed={pressed}
      aria-label={`Emblem ${emblem.id}${art.missing ? " (art unavailable)" : ""}`}
      onClick={() => onSelect(emblem.id)}
      sx={tileSx(pressed)}
    >
      {art.loading ? (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      ) : (
        <svg
          viewBox="0 0 125 125"
          aria-hidden="true"
          focusable="false"
          style={{ display: "block", width: "100%", height: "100%" }}
        >
          {emblemColor ? (
            <defs>
              <filter id={filterId} colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values={tintMatrix(emblemColor)} />
              </filter>
            </defs>
          ) : null}
          <rect width="125" height="125" fill={backgroundColor?.hex ?? NEUTRAL_FIELD} />
          {art.src ? (
            <image
              href={art.src}
              x="4"
              y="4"
              width="117"
              height="117"
              filter={emblemColor ? `url(#${filterId})` : undefined}
              onError={art.onError}
            />
          ) : null}
        </svg>
      )}
      {art.missing ? (
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "text.secondary",
            "& svg": { fontSize: 28, opacity: 0.6 },
          }}
        >
          <ShieldOutlined />
        </Box>
      ) : null}
      <Box
        component="span"
        sx={(theme) => ({
          position: "absolute",
          right: 4,
          bottom: 4,
          zIndex: 1,
          px: 0.5,
          borderRadius: `${theme.wc.radius.sm}px`,
          backgroundColor: alpha(theme.palette.surface.base, 0.72),
          color: theme.palette.text.primary,
          fontSize: "0.6875rem",
          fontWeight: 600,
          lineHeight: 1.5,
          fontVariantNumeric: "tabular-nums",
        })}
      >
        {emblem.id}
      </Box>
      {pressed ? (
        <CheckCircleRounded
          aria-hidden="true"
          sx={(theme) => ({
            position: "absolute",
            top: 4,
            right: 4,
            zIndex: 1,
            fontSize: 18,
            color: theme.palette.primary.light,
            backgroundColor: theme.palette.surface.base,
            borderRadius: "50%",
          })}
        />
      ) : null}
    </ButtonBase>
  );
});

export type EmblemPickerProps = {
  emblems: CrestPart[];
  value: number | null;
  onChange: (emblemId: number) => void;
  emblemColor?: CrestColor;
  backgroundColor?: CrestColor;
  /** Id of the visible "Emblems" heading. */
  labelledBy: string;
};

/**
 * Every emblem as a tile in the crest's colours, six rows to a page, with a
 * number filter (Blizzard names no emblem, so the number is all there is to
 * search). The page follows the selection when it changes from elsewhere (a
 * random crest, a shared link, Back), so the pressed tile is in view.
 */
const EmblemPicker = ({
  emblems,
  value,
  onChange,
  emblemColor,
  backgroundColor,
  labelledBy,
}: EmblemPickerProps): JSX.Element => {
  const columns = useGridColumns(EMBLEM_COLS);
  const pageSize = columns * EMBLEM_ROWS;
  const [search, setSearch] = useState("");
  // Start on the selection's page (a shared link, Back): starting on page 1
  // would build, and start loading the art of, a page of tiles the effect
  // below throws away a moment later.
  const [page, setPage] = useState(() => {
    const index = value === null ? -1 : emblems.findIndex((emblem) => emblem.id === value);
    return index >= 0 ? Math.floor(index / pageSize) + 1 : 1;
  });

  const term = normalizeTerm(search);
  const filtered = useMemo(() => {
    if (term === "") {
      return emblems;
    }
    if (term === null) {
      return [];
    }
    return emblems.filter((emblem) => String(emblem.id).startsWith(term));
  }, [emblems, term]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  // Show the selected emblem's page whenever the selection or the page size
  // changes (a click on a visible tile lands on the same page: no jump).
  useEffect(() => {
    if (search.trim() !== "" || value === null) {
      return;
    }
    const index = emblems.findIndex((emblem) => emblem.id === value);
    if (index >= 0) {
      setPage(Math.floor(index / pageSize) + 1);
    }
  }, [value, pageSize, emblems, search]);

  // A grid is read from the top: a new page starts at its first row, but
  // only scroll when that row is above the fold (a short grid stays put).
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setPage(next);
    const node = listTopRef.current;
    if (!node) {
      return;
    }
    const margin = Number.parseFloat(window.getComputedStyle(node).scrollMarginTop) || 0;
    if (node.getBoundingClientRect().top < margin) {
      node.scrollIntoView({ block: "start" });
    }
  };

  const handleSearch = (next: string): void => {
    setSearch(next);
    setPage(1);
  };

  const firstId = emblems[0]?.id ?? 0;
  const lastId = emblems[emblems.length - 1]?.id ?? 0;
  const end = Math.min(start + pageSize, filtered.length);
  const range = `${formatNumber(start + 1)}–${formatNumber(end)}`;
  let summary: string;
  if (filtered.length === 0) {
    summary = "No matching emblems";
  } else if (term) {
    const verb = filtered.length === 1 ? "matches" : "match";
    summary = `${plural(filtered.length)} ${verb} “${term}”${pageCount > 1 ? ` · showing ${range}` : ""}`;
  } else {
    summary = pageCount > 1 ? `Showing ${range} of ${plural(emblems.length)}` : plural(emblems.length);
  }

  return (
    <Stack
      spacing={2}
      ref={listTopRef}
      sx={(theme) => ({
        scrollMarginTop: {
          xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
          md: `${theme.wc.layout.headerHeight.md + 16}px`,
        },
      })}
    >
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="center">
        <SearchField
          size="small"
          label="Find an emblem by number"
          placeholder="Emblem number"
          value={search}
          onChange={handleSearch}
          sx={{ minWidth: { xs: 0, sm: 220 }, maxWidth: { sm: 320 } }}
        />
        <LiveStatus
          sx={{
            flex: { xs: "1 1 100%", md: "0 1 auto" },
            minWidth: 0,
            marginLeft: { md: "auto" },
            overflowWrap: "anywhere",
          }}
        >
          {summary}
        </LiveStatus>
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState
          compact
          title={`No emblem numbered “${search.trim()}”`}
          description={`Emblems are numbered ${formatNumber(firstId)} to ${formatNumber(lastId)}.`}
          action={
            <Button variant="outlined" size="small" onClick={() => handleSearch("")}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <Box
          component="ul"
          role="list"
          aria-labelledby={labelledBy}
          sx={{
            display: "grid",
            gap: TILE_GAP,
            listStyle: "none",
            m: 0,
            p: 0,
            ...gridTemplateColumnsSx(EMBLEM_COLS),
          }}
        >
          {visible.map((emblem) => (
            <Box component="li" key={emblem.id} sx={{ minWidth: 0 }}>
              <EmblemTile
                emblem={emblem}
                pressed={emblem.id === value}
                emblemColor={emblemColor}
                backgroundColor={backgroundColor}
                onSelect={onChange}
              />
            </Box>
          ))}
        </Box>
      )}

      {pageCount > 1 ? (
        <Pagination
          count={pageCount}
          page={currentPage}
          onChange={(_event, next) => handlePageChange(next)}
          siblingCount={0}
          aria-label="Emblem pages"
          sx={{
            alignSelf: "center",
            // Seven items (nine pages on phones) on one row at 320px.
            "& .MuiPaginationItem-root": { minWidth: { xs: 28, sm: 32 }, mx: { xs: "1px", sm: "3px" } },
          }}
        />
      ) : null}
    </Stack>
  );
};

export default EmblemPicker;
