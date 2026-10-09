import { Box, Paper, Skeleton, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SegmentedControl } from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import GoldAmount from "@/components/common/GoldAmount";
import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import { LiveStatus } from "@/components/common/StateBlocks";
import { Fact, FactList } from "@/features/wowToken/components/Facts";
import { pluralize } from "@/features/wowToken/services/tokenStats";
import type { Region, RegionPrice } from "@/features/wowToken/types";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { COPPER_PER_GOLD, formatNumber } from "@/lib/format";

export type TokenCalculatorsProps = {
  /** The region whose price the calculators use. */
  price: RegionPrice;
  regionOptions: ReadonlyArray<SegmentedOption<Region>>;
  onRegionChange: (region: Region) => void;
  /** Days of game time one token adds. */
  gameTimeDays: number;
  /** Blizzard's item text the day count was read from; undefined when it did not load. */
  itemText: string | undefined;
};

/** The gold cap is 9,999,999; twelve digits leaves room without risking precision. */
const MAX_GOLD_DIGITS = 12;
const MAX_TOKENS = 999;
const DAYS_PER_YEAR = 365;
const DEFAULT_GOLD = "1000000";
const DEFAULT_TOKENS = "6";

/** A typed value is read out once it has been still this long. */
const ANNOUNCE_DELAY_MS = 700;

type Parsed = { value: number | null; error: string | null };

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * The app locale's digit-group separator ("," in en-US, "." in de-DE and
 * es-ES). Read from a million: Spanish and Italian leave four-digit numbers
 * ungrouped, so 1,000 would show none.
 */
const groupSeparator = (): string =>
  formatNumber(1_000_000).replace(/\d/gu, "").charAt(0) || ",";

/**
 * A whole number typed plain or grouped in threes by the locale's separator
 * (or by spaces): "1250000", "1,250,000" in en-US, "1.250.000" in es-ES.
 * Anything else is an error rather than a guess: "1,5" must not quietly
 * become 15 where "," is the decimal mark, nor "1.5" where "." is.
 */
const parseWhole = (raw: string, maxDigits: number): Parsed => {
  const value = raw.trim();
  if (value === "") {
    return { value: null, error: null };
  }
  const separator = `(?:${escapeRegExp(groupSeparator())}|\\s)`;
  const grouped = new RegExp(`^\\d{1,3}(?:${separator}\\d{3})+$`, "u");
  if (!/^\d+$/u.test(value) && !grouped.test(value)) {
    return { value: null, error: `Whole numbers only, like ${formatNumber(1250000)}` };
  }
  const digits = value.replace(/\D/gu, "");
  if (digits.replace(/^0+/u, "").length > maxDigits) {
    return { value: null, error: "That is more than this calculator handles" };
  }
  return { value: Number(digits), error: null };
};

/** Why a token count is out of range, or null. */
const tokenRangeError = (count: number): string | null =>
  count < 1
    ? "At least 1 token"
    : count > MAX_TOKENS
      ? `Up to ${formatNumber(MAX_TOKENS)} tokens`
      : null;

const formatDays = (days: number): string =>
  formatNumber(days, { style: "unit", unit: "day", unitDisplay: "long" });

type CalculatorCardProps = {
  title: string;
  titleId: string;
  children: ReactNode;
};

const CalculatorCard = ({ title, titleId, children }: CalculatorCardProps): JSX.Element => (
  <Paper
    component="section"
    variant="outlined"
    aria-labelledby={titleId}
    sx={(theme) => ({
      p: 2,
      height: "100%",
      minWidth: 0,
      borderRadius: `${theme.wc.radius.md}px`,
      backgroundColor: theme.palette.surface.sunken,
    })}
  >
    <Typography id={titleId} variant="subtitle1" component="h3" sx={{ m: 0, mb: 1.5, fontWeight: 700 }}>
      {title}
    </Typography>
    <Stack spacing={2}>{children}</Stack>
  </Paper>
);

/**
 * The headline result. Not a live region: a price poll, or a region picked
 * in another section, would read bare totals aloud. What the user types is
 * announced separately, with its context (`useTypedAnnouncement`).
 */
