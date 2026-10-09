import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import MonetizationOnRoundedIcon from "@mui/icons-material/MonetizationOnRounded";
import { Button, Chip, CircularProgress, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import { WOW_TOKEN_ITEM_ID } from "@/features/regions/hooks/regionQueries";
import { useNow } from "@/features/search/hooks/useNow";
import { TOKEN_REFRESH_MINUTES } from "@/features/search/hooks/useWowTokenPrice";
import PriceHistorySection from "@/features/wowToken/components/PriceHistorySection";
import RegionComparison from "@/features/wowToken/components/RegionComparison";
import TokenCalculators from "@/features/wowToken/components/TokenCalculators";
import TokenHero from "@/features/wowToken/components/TokenHero";
import TokenItemsSection from "@/features/wowToken/components/TokenItemsSection";
import useRegionTokenPrices from "@/features/wowToken/hooks/useRegionTokenPrices";
import {
  useRecordTokenSamples,
  useTokenHistories,
} from "@/features/wowToken/hooks/useTokenHistories";
import { tokenItemIconQuery, tokenItemQuery } from "@/features/wowToken/hooks/wowTokenQueries";
import {
  DEFAULT_GAME_TIME_DAYS,
  gameTimeDaysFrom,
} from "@/features/wowToken/services/tokenItemService";
import {
  DEFAULT_PUBLISH_MS,
  isHistoryRange,
  pluralize,
  publishCadence,
} from "@/features/wowToken/services/tokenStats";
import type { HistoryRange, Region, RegionPrice } from "@/features/wowToken/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import type { SearchParamsPatch } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { isRegion } from "@/lib/region";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/**
 * `region` picks the region on the history chart and in the calculators
 * (the hero always shows the app's own); `range` how far back the chart
 * looks. Both are left out of the URL at their defaults.
 */
const URL_DEFAULTS: { region: string; range: string } = {
  region: env.region,
  range: "all",
};
type TokenParams = typeof URL_DEFAULTS;

/** "EU", " eu " -> "eu"; anything else is not a region. */
const parseRegion = (value: string): Region | null => {
  const normalized = value.trim().toLowerCase();
  return isRegion(normalized) ? normalized : null;
};

const parseRange = (value: string): HistoryRange => {
  const normalized = value.trim().toLowerCase();
  return isHistoryRange(normalized) ? normalized : "all";
};

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/**
 * WoW Token: the token's live gold price, which is all Blizzard's API
 * publishes about it. The app's own region heads the page with how the
 * price moved and when the next one is due; all four regions sit side by
 * side below it; then the history this browser recorded (Blizzard keeps
 * none), calculators for gold, tokens and game time, and the two token
 * items in Blizzard's own words.
 */
const WowTokenPage = ({
  eyebrow = "Competitive & Economy",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const region = parseRegion(params.region) ?? env.region;
  const range = parseRange(params.range);

  // The address bar names what is on screen: an unknown or differently
  // cased value is replaced (a default simply drops out), without a
  // history entry.
  useEffect(() => {
    const patch: SearchParamsPatch<TokenParams> = {};
    if (params.region !== region) {
      patch.region = region;
    }
    if (params.range !== range) {
      patch.range = range;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [params.region, params.range, region, range, setParams]);

  // One clock for every "published … ago", range window and due time.
  const now = useNow();
  const prices = useRegionTokenPrices();
  useRecordTokenSamples(prices);
  const histories = useTokenHistories();

  const home = prices.find((entry) => entry.isHome) ?? prices[0];
  const selected = prices.find((entry) => entry.region === region) ?? home;

  // The redeemable token's record names the item and says how many days a
  // token adds; its icon is the Items explorer's cache entry.
  const itemQuery = useQuery(tokenItemQuery(WOW_TOKEN_ITEM_ID));
  const iconQuery = useQuery(tokenItemIconQuery(WOW_TOKEN_ITEM_ID));
  const parsedDays = gameTimeDaysFrom(itemQuery.data?.description);
  const gameTimeDays = parsedDays ?? DEFAULT_GAME_TIME_DAYS;
  const itemText = parsedDays !== null ? itemQuery.data?.description : undefined;
  const itemName = itemQuery.data?.name || "WoW Token";

  const homeCadence = useMemo(() => publishCadence(histories[home.region]), [histories, home.region]);
  const selectedCadence = useMemo(
    () => publishCadence(histories[selected.region]),
    [histories, selected.region],
  );
  const storedCount = prices.reduce((total, entry) => total + histories[entry.region].length, 0);

  const regionOptions: SegmentedOption<Region>[] = prices.map((entry) => ({
    value: entry.region,
    label: entry.tag,
  }));

  /* ---------------- Handlers ---------------- */

  const handleRegionChange = useCallback(
    (next: Region) => setParams({ region: next }),
    [setParams],
  );
  // A narrower or wider window refines the same chart: no history entry.
  const handleRangeChange = useCallback(
    (next: HistoryRange) => setParams({ range: next }, { replace: true }),
    [setParams],
  );

  // "Price history" buttons pick their region, then bring the chart up and
  // put focus on its heading once the pick has rendered. `seq` makes a
  // repeat request a new value.
  const historyHeadingRef = useRef<HTMLHeadingElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    const heading = historyHeadingRef.current;
    if (focusRequest === 0 || !heading) {
      return;
    }
    heading.closest("section")?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    heading.focus({ preventScroll: true });
  }, [focusRequest]);

  const showHistory = useCallback(
    (entry: RegionPrice) => {
      // Re-picking the region on screen only scrolls; it adds no history entry.
      if (entry.region !== region) {
        handleRegionChange(entry.region);
      }
      setFocusRequest((seq) => seq + 1);
    },
    [handleRegionChange, region],
  );
  const showHomeHistory = useCallback(() => showHistory(home), [showHistory, home]);

  const fetchingAny = prices.some((entry) => entry.token.isFetching);
  const refreshAll = (): void => {
    prices.forEach((entry) => void entry.token.refetch());
  };

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="WoW Token"
        documentTitle="WoW Token"
        icon={<MonetizationOnRoundedIcon />}
        description="The WoW Token's live gold price in all four of Blizzard's API regions, the price history this browser has recorded (Blizzard publishes none), and calculators for gold, tokens and game time."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            <Chip size="small" label={`${prices.length} regions compared`} />
            <Chip
              size="small"
              label={`${pluralize(storedCount, "price", "prices")} stored in this browser`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Checks every ${TOKEN_REFRESH_MINUTES} min`}
            />
          </>
        }
        actions={
          // Stays enabled (and keeps its label) while fetching, so a focused
          // button never goes inert under the keyboard.
          <Button
            variant="outlined"
            size="small"
            onClick={refreshAll}
            startIcon={
              fetchingAny ? (
                <CircularProgress size={16} color="inherit" aria-hidden="true" />
              ) : (
                <AutorenewRoundedIcon />
              )
            }
          >
            Refresh prices
          </Button>
        }
      />

      <TokenHero
        price={home}
        history={histories[home.region]}
        now={now}
        cadenceMs={homeCadence ?? DEFAULT_PUBLISH_MS}
        cadenceObserved={homeCadence !== null}
        itemName={itemName}
        iconUrl={iconQuery.data}
        iconLoading={iconQuery.isPending}
        gameTimeDays={gameTimeDays}
        onShowHistory={showHomeHistory}
      />

      <RegionComparison
        prices={prices}
        histories={histories}
        now={now}
        selectedRegion={selected.region}
        onShowHistory={showHistory}
      />

      <PriceHistorySection
        price={selected}
        history={histories[selected.region]}
        range={range}
        now={now}
        cadenceMs={selectedCadence ?? DEFAULT_PUBLISH_MS}
        regionOptions={regionOptions}
        onRegionChange={handleRegionChange}
        onRangeChange={handleRangeChange}
        headingRef={historyHeadingRef}
      />

      <TokenCalculators
        price={selected}
        regionOptions={regionOptions}
        onRegionChange={handleRegionChange}
        gameTimeDays={gameTimeDays}
        itemText={itemText}
      />

      <TokenItemsSection gameTimeDays={gameTimeDays} />
    </Stack>
  );
};

export default WowTokenPage;
