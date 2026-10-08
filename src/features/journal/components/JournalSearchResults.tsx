import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useId, useRef } from "react";
import type { ReactNode } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import { scrollMarginSx } from "@/features/journal/components/journalStyles";
import {
  journalEncounterQuery,
  journalInstanceQuery,
} from "@/features/journal/hooks/journalQueries";
import {
  categoryLabel,
  pluralize,
} from "@/features/journal/services/journalService";
import type { JournalRef } from "@/features/journal/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { mixins } from "@/theme";

export const RESULT_PAGE_SIZE = 25;
/** Instance names are few and distinctive: the closest handful is enough. */
export const INSTANCE_RESULT_LIMIT = 6;
const RESULT_COLS: GridColumns = { xs: 1, md: 2 };
const RESULT_GAP_PX = 12;
/** A 56px render (or 48px-tall art) plus 12px padding above and below. */
const RESULT_ROW_HEIGHT = 80;

export type JournalSearchResultsProps = {
  /** The trimmed query from the URL. */
  query: string;
  encounterIndex: UseQueryResult<JournalRef[]>;
  instanceIndex: UseQueryResult<JournalRef[]>;
  /** Every match, best first (the page cuts its 25 out). */
  encounterMatches: JournalRef[];
  instanceMatches: JournalRef[];
  /** 1-based, already clamped to the encounter pages. */
  page: number;
  onPageChange: (page: number) => void;
  /** `instanceId` when the row already knows it, so the instance shows at once. */
  onSelectEncounter: (encounter: JournalRef, instanceId?: number) => void;
  onSelectInstance: (instance: JournalRef) => void;
  onClear: () => void;
};

/** The row both result kinds share: art on the left, name and where below. */
const ResultCard = ({
  label,
  name,
  art,
  detail,
  detailPending,
  onClick,
  cardRef,
}: {
  label: string;
  name: string;
  art: ReactNode;
  /** "The Voidspire · Raid"; undefined when there is nothing to say. */
  detail: string | undefined;
  detailPending: boolean;
  onClick: () => void;
  cardRef: (node: HTMLDivElement | null) => void;
}): JSX.Element => {
  const detailId = useId();
  return (
    <Card ref={cardRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={onClick}
        aria-label={label}
        aria-describedby={detail ? detailId : undefined}
        sx={{ ...cardActionAreaSx, alignItems: "center", gap: 1.5, minHeight: RESULT_ROW_HEIGHT, px: 1.5, py: 1.5 }}
      >
        {art}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" component="span" sx={{ ...mixins.truncate, display: "block" }}>
            {name}
          </Typography>
          {detailPending ? (
            <Skeleton variant="text" width="55%" sx={{ fontSize: "0.75rem" }} />
          ) : (
            <Typography
              id={detailId}
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ ...mixins.truncate, display: "block" }}
            >
              {detail ?? "Details unavailable"}
            </Typography>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
};

/**
 * An encounter match: the boss's model, its name, and its instance and
 * category, which tell namesakes apart (44 names, Ragnaros and Glubtok
 * among them, appear more than once in the journal). The record and render
 * load as the row nears the viewport; the encounter view reads the same
 * cache entry.
 */
const EncounterResult = ({
  encounter,
  onSelect,
}: {
  encounter: JournalRef;
  onSelect: JournalSearchResultsProps["onSelectEncounter"];
}): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const encounterQuery = useQuery({ ...journalEncounterQuery(encounter.id), enabled: near });
  const record = encounterQuery.data ?? undefined;
  const displayId = record?.creatures[0]?.displayId;
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(displayId ?? 0),
    enabled: near && displayId !== undefined,
  });
  const where = [record?.instance?.name, categoryLabel(record?.category)].filter(Boolean).join(" · ");

  return (
    <ResultCard
      cardRef={nearRef}
      label={`View ${encounter.name}`}
      name={encounter.name}
      detail={where || undefined}
      detailPending={encounterQuery.isPending}
      onClick={() => onSelect(encounter, record?.instance?.id)}
      art={
        <MediaTile
          size={56}
          src={renderQuery.data ?? null}
          alt=""
          fallbackLabel={encounter.name}
          loading={encounterQuery.isPending || (displayId !== undefined && renderQuery.isPending)}
          radius="md"
        />
      }
    />
  );
};

/**
 * A dungeon or raid match: its zone art, name, and category and expansion
 * (Blackrock Depths is both a Classic dungeon and a Classic raid). Shares
 * the instance cards' cache entry.
 */
const InstanceResult = ({
  instance,
  onSelect,
}: {
  instance: JournalRef;
  onSelect: JournalSearchResultsProps["onSelectInstance"];
}): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const instanceQuery = useQuery({ ...journalInstanceQuery(instance.id), enabled: near });
  const record = instanceQuery.data ?? undefined;
  const where = [categoryLabel(record?.category), record?.expansion?.name].filter(Boolean).join(" · ");

  return (
    <ResultCard
      cardRef={nearRef}
      label={`Open ${instance.name}`}
      name={instance.name}
      detail={where || undefined}
      detailPending={instanceQuery.isPending}
      onClick={() => onSelect(instance)}
      art={
        <Box
          sx={(theme) => ({
            width: 96,
            flexShrink: 0,
            aspectRatio: "2 / 1",
            borderRadius: `${theme.wc.radius.sm}px`,
            overflow: "hidden",
          })}
        >
          <MediaTile
            size="fill"
            aspect="2 / 1"
            src={record?.imageUrl ?? null}
            alt=""
            fallbackLabel={instance.name}
            loading={instanceQuery.isPending}
          />
        </Box>
      }
    />
  );
};

