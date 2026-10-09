import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Card, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import SectionCard from "@/components/common/SectionCard";
import { ErrorState } from "@/components/common/StateBlocks";
import { WOW_TOKEN_ITEM_ID } from "@/features/regions/hooks/regionQueries";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import { tokenItemIconQuery, tokenItemQuery } from "@/features/wowToken/hooks/wowTokenQueries";
import { LISTED_TOKEN_ITEM_ID } from "@/features/wowToken/services/tokenItemService";
import useNearViewport from "@/hooks/useNearViewport";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type TokenItemsSectionProps = {
  /** Days of game time per token, for the game-knowledge notes. */
  gameTimeDays: number;
};

/**
 * What each item does, in the terms of its own text only: 122270 "can be
 * sold for gold on the auction house", 122284 "adds 30 days of game time".
 * Which one a buyer ends up holding is game knowledge, in the notes below.
 */
const ITEMS = [
  { id: LISTED_TOKEN_ITEM_ID, role: "Sold for gold on the auction house" },
  { id: WOW_TOKEN_ITEM_ID, role: "Adds game time when used" },
] as const;

type TokenItemCardProps = {
  itemId: number;
  role: string;
  enabled: boolean;
};

const TokenItemCard = ({ itemId, role, enabled }: TokenItemCardProps): JSX.Element => {
  const titleId = useId();
  const itemQuery = useQuery({ ...tokenItemQuery(itemId), enabled });
  const iconQuery = useQuery({ ...tokenItemIconQuery(itemId), enabled });
  const error = useStickyError(itemQuery);
  const item = itemQuery.data;
  const name = item?.name || "WoW Token";
  const wowhead = wowheadUrl("item", itemId);

  const renderText = (): JSX.Element => {
    if (item) {
      return item.description ? (
        <Typography
          component="blockquote"
          variant="body2"
          sx={(theme) => ({
            m: 0,
            pl: 1.5,
            borderLeft: `2px solid ${theme.palette.border.gold}`,
            color: "text.primary",
            maxWidth: "60ch",
          })}
        >
          {item.description}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard gives this item no description.
        </Typography>
      );
    }
    if (error) {
      return (
        <ErrorState
          compact
          error={error}
          context={`item ${formatNumber(itemId)}`}
          onRetry={() => void itemQuery.refetch()}
        />
      );
    }
    if (item === null) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {`Blizzard has no record for item ${formatNumber(itemId)}.`}
        </Typography>
      );
    }
    return (
      <Box role="status" aria-label={`Loading item ${formatNumber(itemId)}`} aria-busy="true">
        <Skeleton width="95%" sx={{ fontSize: "0.875rem" }} />
        <Skeleton width="70%" sx={{ fontSize: "0.875rem" }} />
      </Box>
    );
  };

  return (
    <Card
      component="article"
      variant="outlined"
      aria-labelledby={titleId}
      sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      <Stack spacing={1.75} sx={{ p: 2, flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <MediaTile
            size={56}
            src={iconQuery.data}
            alt=""
            fallbackLabel={name}
            loading={iconQuery.isPending}
            radius="md"
            sx={(theme) => ({ borderColor: theme.palette.border.gold })}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" component="p" color="secondary.main" sx={{ m: 0, lineHeight: 1.5 }}>
              {role}
            </Typography>
            <Typography id={titleId} variant="subtitle1" component="h3" sx={{ m: 0, fontWeight: 700 }}>
              {itemQuery.isPending && enabled ? <Skeleton width={120} /> : name}
              <Box component="span" sx={visuallyHidden}>
                {`, item ${formatNumber(itemId)}`}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" aria-hidden="true" sx={{ m: 0 }}>
              {`Item ${formatNumber(itemId)}`}
            </Typography>
          </Box>
        </Stack>

        {renderText()}

        {wowhead ? (
          <Box sx={{ mt: "auto" }}>
            <Button
              href={wowhead}
              target="_blank"
              rel="noreferrer"
              size="small"
              endIcon={<OpenInNewRoundedIcon />}
            >
              {WOWHEAD_LABEL}
              <Box component="span" sx={visuallyHidden}>
                {`: ${name}, item ${formatNumber(itemId)}, opens in a new tab`}
              </Box>
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Card>
  );
};

/**
 * The two items behind the price, in Blizzard's own words, then what the
 * API does not say, labelled as game knowledge. The second item's record
 * and both icons wait until the section nears the screen.
 */
const TokenItemsSection = ({ gameTimeDays }: TokenItemsSectionProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const days = formatNumber(gameTimeDays);

  return (
    <SectionCard
      title="About the token"
      description="Blizzard's API has two items named WoW Token; each card quotes what Blizzard's own text says it does."
    >
      <Stack ref={nearRef} spacing={2.5} sx={{ minWidth: 0 }}>
        <Box
          component="ul"
          role="list"
          aria-label="WoW Token items"
          sx={{ display: "grid", gap: 2, listStyle: "none", m: 0, p: 0, ...gridTemplateColumnsSx({ xs: 1, md: 2 }) }}
        >
          {ITEMS.map((entry) => (
            <Box component="li" key={entry.id} sx={{ minWidth: 0 }}>
              <TokenItemCard itemId={entry.id} role={entry.role} enabled={near} />
            </Box>
          ))}
        </Box>

        {/* A plain panel, not an <aside>: a complementary landmark may not
            nest inside this section's region. The h3 gives it its place. */}
        <Box
          sx={(theme) => ({
            p: 2,
            borderRadius: `${theme.wc.radius.md}px`,
            border: `1px dashed ${theme.palette.border.default}`,
            backgroundColor: theme.palette.surface.inset,
          })}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ m: 0 }}>
              How the trade works
            </Typography>
            {/* Wraps instead of truncating: on a phone the disclosure is wider than the panel. */}
            <Chip
              size="small"
              variant="outlined"
              label="Game knowledge, not from Blizzard's API"
              sx={(theme) => ({
                height: "auto",
                minHeight: 24,
                maxWidth: "100%",
                borderRadius: `${theme.wc.radius.md}px`,
                "& .MuiChip-label": { whiteSpace: "normal", py: 0.25 },
              })}
            />
          </Stack>
          <Box
            component="ul"
            role="list"
            sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.75, color: "text.secondary", typography: "body2" }}
          >
            <li>
              A player buys a token from Blizzard with real money, then sells it on the auction house to
              another player for the gold price shown above.
            </li>
            <li>
              {`The buyer receives the redeemable token (item ${formatNumber(
                WOW_TOKEN_ITEM_ID,
              )} above) and redeems it for ${days} days of game time or, where Blizzard offers it, for Battle.net Balance; Blizzard sets that amount per region and currency.`}
            </li>
            <li>
              Blizzard moves the gold price with supply and demand, and every token in a region trades at
              that one price.
            </li>
            <li>Real-money prices are not in the API, so this page shows none.</li>
          </Box>
        </Box>
      </Stack>
    </SectionCard>
  );
};

export default TokenItemsSection;
