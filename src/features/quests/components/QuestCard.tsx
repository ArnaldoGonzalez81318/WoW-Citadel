import { Box, Card, CardActionArea, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { ReactNode } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import MediaTile from "@/components/common/MediaTile";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import {
  itemIconQuery,
  questQuery,
  spellIconQuery,
} from "@/features/quests/hooks/questQueries";
import {
  REPEAT_LABELS,
  formatLevelRange,
} from "@/features/quests/services/questService";
import type { Quest, QuestRef } from "@/features/quests/types";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { mixins } from "@/theme";

/** Every card is this tall (title and two caption lines), so the loading grid matches it. */
export const QUEST_CARD_HEIGHT = 84;

export type QuestCardProps = {
  quest: QuestRef;
  /** Another quest in this list has the same title: show the id to tell them apart. */
  showId: boolean;
  onOpen: (quest: QuestRef) => void;
};

/**
 * The art a quest row can show: the item it hands out (or the first gear
 * choice), else the spell it teaches. Quests have no icon of their own, so a
 * quest without either keeps its initial.
 */
const RewardIcon = ({
  quest,
  name,
  loading,
}: {
  quest: Quest | null | undefined;
  name: string;
  loading: boolean;
}): JSX.Element => {
  const item = quest?.rewards.items[0]?.item ?? quest?.rewards.choices[0]?.item;
  const spell = item ? undefined : quest?.rewards.spell;
  const itemQuery = useQuery({
    ...itemIconQuery(item?.id ?? 0),
    enabled: item !== undefined,
  });
  const spellQuery = useQuery({
    ...spellIconQuery(spell?.id ?? 0),
    enabled: spell !== undefined,
  });
  const src = item ? itemQuery.data : spell ? spellQuery.data : null;
  const iconPending =
    (item !== undefined && itemQuery.isPending) ||
    (spell !== undefined && spellQuery.isPending);

  return (
    <MediaTile
      size={40}
      src={src ?? null}
      alt=""
      fallbackLabel={name}
      loading={loading || iconPending}
    />
  );
};

const joinNodes = (nodes: ReactNode[]): ReactNode[] =>
  nodes.flatMap((node, index) => (index === 0 ? [node] : [" · ", node]));

/** "Levels 1–30 · Alliance · Daily". */
const factsOf = (quest: Quest): ReactNode[] => {
  const facts: ReactNode[] = [];
  const level = formatLevelRange(quest.requirements.minLevel, quest.requirements.maxLevel);
  if (level) {
    facts.push(level);
  }
  if (quest.requirements.faction) {
    facts.push(<FactionTag key="faction" faction={quest.requirements.faction} />);
  }
  if (quest.requirements.classes.length === 1) {
    facts.push(quest.requirements.classes[0].name);
  } else if (quest.requirements.classes.length > 1) {
    facts.push(`${quest.requirements.classes.length} classes`);
  }
  quest.repeats.forEach((repeat) => facts.push(REPEAT_LABELS[repeat]));
  return facts;
};

/** "4,100 XP · 10g 50s · Choice of 4". */
const rewardsOf = (quest: Quest): ReactNode[] => {
  const { rewards } = quest;
  const parts: ReactNode[] = [];
  if (rewards.experience !== undefined) {
    parts.push(`${formatNumber(rewards.experience)} XP`);
  }
  if (rewards.money !== undefined) {
    parts.push(<GoldAmount key="money" copper={rewards.money} size="small" />);
  }
  if (rewards.items.length > 0) {
    parts.push(
      rewards.items.length === 1 ? rewards.items[0].item.name : `${rewards.items.length} items`,
    );
  }
  if (rewards.choices.length > 0) {
    parts.push(`Choice of ${rewards.choices.length}`);
  }
  if (rewards.spell && rewards.items.length === 0) {
    parts.push(rewards.spell.name);
  }
  if (rewards.reputations.length > 0) {
    parts.push("Reputation");
  }
  if (parts.length === 0 && rewards.currencies.length > 0) {
    parts.push(rewards.currencies.map((currency) => currency.ref.name).join(", "));
  }
  return parts;
};

const captionSx = {
  ...mixins.truncate,
  display: "block",
  m: 0,
  lineHeight: 1.6,
} as const;

/**
 * One quest: its reward icon and title, then its level range, faction and
 * repeat flags, and what it pays. The record behind those (and the icon)
 * loads as the card nears the viewport, a few at a time (see questQuery),
 * so a page of the list costs what the visitor scrolls past. The whole card
 * opens the quest dialog, which reads the same cache entry.
 */
const QuestCard = ({ quest, showId, onOpen }: QuestCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...questQuery(quest.id), enabled: near });
  const detail = query.data;
  const loading = query.isPending;
  // The button's aria-label replaces its content, so the visible lines are
  // its description: what tells two "The Platinum Discs" apart by ear.
  const baseId = useId();
  const factsId = `${baseId}-facts`;
  const rewardsId = `${baseId}-rewards`;

  const facts = detail ? factsOf(detail) : [];
  const rewards = detail ? rewardsOf(detail) : [];

  let factsLine: ReactNode;
  let rewardsLine: ReactNode;
  if (loading) {
    factsLine = <Skeleton variant="text" width="55%" />;
    rewardsLine = <Skeleton variant="text" width="40%" />;
  } else if (query.isError && detail === undefined) {
    factsLine = "Details unavailable";
    rewardsLine = " ";
  } else if (detail === null) {
    factsLine = "Not in Blizzard's quest data";
    rewardsLine = " ";
  } else {
    factsLine = facts.length > 0 ? joinNodes(facts) : "No requirements listed";
    rewardsLine = rewards.length > 0 ? joinNodes(rewards) : "No rewards listed";
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onOpen(quest)}
        aria-label={`View ${quest.name}${showId ? ` (quest ${quest.id})` : ""} details`}
        aria-describedby={loading ? undefined : `${factsId} ${rewardsId}`}
        sx={{
          ...cardActionAreaSx,
          alignItems: "center",
          gap: 1.5,
          minHeight: QUEST_CARD_HEIGHT,
          px: 1.5,
          py: 1,
        }}
      >
        <RewardIcon quest={detail} name={quest.name} loading={loading} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            component="span"
            sx={{ ...mixins.truncate, display: "block", fontWeight: 600 }}
          >
            {quest.name}
            {showId ? (
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 400 }}
              >
                {` #${quest.id}`}
              </Typography>
            ) : null}
          </Typography>
          <Typography
            id={factsId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={captionSx}
          >
            {factsLine}
          </Typography>
          <Typography
            id={rewardsId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={captionSx}
          >
            {rewardsLine}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default QuestCard;
