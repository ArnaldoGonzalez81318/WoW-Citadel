import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";

import { ErrorState, LiveStatus } from "@/components/common/StateBlocks";
import type { FamilyScan } from "@/features/battlePets/hooks/useFamilyScan";
import { formatNumber } from "@/lib/format";

export type FamilyCoverageProps = {
  /** Records whose family is known (on this device, within the day). */
  known: number;
  total: number;
  noun: { one: string; many: string };
  /** The count-everything scan, while it is wanted. */
  scan: FamilyScan | null;
  onStart: () => void;
  /** Stop, dismiss a failed count, or (once everything is counted) close. */
  onStop: () => void;
};

/**
 * Under the family tiles until every family's size is known: how far the
 * page's knowledge reaches, and an explicit action to fetch the rest (one
 * record per entry, at the scan's polite pace, with its progress and a Stop
 * button). Once every record's family is known the tiles carry the counts;
 * a count the visitor started ends on a Done button in the same place, so
 * focus never drops from under them.
 */
const FamilyCoverage = ({
  known,
  total,
  noun,
  scan,
  onStart,
  onStop,
}: FamilyCoverageProps): JSX.Element | null => {
  const counted = known >= total;
  if (total === 0 || (counted && scan === null)) {
    return null;
  }
  const running = scan !== null && !counted && scan.error === null;
  const percent = Math.min(100, Math.round((known / total) * 100));

  let message: string;
  let label: string;
  if (counted) {
    message = `Every ${noun.one}'s family is counted: the tiles show the totals.`;
    label = "Done";
  } else if (running) {
    message = `Counting: ${formatNumber(known)} of ${formatNumber(total)} ${noun.many} checked (${percent}%)`;
    label = "Stop counting";
  } else {
    message = `Family known for ${formatNumber(known)} of ${formatNumber(total)} ${noun.many} on this device. Blizzard's index has no families, so counting them reads every ${noun.one}'s record, a few a second.`;
    // With a scan, this branch means it failed: its alert says "Counting
    // stopped", so the button puts the failed count away (and, keeping
    // focus, becomes "Count every family").
    label = scan !== null ? "Dismiss" : "Count every family";
  }

  return (
    <Stack spacing={1.25}>
      {scan?.error && !counted ? (
        <ErrorState
          compact
          error={scan.error}
          title="Counting stopped"
          context={`${noun.one} records`}
          onRetry={scan.retry}
          retryLabel={scan.retrying ? "Retrying…" : "Retry"}
        />
      ) : null}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        useFlexGap
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {/* The finished count is announced below; this copy is for the eye
              then, so it is not read twice. */}
          <Typography
            variant="body2"
            color="text.secondary"
            component="p"
            aria-hidden={counted || undefined}
            sx={{ m: 0 }}
          >
            {message}
          </Typography>
          {running ? (
            <LinearProgress
              variant="determinate"
              value={percent}
              aria-label={`Counting ${noun.many} per family`}
              sx={{ mt: 0.75, height: 4, borderRadius: 2 }}
            />
          ) : null}
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={scan !== null ? onStop : onStart}
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
        >
          {label}
        </Button>
      </Stack>
      {/* Mounted from the first render so the end of a count that ran for
          minutes is announced; the progress ticks are not. */}
      <LiveStatus visuallyHidden>{counted ? message : ""}</LiveStatus>
    </Stack>
  );
};

export default FamilyCoverage;
