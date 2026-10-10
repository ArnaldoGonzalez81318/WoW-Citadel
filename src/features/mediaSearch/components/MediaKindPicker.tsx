import CollectionsRoundedIcon from "@mui/icons-material/CollectionsRounded";
import {
  Box,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useRef } from "react";

import MediaTile from "@/components/common/MediaTile";
import { MEDIA_TAGS } from "@/features/mediaSearch/config/mediaKinds";
import { recordAssetUrl } from "@/features/mediaSearch/services/mediaSearchService";
import type {
  MediaScope,
  MediaTagSummary,
} from "@/features/mediaSearch/types";
import { formatNumber } from "@/lib/format";
import { mixins } from "@/theme";

export type TagSummaryState = {
  summary?: MediaTagSummary;
  pending: boolean;
};

export type MediaKindPickerProps = {
  value: MediaScope;
  onChange: (scope: MediaScope) => void;
  /** Count and sample per tag (Everything has none). */
  summaries: ReadonlyMap<MediaScope, TagSummaryState>;
};

/** "1,000+" past Blizzard's cap, where it stops counting. */
export const formatTagCount = (summary: MediaTagSummary): string =>
  summary.capped ? `${formatNumber(summary.count)}+` : formatNumber(summary.count);

const TILE_MIN_WIDTH = 152;

/**
 * Every media tag as a tile with a sample image (the newest, where Blizzard
 * can sort the kind; whichever it returns first otherwise) and its result
 * count, one pressed at a time (a toggle-button group: each tile is a Tab stop with
 * aria-pressed). Phones get one scrolling row instead of ten rows of tiles
 * above the grid; wider screens get the whole grid.
 */
const MediaKindPicker = ({
  value,
  onChange,
  summaries,
}: MediaKindPickerProps): JSX.Element => {
  const stripRef = useRef<HTMLDivElement>(null);

  // On the phone strip, bring the pressed tile into view (a shared link
  // may name one far along the row). Only the strip scrolls, never the page.
  useEffect(() => {
    const strip = stripRef.current;
    const pressed = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !pressed || strip.scrollWidth <= strip.clientWidth) {
      return;
    }
    const target =
      pressed.offsetLeft - (strip.clientWidth - pressed.offsetWidth) / 2;
    strip.scrollLeft = Math.max(0, target);
  }, [value]);

  return (
    <ToggleButtonGroup
      ref={stripRef}
      exclusive
      value={value}
      onChange={(_event, next: MediaScope | null) => {
        // Pressing the selected tile again would clear it; the grid always shows a kind.
        if (next !== null) {
          onChange(next);
        }
      }}
      aria-label="Media kind"
      sx={(theme) => ({
        position: "relative",
        minWidth: 0,
        maxWidth: "100%",
        display: { xs: "flex", sm: "grid" },
        gridTemplateColumns: {
          sm: "repeat(3, minmax(0, 1fr))",
          md: "repeat(4, minmax(0, 1fr))",
          lg: "repeat(5, minmax(0, 1fr))",
        },
        gap: 1,
        overflowX: { xs: "auto", sm: "visible" },
        scrollSnapType: { xs: "x proximity", sm: "none" },
        // Room for the focus ring and a scrollbar on the phone strip.
        paddingBottom: { xs: 1, sm: 0 },
        paddingTop: { xs: 0.25, sm: 0 },
        "& .MuiToggleButtonGroup-grouped": {
          // Undo the group's joined-edge styling: these are separate tiles.
          margin: 0,
          border: `1px solid ${theme.palette.border.subtle}`,
          borderRadius: `${theme.wc.radius.md}px !important`,
        },
      })}
    >
      {MEDIA_TAGS.map((tag) => {
        const state = summaries.get(tag.id);
        const summary = state?.summary;
        // The sample's best asset, not its first: a kind whose sample
        // carries several images (a journal instance's tile and its large
        // copy) should show the one meant for a tile this size.
        const sampleUrl = recordAssetUrl(summary?.sample);
        return (
          <ToggleButton
            key={tag.id}
            value={tag.id}
            sx={(theme) => ({
              flex: { xs: `0 0 ${TILE_MIN_WIDTH}px`, sm: "initial" },
              scrollSnapAlign: "start",
              minWidth: 0,
              justifyContent: "flex-start",
              gap: 1.25,
              padding: "8px 10px",
              textTransform: "none",
              textAlign: "left",
              color: "text.secondary",
              "&.Mui-selected": {
                color: "text.primary",
                borderColor: `${theme.palette.primary.main} !important`,
                boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
              },
            })}
          >
            {tag.id === "all" ? (
              <Box
                aria-hidden="true"
                sx={(theme) => ({
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: `${theme.wc.radius.sm}px`,
                  border: `1px solid ${theme.palette.border.subtle}`,
                  backgroundColor: theme.palette.surface.sunken,
                  color: theme.palette.secondary.main,
                })}
              >
                <CollectionsRoundedIcon fontSize="small" />
              </Box>
            ) : (
              <MediaTile
                size={40}
                src={sampleUrl}
                alt=""
                fallbackLabel={tag.label}
                loading={state?.pending ?? false}
              />
            )}
            <Box component="span" sx={{ display: "block", minWidth: 0 }}>
              <Typography
                variant="body2"
                component="span"
                sx={{ ...mixins.truncate, display: "block", fontWeight: 600 }}
              >
                {tag.label}
              </Typography>
              {tag.id === "all" ? (
                <Typography variant="caption" component="span" sx={{ display: "block" }}>
                  Every kind
                </Typography>
              ) : summary ? (
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}
                >
                  {formatTagCount(summary)}
                </Typography>
              ) : state?.pending ? (
                <Skeleton variant="text" width={40} sx={{ fontSize: "0.75rem" }} />
              ) : null}
            </Box>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
};

export default MediaKindPicker;
