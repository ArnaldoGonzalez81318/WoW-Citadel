import Diversity3RoundedIcon from "@mui/icons-material/Diversity3Rounded";
import { Button, Stack, Typography } from "@mui/material";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useId, useMemo } from "react";

import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import FactionCrest from "@/features/reputations/components/FactionCrest";
import FactionGrid, {
  FactionGridSkeleton,
} from "@/features/reputations/components/FactionGrid";
import type { FactionGridEntry } from "@/features/reputations/components/FactionGrid";
import { factionQuery } from "@/features/reputations/hooks/reputationQueries";
import { groupAccentKey } from "@/features/reputations/services/reputationPalette";
import type { AccentKey } from "@/features/reputations/services/reputationPalette";
import { pluralize } from "@/features/reputations/services/reputationService";
import type { Faction, FactionRef, LadderKind } from "@/features/reputations/types";
import { formatNumber } from "@/lib/format";

/** Before the group's record lands: about one Midnight's worth of cards. */
const SKELETON_COUNT = 8;
const EMPTY: FactionRef[] = [];

type Members = {
  /** Each member's record in member order (undefined until it loads, null for a 404). */
  records: Array<Faction | null | undefined>;
};

/** Module scope, so react-query only re-runs it when a result changes. */
const combineMembers = (results: UseQueryResult<Faction | null>[]): Members => ({
  records: results.map((result) => result.data),
});

/** Renown first: it is how current content is earned. */
const KIND_ORDER: readonly LadderKind[] = ["renown", "friendship", "standard", "group", "none"];

const compositionOf = (records: Members["records"]): string[] => {
  const counts = new Map<LadderKind, number>();
  records.forEach((record) => {
    if (record) {
      counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
    }
  });
  return KIND_ORDER.filter((kind) => counts.has(kind)).map((kind) => {
    const count = counts.get(kind) ?? 0;
    if (kind === "group") {
      return pluralize(count, "sub-group", "sub-groups");
    }
    return `${formatNumber(count)} ${kind === "none" ? "without a ladder" : kind}`;
  });
};

const toEntries = (factions: readonly FactionRef[], accent: AccentKey): FactionGridEntry[] =>
  factions.map((faction) => ({ faction, accent }));

/** A header inside the group (The Tillers, Horde Forces), with its own factions. */
const SubGroup = ({
  header,
  accent,
  onSelect,
}: {
  header: Faction;
  accent: AccentKey;
  onSelect: (faction: FactionRef) => void;
}): JSX.Element => {
  const headingId = useId();
  const entries = useMemo(() => toEntries(header.children, accent), [header.children, accent]);
  return (
    <Stack component="section" aria-labelledby={headingId} spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
        <FactionCrest name={header.name} accent={accent} kind={header.kind} size={32} />
        <Stack sx={{ minWidth: 0 }}>
          <Typography
            id={headingId}
            variant="subtitle1"
            component="h3"
            sx={{ m: 0, fontWeight: 600, overflowWrap: "anywhere" }}
          >
            {header.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            {pluralize(header.children.length, "faction", "factions")}
            {/* A header with a bar is earned too (Silvermoon Court's renown). */}
            {header.kind === "renown"
              ? ", plus renown of its own"
              : header.kind === "standard" || header.kind === "friendship"
                ? ", plus a standing of its own"
                : null}
          </Typography>
        </Stack>
      </Stack>
      {/* Sub-group cards load as they near the viewport: Classic alone folds 34. */}
      <FactionGrid label={`${header.name} factions`} entries={entries} lazy onSelect={onSelect} />
    </Stack>
  );
};

export type GroupBrowserProps = {
  group: FactionRef;
  onSelect: (faction: FactionRef) => void;
  /**
   * Leaves the group (a stale link to a group Blizzard no longer has) for
   * the page's default: the first full group, not the guild's single bar.
   */
  onReset: () => void;
};

/**
 * One root group: its factions as cards, then every header among them (The
 * Tillers, Horde, Alliance Forces) as a sub-section of its own factions, so
 * the in-game tree reads top to bottom. The members' records load together
 * (at most 20, under the page's request cap) because the sub-sections and
 * the kind counts need them; sub-group cards load as they near the viewport.
 */
const GroupBrowser = ({ group, onSelect, onReset }: GroupBrowserProps): JSX.Element => {
  const query = useQuery(factionQuery(group.id));
  const record = query.data;
  const accent = groupAccentKey(group.id);
  // A standalone root (Keg Leg's Crew) folds nothing: it is its own only card.
  const members = useMemo(
    () =>
      record
        ? record.children.length > 0
          ? record.children
          : [{ id: record.id, name: record.name }]
        : EMPTY,
    [record],
  );
  const memberState = useQueries({
    queries: members.map((member) => factionQuery(member.id)),
    combine: combineMembers,
  });
  const entries = useMemo(() => toEntries(members, accent), [members, accent]);
  const subGroups = useMemo(
    () =>
      memberState.records.filter(
        (member): member is Faction =>
          member !== null &&
          member !== undefined &&
          member.id !== group.id &&
          member.children.length > 0,
      ),
    [memberState.records, group.id],
  );

  const name = record?.name ?? group.name;
  const standalone = record !== undefined && record !== null && record.children.length === 0;
  const description = record
    ? standalone
      ? "A faction of its own, outside the expansion groups."
      : [pluralize(record.children.length, "faction", "factions"), ...compositionOf(memberState.records)].join(" · ")
    : undefined;

  const renderBody = (): JSX.Element => {
    if (query.isPending) {
      return <FactionGridSkeleton count={SKELETON_COUNT} label={`Loading ${name} factions`} />;
    }
    if (query.isError && !record) {
      return (
        <ErrorState
          compact
          error={query.error}
          context={`${name} factions`}
          onRetry={() => void query.refetch()}
        />
      );
    }
    if (!record) {
      return (
        <EmptyState
          compact
          icon={<Diversity3RoundedIcon />}
          title="Group not found"
          description={`Blizzard lists ${name} as a reputation group but has no record of it.`}
          action={
            <Button variant="outlined" size="small" onClick={onReset}>
              Show the default group
            </Button>
          }
        />
      );
    }
    return (
      <Stack spacing={4}>
        <FactionGrid label={`${name} factions`} entries={entries} onSelect={onSelect} />
        {subGroups.map((header) => (
          <SubGroup key={header.id} header={header} accent={accent} onSelect={onSelect} />
        ))}
      </Stack>
    );
  };

  return (
    <SectionCard title={name} description={description}>
      {renderBody()}
    </SectionCard>
  );
};

export default GroupBrowser;
