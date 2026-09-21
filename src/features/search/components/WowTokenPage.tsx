import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useState } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState } from "@/components/common/StateBlocks";
import TokenSparkline from "@/features/search/components/TokenSparkline";
import TokenTicker from "@/features/search/components/TokenTicker";
import { useWowTokenHistory } from "@/features/search/hooks/useWowTokenHistory";
import type { TokenHistoryPoint } from "@/features/search/hooks/useWowTokenHistory";
import {
  TOKEN_REFRESH_MINUTES,
  useWowTokenPrice,
} from "@/features/search/hooks/useWowTokenPrice";
import { formatCopper, formatNumber, formatRelativeTime } from "@/lib/format";
import { tokens } from "@/theme";

const SECTION_GAP = tokens.wc.layout.sectionGap;
const MIN_SAMPLES = 2;

type HistoryStats = {
  high: number;
  low: number;
  change: number;
  first: TokenHistoryPoint;
};

const summarizeHistory = (points: TokenHistoryPoint[]): HistoryStats => {
  const prices = points.map((point) => point.price);
  const first = points[0];
  const last = points[points.length - 1];
  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    change: last.price - first.price,
    first,
  };
};

type StatChipProps = {
  label: string;
  copper: number;
  signed?: boolean;
};

/** "High 287,863g" as a chip; the change is signed and coloured. */
const StatChip = ({ label, copper, signed = false }: StatChipProps): JSX.Element => {
  const direction = copper > 0 ? "up" : copper < 0 ? "down" : "flat";
  const spoken = `${label} ${
    signed && direction !== "flat"
      ? `${direction} ${formatCopper(Math.abs(copper), { style: "long" })}`
      : formatCopper(Math.abs(copper), { style: "long" })
  }`;

  return (
    <Chip
      variant="outlined"
      aria-label={spoken}
      label={
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75 }}
        >
          <Typography component="span" variant="caption" color="text.secondary">
            {label}
          </Typography>
          {signed && direction !== "flat" ? (
            <Box
              component="span"
              aria-hidden="true"
              sx={(theme) => ({
                fontWeight: 700,
                color:
                  direction === "up"
                    ? theme.palette.success.main
                    : theme.palette.error.main,
              })}
            >
              {direction === "up" ? "+" : "−"}
            </Box>
          ) : null}
          <GoldAmount copper={Math.abs(copper)} size="small" />
        </Box>
      }
      sx={{ height: "auto", py: 0.5, fontVariantNumeric: "tabular-nums" }}
    />
  );
};

/**
 * /category/wow-token body: the live ticker plus the price history collected
 * while WoW Citadel is open. The route's PageHeader is rendered by the host.
 */
const WowTokenPage = (): JSX.Element => {
  const { data } = useWowTokenPrice();
  const { points, clear } = useWowTokenHistory(data);
  const [now] = useState(() => Date.now());

  const hasHistory = points.length >= MIN_SAMPLES;
  const stats = hasHistory ? summarizeHistory(points) : undefined;

  return (
    <Stack spacing={SECTION_GAP}>
      <TokenTicker titleAs="p" />

      <SectionCard
        title="Session price history"
        titleAs="h2"
        tone="gold"
        description="Collected while WoW Citadel is open; Blizzard publishes a new price roughly every 20 minutes."
        actions={
          points.length > 0 ? (
            <Button variant="text" size="small" onClick={clear}>
              Clear history
            </Button>
          ) : undefined
        }
      >
        {stats ? (
          <Stack spacing={2} sx={{ fontVariantNumeric: "tabular-nums" }}>
            <TokenSparkline points={points} height={96} />
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              alignItems="center"
            >
              <StatChip label="High" copper={stats.high} />
              <StatChip label="Low" copper={stats.low} />
              <StatChip label="Change" copper={stats.change} signed />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {formatNumber(points.length)} samples since{" "}
              {formatRelativeTime(stats.first.t, now)}
            </Typography>
          </Stack>
        ) : (
          <EmptyState
            compact
            title="Not enough samples yet"
            description={`Keep this page open; the next price lands within ${TOKEN_REFRESH_MINUTES} minutes.`}
          />
        )}
      </SectionCard>
    </Stack>
  );
};

export default WowTokenPage;