const ResultList = ({ labelledBy, children }: { labelledBy: string; children: ReactNode }): JSX.Element => (
  <Box
    component="ul"
    role="list"
    aria-labelledby={labelledBy}
    sx={{
      display: "grid",
      gap: `${RESULT_GAP_PX}px`,
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(RESULT_COLS),
    }}
  >
    {children}
  </Box>
);

const GroupHeading = ({ id, title, count }: { id: string; title: string; count: string }): JSX.Element => (
  <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
    <Typography id={id} variant="subtitle1" component="h3" sx={{ m: 0 }}>
      {title}
    </Typography>
    <Typography variant="caption" color="text.secondary" component="span">
      {count}
    </Typography>
  </Stack>
);

const NoneFound = ({ text }: { text: string }): JSX.Element => (
  <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
    {text}
  </Typography>
);

/**
 * What the search matched: the closest dungeons and raids, then every
 * encounter, 25 to a page. The match counts are announced by the search
 * bar's summary, not repeated here. Either index failing leaves the other's
 * results on screen with a Retry for the missing half.
 */
const JournalSearchResults = ({
  query,
  encounterIndex,
  instanceIndex,
  encounterMatches,
  instanceMatches,
  page,
  onPageChange,
  onSelectEncounter,
  onSelectInstance,
  onClear,
}: JournalSearchResultsProps): JSX.Element => {
  const instancesHeadingId = useId();
  const encountersHeadingId = useId();
  const listTopRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(encounterMatches.length / RESULT_PAGE_SIZE));
  const start = (page - 1) * RESULT_PAGE_SIZE;
  const shownEncounters = encounterMatches.slice(start, start + RESULT_PAGE_SIZE);
  const shownInstances = instanceMatches.slice(0, INSTANCE_RESULT_LIMIT);

  // A list is read from the top: a new page starts at its first match.
  const handlePageChange = (next: number): void => {
    onPageChange(next);
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  const encountersFailed = encounterIndex.isError && !encounterIndex.data;
  const instancesFailed = instanceIndex.isError && !instanceIndex.data;

  const renderBody = (): JSX.Element => {
    if (encounterIndex.isPending || instanceIndex.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={RESULT_COLS}
          count={6}
          itemHeight={RESULT_ROW_HEIGHT}
          gap={RESULT_GAP_PX}
          label="Loading journal names"
        />
      );
    }
    if (encountersFailed && instancesFailed) {
      return (
        <ErrorState
          compact
          error={encounterIndex.error}
          context="the journal's names"
          onRetry={() => {
            void encounterIndex.refetch();
            void instanceIndex.refetch();
          }}
        />
      );
    }
    const nothingFound = encounterMatches.length === 0 && instanceMatches.length === 0;
    if (nothingFound && !encountersFailed && !instancesFailed) {
      return (
        <EmptyState
          compact
          icon={<SearchOffRoundedIcon />}
          title={`Nothing in the journal matches “${query}”`}
          description="Every word you type must start a word of the boss's or instance's name. Try fewer words or another spelling."
          action={
            <Button variant="outlined" size="small" onClick={onClear}>
              Clear search
            </Button>
          }
        />
      );
    }

    return (
      <Stack spacing={3}>
        {instancesFailed ? (
          <ErrorState
            compact
            error={instanceIndex.error}
            context="dungeon and raid names"
            onRetry={() => void instanceIndex.refetch()}
          />
        ) : instanceMatches.length > 0 ? (
          <Stack spacing={1.5}>
            <GroupHeading
              id={instancesHeadingId}
              title="Dungeons and raids"
              count={
                instanceMatches.length > shownInstances.length
                  ? `${formatNumber(shownInstances.length)} closest of ${formatNumber(instanceMatches.length)}`
                  : formatNumber(instanceMatches.length)
              }
            />
            <ResultList labelledBy={instancesHeadingId}>
              {shownInstances.map((instance) => (
                <Box component="li" key={instance.id} sx={{ minWidth: 0 }}>
                  <InstanceResult instance={instance} onSelect={onSelectInstance} />
                </Box>
              ))}
            </ResultList>
          </Stack>
        ) : encountersFailed ? (
          // The other half failed: say this one found nothing rather than nothing at all.
          <NoneFound text={`No dungeons or raids match “${query}”.`} />
        ) : null}

        {encountersFailed ? (
          <ErrorState
            compact
            error={encounterIndex.error}
            context="encounter names"
            onRetry={() => void encounterIndex.refetch()}
          />
        ) : encounterMatches.length > 0 ? (
          <Stack spacing={1.5} ref={listTopRef} sx={scrollMarginSx}>
            <GroupHeading
              id={encountersHeadingId}
              title="Encounters"
              count={pluralize(encounterMatches.length, "match", "matches")}
            />
            <ResultList labelledBy={encountersHeadingId}>
              {shownEncounters.map((encounter) => (
                <Box component="li" key={encounter.id} sx={{ minWidth: 0 }}>
                  <EncounterResult encounter={encounter} onSelect={onSelectEncounter} />
                </Box>
              ))}
            </ResultList>
            {pageCount > 1 ? (
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_event, next) => handlePageChange(next)}
                siblingCount={0}
                aria-label="Encounter result pages"
                sx={{ alignSelf: "center" }}
              />
            ) : null}
          </Stack>
        ) : instancesFailed ? (
          <NoneFound text={`No encounters match “${query}”.`} />
        ) : null}
      </Stack>
    );
  };

  return (
    <SectionCard
      title={`Results for “${query}”`}
      description="Pick a dungeon, raid or boss to open it."
    >
      {renderBody()}
    </SectionCard>
  );
};

export default JournalSearchResults;