const Headline = ({ children }: { children: ReactNode }): JSX.Element => (
  <Typography
    component="p"
    sx={{ m: 0, color: "text.primary", fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.25, minHeight: 30 }}
  >
    {children}
  </Typography>
);

/**
 * A sentence for a polite live region, rebuilt only when `draft` settles
 * after an edit, from the price of that moment. The starting value says
 * nothing, and later price changes leave the sentence alone.
 */
const useTypedAnnouncement = (
  draft: string,
  describe: (draft: string) => string | null,
): string => {
  const settled = useDebouncedValue(draft, ANNOUNCE_DELAY_MS);
  const lastRef = useRef(settled);
  const describeRef = useRef(describe);
  const [spoken, setSpoken] = useState("");

  useEffect(() => {
    describeRef.current = describe;
  });

  useEffect(() => {
    if (settled === lastRef.current) {
      return;
    }
    lastRef.current = settled;
    setSpoken(describeRef.current(settled) ?? "");
  }, [settled]);

  return spoken;
};

/**
 * Gold and tokens at the selected region's current price, and what game
 * time costs in gold. No real money anywhere: Blizzard's API has no
 * real-money prices, and they vary by region, currency and tax.
 */
const TokenCalculators = ({
  price,
  regionOptions,
  onRegionChange,
  gameTimeDays,
  itemText,
}: TokenCalculatorsProps): JSX.Element => {
  const baseId = useId();
  const [goldDraft, setGoldDraft] = useState(DEFAULT_GOLD);
  const [tokenDraft, setTokenDraft] = useState(DEFAULT_TOKENS);
  const { tag, name, token } = price;
  const copper = token.data?.price;

  const gold = parseWhole(goldDraft, MAX_GOLD_DIGITS);
  const tokens = parseWhole(tokenDraft, MAX_GOLD_DIGITS);
  const tokenError = tokens.error ?? (tokens.value === null ? null : tokenRangeError(tokens.value));
  const tokenCount = tokenError ? null : tokens.value;

  // Without a price there is nothing to calculate; say why once, not per card.
  const unavailable = copper === undefined && !token.isPending;
  const waiting = copper === undefined && token.isPending;

  const result = (render: (price: number) => ReactNode): ReactNode => {
    if (copper !== undefined) {
      return render(copper);
    }
    return waiting ? (
      <Skeleton width="60%" sx={{ fontSize: "1.5rem" }} />
    ) : (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        No price to work from.
      </Typography>
    );
  };

  const goldToTokens = (goldValue: number, unit: number) => {
    const total = goldValue * COPPER_PER_GOLD;
    const count = Math.floor(total / unit);
    const leftover = total - count * unit;
    return { count, leftover, toNext: unit - leftover };
  };

  const yearTokens = Math.ceil(DAYS_PER_YEAR / gameTimeDays);

  const goldSpoken = useTypedAnnouncement(goldDraft, (draft) => {
    const parsed = parseWhole(draft, MAX_GOLD_DIGITS);
    if (parsed.error || parsed.value === null || copper === undefined) {
      return parsed.error;
    }
    const { count } = goldToTokens(parsed.value, copper);
    return `${formatNumber(parsed.value)} gold buys ${pluralize(count, "token", "tokens")} at the ${tag} price.`;
  });
  const tokenSpoken = useTypedAnnouncement(tokenDraft, (draft) => {
    const parsed = parseWhole(draft, MAX_GOLD_DIGITS);
    const problem = parsed.error ?? (parsed.value === null ? null : tokenRangeError(parsed.value));
    if (problem || parsed.value === null || copper === undefined) {
      return problem;
    }
    // Token prices are whole gold.
    const total = Math.floor((parsed.value * copper) / COPPER_PER_GOLD);
    return `${pluralize(parsed.value, "token", "tokens")} cost ${formatNumber(total)} gold at the ${tag} price.`;
  });

  return (
    <SectionCard
      title="Calculators"
      description={
        <>
          {`At ${name ?? tag}'s current price. `}
          {itemText
            ? `Each token adds ${formatDays(gameTimeDays)} of game time; Blizzard's item text: “${itemText}”`
            : `Each token adds ${formatDays(gameTimeDays)} of game time (game knowledge; Blizzard's item text has not loaded).`}
        </>
      }
    >
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <SegmentedControl<Region>
          label="Calculator region"
          options={regionOptions}
          value={price.region}
          onChange={onRegionChange}
          size="small"
          sx={{ alignSelf: "flex-start" }}
        />

        {unavailable ? (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
            {`The ${tag} price did not load, so there is nothing to calculate with yet; retry from its card above.`}
          </Typography>
        ) : null}

        <Box sx={{ display: "grid", gap: 2, minWidth: 0, ...gridTemplateColumnsSx({ xs: 1, md: 3 }) }}>
          <CalculatorCard title="Gold to tokens" titleId={`${baseId}-gold`}>
            <TextField
              label="Gold"
              value={goldDraft}
              onChange={(event) => setGoldDraft(event.target.value)}
              error={gold.error !== null}
              helperText={gold.error ?? "Whole gold; separators are fine"}
              size="small"
              autoComplete="off"
              slotProps={{ htmlInput: { inputMode: "numeric", spellCheck: false } }}
            />
            <LiveStatus visuallyHidden>{goldSpoken}</LiveStatus>
            {result((unit) => {
              const outcome = gold.value === null ? null : goldToTokens(gold.value, unit);
              if (!outcome) {
                return <Headline>{" "}</Headline>;
              }
              return (
                <>
                  <Headline>{pluralize(outcome.count, "token", "tokens")}</Headline>
                  <FactList columns={{ xs: 2, md: 1, lg: 2 }}>
                    <Fact label="Game time" value={formatDays(outcome.count * gameTimeDays)} />
                    <Fact label="Left over" value={<GoldAmount copper={outcome.leftover} size="large" />} />
                    <Fact
                      label={`For token ${formatNumber(outcome.count + 1)}`}
                      value={<GoldAmount copper={outcome.toNext} size="large" />}
                      note="More gold needed"
                    />
                  </FactList>
                </>
              );
            })}
          </CalculatorCard>

          <CalculatorCard title="Tokens to gold" titleId={`${baseId}-tokens`}>
            <TextField
              label="Tokens"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
              error={tokenError !== null}
              helperText={tokenError ?? `1 to ${formatNumber(MAX_TOKENS)}`}
              size="small"
              autoComplete="off"
              slotProps={{ htmlInput: { inputMode: "numeric", spellCheck: false } }}
            />
            <LiveStatus visuallyHidden>{tokenSpoken}</LiveStatus>
            {result((unit) =>
              tokenCount === null ? (
                <Headline>{" "}</Headline>
              ) : (
                <>
                  <Headline>
                    <GoldAmount
                      copper={tokenCount * unit}
                      size="large"
                      sx={{ fontSize: "inherit", fontWeight: "inherit", whiteSpace: "normal" }}
                    />
                  </Headline>
                  <FactList columns={{ xs: 2, md: 1, lg: 2 }}>
                    <Fact label="Game time" value={formatDays(tokenCount * gameTimeDays)} />
                    <Fact label="Per token" value={<GoldAmount copper={unit} size="large" />} />
                  </FactList>
                </>
              ),
            )}
          </CalculatorCard>

          <CalculatorCard title="Game time in gold" titleId={`${baseId}-time`}>
            {result((unit) => (
                <FactList columns={{ xs: 1, sm: 3, md: 1 }}>
                  <Fact
                    label="Per day"
                    value={<GoldAmount copper={Math.round(unit / gameTimeDays)} size="large" />}
                  />
                  <Fact
                    label={`Per ${formatDays(gameTimeDays)}`}
                    value={<GoldAmount copper={unit} size="large" />}
                    note="One token"
                  />
                  <Fact
                    label="Per year"
                    value={<GoldAmount copper={yearTokens * unit} size="large" />}
                    note={`${pluralize(yearTokens, "token", "tokens")}, ${formatDays(yearTokens * gameTimeDays)}`}
                  />
                </FactList>
              ))}
          </CalculatorCard>
        </Box>
      </Stack>
    </SectionCard>
  );
};

export default TokenCalculators;
