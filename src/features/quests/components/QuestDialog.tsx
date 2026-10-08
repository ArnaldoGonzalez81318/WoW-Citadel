import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Avatar, Box, Button, Chip, Link, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { MouseEvent, ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import { EmptyState } from "@/components/common/StateBlocks";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import QuestRewards from "@/features/quests/components/QuestRewards";
import {
  classIconQuery,
  questQuery,
} from "@/features/quests/hooks/questQueries";
import {
  REPEAT_LABELS,
  formatLevelRange,
  hasRewards,
  standingName,
} from "@/features/quests/services/questService";
import type {
  NamedRef,
  Quest,
  QuestBrowseMode,
  QuestReputationRequirement,
} from "@/features/quests/types";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type QuestDialogProps = {
  /** Whether the dialog is showing; `questId` stays set through the close transition. */
  open: boolean;
  /** The quest to show (the last one opened). */
  questId: number | null;
  /** Its title from the list, shown until the record loads. */
  fallbackName?: string;
  onClose: () => void;
  /** List another zone, category or type (the quest's own, from its facts). */
  onBrowse: (mode: QuestBrowseMode, groupId: number) => void;
};

/** The raw quest record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (questId: number): string =>
  `/api-explorer/quest?${new URLSearchParams({
    endpoint: "quest",
    questId: String(questId),
  }).toString()}`;

/** This page's address for a group; zone is the default mode, so it stays implicit. */
const browseSearch = (mode: QuestBrowseMode, groupId: number): string => {
  const params = new URLSearchParams();
  if (mode !== "zone") {
    params.set("by", mode);
  }
  params.set("group", String(groupId));
  return `?${params.toString()}`;
};

/**
 * The quest's zone, category or type as a link to its list. A plain click
 * stays in the app (closing the dialog and focusing the new list); a
 * modified click opens the list in a new tab like any link.
 */
const BrowseLink = ({
  mode,
  group,
  onBrowse,
}: {
  mode: QuestBrowseMode;
  group: NamedRef;
  onBrowse: QuestDialogProps["onBrowse"];
}): JSX.Element => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onBrowse(mode, group.id);
  };
  return (
    <Link
      component={RouterLink}
      to={{ search: browseSearch(mode, group.id) }}
      onClick={handleClick}
      variant="body2"
    >
      {group.name}
      <Box component="span" sx={visuallyHidden}>
        {": list its quests"}
      </Box>
    </Link>
  );
};

/** A class chip with its icon (the letter until it loads, or if there is none). */
const ClassChip = ({ playableClass }: { playableClass: NamedRef }): JSX.Element => {
  const iconQuery = useQuery(classIconQuery(playableClass.id));
  return (
    <Chip
      role="listitem"
      size="small"
      variant="outlined"
      avatar={
        <Avatar alt="" src={iconQuery.data ?? undefined}>
          {playableClass.name.charAt(0)}
        </Avatar>
      }
      label={playableClass.name}
    />
  );
};

/**
 * "At least 9,000 (Honored)", "below 42,000 (not yet Exalted)". The game's
 * minimum is inclusive but its maximum is not: a cap of 42,000 closes the
 * quest at Exalted. A cap partway through a standing still allows that
 * standing ("below 7,900 (Friendly at most)").
 */
const reputationLabel = (requirement: QuestReputationRequirement): string => {
  const bounds: string[] = [];
  if (requirement.min !== undefined) {
    bounds.push(`at least ${formatNumber(requirement.min)} (${standingName(requirement.min)})`);
  }
  if (requirement.max !== undefined) {
    const capped = standingName(requirement.max);
    const reach =
      standingName(requirement.max - 1) === capped ? `${capped} at most` : `not yet ${capped}`;
    bounds.push(`below ${formatNumber(requirement.max)} (${reach})`);
  }
  return bounds.length > 0
    ? `${requirement.faction.name}: ${bounds.join(", ")}`
    : requirement.faction.name;
};

/*
 * Blizzard leaves the game's placeholders in quest text ("Greetings,
 * {name}."). They read as the reader's own: "Greetings, your name.", set in
 * italics so it is clear the game fills them in.
 */
const PLACEHOLDER = /(\{[a-z]+\})/iu;
const PLACEHOLDER_WORDS: Readonly<Record<string, string>> = {
  name: "your name",
  class: "your class",
  race: "your race",
};

const renderParagraph = (text: string): ReactNode[] =>
  text.split(PLACEHOLDER).map((part, index) => {
    const word = /^\{([a-z]+)\}$/iu.exec(part)?.[1]?.toLowerCase();
    if (!word) {
      return part;
    }
    return (
      <Box
        component="em"
        key={index}
        sx={{ color: "secondary.main", fontStyle: "italic" }}
      >
        {PLACEHOLDER_WORDS[word] ?? word}
      </Box>
    );
  });

