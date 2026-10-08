import { Box, Chip, Link, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import MediaTile from "@/components/common/MediaTile";
import {
  itemIconQuery,
  spellIconQuery,
} from "@/features/quests/hooks/questQueries";
import type {
  NamedRef,
  QuestRewardItem,
  QuestRewards as QuestRewardsData,
} from "@/features/quests/types";
import { wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

/** A Wowhead page for the entity (Blizzard's item and spell ids are Wowhead's). */
const WowheadName = ({
  kind,
  entity,
}: {
  kind: "item" | "spell";
  entity: NamedRef;
}): JSX.Element => {
  const href = wowheadUrl(kind, entity.id);
  return href ? (
    <Link href={href} target="_blank" rel="noreferrer" variant="body2">
      {entity.name}
      <Box component="span" sx={visuallyHidden}>
        {" (Wowhead, opens in a new tab)"}
      </Box>
    </Link>
  ) : (
    <Typography variant="body2" component="span">
      {entity.name}
    </Typography>
  );
};

const RewardLine = ({
  icon,
  name,
  detail,
}: {
  icon: ReactNode;
  name: ReactNode;
  detail?: string;
}): JSX.Element => (
  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
    {icon}
    <Box sx={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
      {name}
      {detail ? (
        <Typography
          variant="caption"
          color="text.secondary"
          component="span"
          sx={{ display: "block" }}
        >
          {detail}
        </Typography>
      ) : null}
    </Box>
  </Stack>
);

/**
 * An item with its icon, linked to Wowhead. Icons load when the dialog shows
 * them (a quest names a handful of items at most) and share the Items
 * explorer's cache.
 */
const ItemLine = ({ reward }: { reward: QuestRewardItem }): JSX.Element => {
  const iconQuery = useQuery(itemIconQuery(reward.item.id));
  return (
    <RewardLine
      icon={
        <MediaTile
          size={40}
          src={iconQuery.data ?? null}
          alt=""
          fallbackLabel={reward.item.name}
          loading={iconQuery.isPending}
        />
      }
      name={<WowheadName kind="item" entity={reward.item} />}
      detail={reward.specs.length > 0 ? `For ${reward.specs.join(", ")}` : undefined}
    />
  );
};

const SpellLine = ({ spell }: { spell: NamedRef }): JSX.Element => {
  const iconQuery = useQuery(spellIconQuery(spell.id));
  return (
    <RewardLine
      icon={
        <MediaTile
          size={40}
          src={iconQuery.data ?? null}
          alt=""
          fallbackLabel={spell.name}
          loading={iconQuery.isPending}
        />
      }
      name={<WowheadName kind="spell" entity={spell} />}
      detail="Learned or cast on completion"
    />
  );
};

const SubHeading = ({ children }: { children: string }): JSX.Element => (
  <Typography
    variant="subtitle2"
    component="h4"
    color="text.secondary"
    sx={{ m: 0, mb: 1 }}
  >
    {children}
  </Typography>
);

const ItemList = ({ rewards }: { rewards: QuestRewardItem[] }): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}
  >
    {rewards.map((reward, index) => (
      <Box component="li" key={`${reward.item.id}-${index}`} sx={{ minWidth: 0 }}>
        <ItemLine reward={reward} />
      </Box>
    ))}
  </Box>
);

/**
 * A quest's rewards: experience, money, reputation and currencies as chips,
 * then the spell and the items it hands out and the gear it lets you choose
 * from, each with its icon. Reputation factions and currencies have no art
 * in Blizzard's API, so those stay text.
 */
const QuestRewards = ({ rewards }: { rewards: QuestRewardsData }): JSX.Element => {
  const hasSummary =
    rewards.experience !== undefined ||
    rewards.money !== undefined ||
    rewards.reputations.length > 0 ||
    rewards.currencies.length > 0;

  return (
    <Stack spacing={2}>
      {hasSummary ? (
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={0.75}
          role="list"
          sx={{ minWidth: 0 }}
        >
          {rewards.experience !== undefined ? (
            <Chip
              role="listitem"
              size="small"
              label={`${formatNumber(rewards.experience)} experience`}
              sx={{ maxWidth: "100%" }}
            />
          ) : null}
          {rewards.money !== undefined ? (
            <Chip
              role="listitem"
              size="small"
              variant="outlined"
              label={<GoldAmount copper={rewards.money} size="small" />}
              sx={{ maxWidth: "100%" }}
            />
          ) : null}
          {rewards.reputations.map((reputation) => (
            <Chip
              key={`reputation-${reputation.ref.id}`}
              role="listitem"
              size="small"
              variant="outlined"
              label={`${reputation.value > 0 ? "+" : ""}${formatNumber(reputation.value)} ${reputation.ref.name}`}
              sx={{ maxWidth: "100%" }}
            />
          ))}
          {rewards.currencies.map((currency) => (
            <Chip
              key={`currency-${currency.ref.id}`}
              role="listitem"
              size="small"
              variant="outlined"
              label={`${formatNumber(currency.value)} ${currency.ref.name}`}
              sx={{ maxWidth: "100%" }}
            />
          ))}
        </Stack>
      ) : null}

      {rewards.spell ? (
        <Box component="section">
          <SubHeading>Spell</SubHeading>
          <SpellLine spell={rewards.spell} />
        </Box>
      ) : null}

      {rewards.items.length > 0 ? (
        <Box component="section">
          <SubHeading>{rewards.items.length === 1 ? "You receive" : "You receive all of"}</SubHeading>
          <ItemList rewards={rewards.items} />
        </Box>
      ) : null}

      {rewards.choices.length > 0 ? (
        <Box component="section">
          <SubHeading>{rewards.choices.length === 1 ? "You may choose" : `Choose one of ${rewards.choices.length}`}</SubHeading>
          <ItemList rewards={rewards.choices} />
        </Box>
      ) : null}
    </Stack>
  );
};

export default QuestRewards;
