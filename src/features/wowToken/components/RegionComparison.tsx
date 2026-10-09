import { Box, Typography } from "@mui/material";

import GoldAmount from "@/components/common/GoldAmount";
import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import RegionPriceCard from "@/features/wowToken/components/RegionPriceCard";
import type { RegionRank } from "@/features/wowToken/components/RegionPriceCard";
import { formatMultiple } from "@/features/wowToken/services/tokenStats";
import type {
  Region,
  RegionPrice,
  TokenHistories,
} from "@/features/wowToken/types";

export type RegionComparisonProps = {
  prices: readonly RegionPrice[];
  histories: TokenHistories;
  now: number;
  /** The region on the history chart. */
  selectedRegion: Region;
  onShowHistory: (price: RegionPrice) => void;
};

/** Four regions: one row on large screens, two by two below, one per row on phones. */
const CARD_COLS: GridColumns = { xs: 1, sm: 2, lg: 4 };

/**
 * The token in every region side by side. Lowest and highest are only
 * named once all four prices are in, so a slow region can never be
 * labelled the cheapest by default.
 */
const RegionComparison = ({
  prices,
  histories,
  now,
  selectedRegion,
  onShowHistory,
}: RegionComparisonProps): JSX.Element => {
  const loaded = prices.filter((entry) => entry.token.data !== undefined);
  const amounts = loaded.map((entry) => entry.token.data?.price ?? 0);
  const maxPrice = amounts.length > 0 ? Math.max(...amounts) : undefined;
  const minPrice = amounts.length > 0 ? Math.min(...amounts) : undefined;
  const allIn = loaded.length === prices.length && prices.length > 1;
  const spread = allIn && minPrice !== undefined && maxPrice !== undefined && maxPrice > minPrice;

  const rankOf = (entry: RegionPrice): RegionRank => {
    if (!spread) {
      return null;
    }
    const value = entry.token.data?.price;
    if (value === maxPrice) {
      return "highest";
    }
    return value === minPrice ? "lowest" : null;
  };

  const home = prices.find((entry) => entry.isHome);
  const cheapest = spread ? loaded.find((entry) => entry.token.data?.price === minPrice) : undefined;
  const dearest = spread ? loaded.find((entry) => entry.token.data?.price === maxPrice) : undefined;

  return (
    <SectionCard
      title="Every region"
      description="Blizzard publishes a separate token price for each of its four API regions. Bars compare each price with the highest."
    >
      <Box
        component="ul"
        // Safari drops the list role from a list-style:none list without it.
        role="list"
        aria-label="WoW Token price by region"
        sx={{ display: "grid", gap: 2, listStyle: "none", m: 0, p: 0, ...gridTemplateColumnsSx(CARD_COLS) }}
      >
        {prices.map((entry) => (
          <Box component="li" key={entry.region} sx={{ minWidth: 0 }}>
            <RegionPriceCard
              price={entry}
              history={histories[entry.region]}
              now={now}
              maxPrice={maxPrice}
              homePrice={home?.token.data?.price}
              homeTag={home?.tag ?? ""}
              rank={rankOf(entry)}
              selected={entry.region === selectedRegion}
              onShowHistory={onShowHistory}
            />
          </Box>
        ))}
      </Box>
      {cheapest && dearest && minPrice !== undefined && maxPrice !== undefined ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mt: 2 }}>
          {`A token costs ${formatMultiple(maxPrice / minPrice)} as much gold in ${dearest.name ?? dearest.tag} as in ${
            cheapest.name ?? cheapest.tag
          }: `}
          <GoldAmount copper={maxPrice - minPrice} />
          {" more."}
        </Typography>
      ) : null}
    </SectionCard>
  );
};

export default RegionComparison;
