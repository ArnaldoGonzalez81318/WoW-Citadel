import { Box } from "@mui/material";

import { ErrorState } from "@/components/common/StateBlocks";
import type { TileRetry } from "@/features/home/hooks/useTileRetry";
import { formatNumber } from "@/lib/format";

export type TileRetryAlertProps = {
  tileRetry: TileRetry;
  /** "dungeon" / "dungeons". */
  one: string;
  many: string;
};

/**
 * The panel's one alert for tiles whose details failed, under the grid.
 * Its Retry is never disabled and never swapped for a spinner: either
 * would drop the focus the viewer just put on it (see useTileRetry).
 */
const TileRetryAlert = ({ tileRetry, one, many }: TileRetryAlertProps): JSX.Element | null => {
  const { visible, error, count, retry, alertFocusProps } = tileRetry;
  if (!visible) {
    return null;
  }
  return (
    <Box {...alertFocusProps}>
      <ErrorState
        compact
        error={error}
        context={`details for ${formatNumber(count)} ${count === 1 ? one : many}`}
        onRetry={retry}
      />
    </Box>
  );
};

export default TileRetryAlert;
