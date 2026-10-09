import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import type { RefObject } from "react";

import { ErrorState } from "@/components/common/StateBlocks";
import FocusGuard from "@/features/toys/components/FocusGuard";
import { SCAN_RECORDS_PER_MINUTE } from "@/features/toys/hooks/useToySourceScan";
import { pluralize } from "@/features/toys/services/toyService";
import { formatNumber } from "@/lib/format";

export type SourceScanStatusProps = {
  /** The source's name ("Vendor"). */
  sourceName: string;
  checked: number;
  total: number;
  /** Matches found so far, in list order. */
  found: number;
  running: boolean;
  /** The page has its matches; the rest is read on the next page or "check all". */
  paused: boolean;
  /** "Check all" was pressed: the readers go through the whole list. */
  readingAll: boolean;
  error: Error | null;
  onResume: () => void;
  onReadAll: () => void;
  /** Where focus goes when the control that had it goes away. */
  focusFallbackRef: RefObject<HTMLElement>;
};

/**
 * How far the source filter has got. Blizzard's toy index has no sources,
 * so the listed toys' records are read (see useToySourceScan); this says so,
 * shows how many have been checked and found, offers to check the whole
 * list (for the last pages and exact counts) and Resume when a failure
 * stopped it. The numbers are not a live region: they change several times
 * a second. The filter bar's summary announces where it settles.
 */
const SourceScanStatus = ({
  sourceName,
  checked,
  total,
  found,
  running,
  paused,
  readingAll,
  error,
  onResume,
  onReadAll,
  focusFallbackRef,
}: SourceScanStatusProps): JSX.Element => {
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
  const remaining = Math.max(0, total - checked);
  const minutes = Math.max(1, Math.ceil(remaining / SCAN_RECORDS_PER_MINUTE));
  const foundText = pluralize(found, `${sourceName} toy`, `${sourceName} toys`);

  let stateText: string;
  if (error) {
    stateText = `Stopped after ${formatNumber(checked)} of ${pluralize(total, "toy", "toys")} · ${foundText} so far`;
  } else if (paused) {
    stateText = `${formatNumber(checked)} of ${pluralize(total, "toy", "toys")} checked · ${foundText} so far: enough for this page, and the next one reads on.`;
  } else {
    stateText = `Checking ${formatNumber(checked)} of ${pluralize(total, "toy", "toys")} · ${foundText} so far`;
  }

  return (
    <FocusGuard fallbackRef={focusFallbackRef}>
      <Box
        sx={(theme) => ({
          p: 1.5,
          borderRadius: `${theme.wc.radius.md}px`,
          border: `1px solid ${theme.palette.border.default}`,
          backgroundColor: theme.palette.surface.inset,
        })}
      >
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <ManageSearchRoundedIcon
              aria-hidden
              fontSize="small"
              sx={{ color: "text.secondary", mt: 0.25 }}
            />
            <Typography variant="body2" component="p" sx={{ m: 0, minWidth: 0 }}>
              Blizzard&rsquo;s toy index lists names only, so each listed toy&rsquo;s
              record is read to find its source: a few a second, in the order shown,
              and kept in this browser for a day.
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={percent}
            aria-label="Toy records checked"
            aria-valuetext={`${formatNumber(checked)} of ${formatNumber(total)}`}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ m: 0, minWidth: 0, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}
            >
              {stateText}
            </Typography>
            {error === null && remaining > 0 ? (
              <FocusGuard fallbackRef={focusFallbackRef}>
                {/* Stays put (and focused) once pressed; focusable while it
                    works, so it says so instead of going disabled. */}
                <Button
                  size="small"
                  variant="outlined"
                  aria-disabled={readingAll || undefined}
                  onClick={() => {
                    if (!readingAll) {
                      onReadAll();
                    }
                  }}
                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  {readingAll
                    ? "Checking them all…"
                    : `Check all ${formatNumber(total)} (about ${minutes} min)`}
                </Button>
              </FocusGuard>
            ) : null}
          </Stack>
          {error ? (
            <FocusGuard fallbackRef={focusFallbackRef}>
              <ErrorState
                compact
                error={error}
                title="Source check stopped"
                context="every toy's source"
                onRetry={() => {
                  // A press while the resumed scan is starting is ignored.
                  if (!running) {
                    onResume();
                  }
                }}
                retryLabel={running ? "Resuming…" : "Resume"}
              />
            </FocusGuard>
          ) : null}
        </Stack>
      </Box>
    </FocusGuard>
  );
};

export default SourceScanStatus;