const buildRows = (
  quest: Quest,
  onBrowse: QuestDialogProps["onBrowse"],
): DetailDialogRow[] => {
  const rows: DetailDialogRow[] = [];
  const { requirements } = quest;
  if (quest.area) {
    rows.push({ label: "Zone", value: <BrowseLink mode="zone" group={quest.area} onBrowse={onBrowse} /> });
  }
  if (quest.category) {
    rows.push({
      label: "Category",
      value: <BrowseLink mode="category" group={quest.category} onBrowse={onBrowse} />,
    });
  }
  if (quest.type) {
    rows.push({ label: "Type", value: <BrowseLink mode="type" group={quest.type} onBrowse={onBrowse} /> });
  }
  const level = formatLevelRange(requirements.minLevel, requirements.maxLevel);
  if (level) {
    rows.push({ label: "Level", value: level });
  }
  if (requirements.faction) {
    rows.push({ label: "Faction", value: <FactionTag faction={requirements.faction} /> });
  }
  if (requirements.classes.length > 0) {
    rows.push({
      label: requirements.classes.length === 1 ? "Class" : "Classes",
      value: (
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} role="list" component="span">
          {requirements.classes.map((playableClass) => (
            <ClassChip key={playableClass.id} playableClass={playableClass} />
          ))}
        </Stack>
      ),
    });
  }
  if (requirements.races.length > 0) {
    rows.push({
      label: requirements.races.length === 1 ? "Race" : "Races",
      value: requirements.races.map((race) => race.name).join(", "),
    });
  }
  requirements.reputations.forEach((requirement) => {
    rows.push({ label: "Reputation", value: reputationLabel(requirement) });
  });
  if (quest.repeats.length > 0) {
    rows.push({
      label: "Repeats",
      value: quest.repeats.map((repeat) => REPEAT_LABELS[repeat]).join(" · "),
    });
  }
  rows.push({ label: "Quest ID", value: String(quest.id) });
  return rows;
};

const buildSections = (quest: Quest): DetailDialogSection[] => {
  const sections: DetailDialogSection[] = [];
  if (quest.paragraphs.length > 0) {
    sections.push({
      heading: "Description",
      content: (
        <Stack spacing={1}>
          {quest.paragraphs.map((paragraph, index) => (
            <Typography
              key={index}
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{ m: 0 }}
            >
              {renderParagraph(paragraph)}
            </Typography>
          ))}
        </Stack>
      ),
    });
  }
  sections.push({
    heading: "Rewards",
    content: hasRewards(quest.rewards) ? (
      <QuestRewards rewards={quest.rewards} />
    ) : (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        Blizzard lists no rewards for this quest.
      </Typography>
    ),
  });
  return sections;
};

/**
 * A quest in full: where it is filed (each a link to that list), its level
 * range, faction, class, race and reputation requirements, its text, and
 * every reward with icons. Reads the same cache entry as the card that
 * opened it, so a card that already loaded opens instantly.
 */
const QuestDialog = ({
  open,
  questId,
  fallbackName,
  onClose,
  onBrowse,
}: QuestDialogProps): JSX.Element => {
  const enabled = questId !== null;
  const query = useQuery({ ...questQuery(questId ?? 0), enabled });
  const quest = enabled ? (query.data ?? undefined) : undefined;
  const notFound = enabled && query.data === null;
  const title =
    quest?.title ?? fallbackName ?? (questId !== null ? `Quest #${questId}` : "");
  const subtitle = quest
    ? [quest.area?.name ?? quest.category?.name, quest.type?.name]
        .filter(Boolean)
        .join(" · ")
    : undefined;
  const wowhead = questId !== null ? wowheadUrl("quest", questId) : undefined;

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={subtitle || undefined}
      rows={quest ? buildRows(quest, onBrowse) : undefined}
      sections={quest ? buildSections(quest) : undefined}
      loading={enabled && query.isPending}
      error={query.isError && query.data === undefined ? query.error : undefined}
      onRetry={() => void query.refetch()}
      errorContext="quest details"
      actions={
        questId !== null ? (
          <>
            <Button component={RouterLink} to={workbenchUrl(questId)} size="small">
              Open in API workbench
            </Button>
            {wowhead && !notFound ? (
              <Button
                href={wowhead}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {WOWHEAD_LABEL}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${title}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {notFound ? (
        <EmptyState
          compact
          title="Quest not found"
          description={`Blizzard has no quest #${questId ?? ""} in its game data. Quest ids are the number in a Wowhead quest address (wowhead.com/quest=11).`}
        />
      ) : null}
    </DetailDialog>
  );
};

export default QuestDialog;
