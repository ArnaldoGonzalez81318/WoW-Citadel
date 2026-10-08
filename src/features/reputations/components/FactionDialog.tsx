import Diversity3RoundedIcon from "@mui/icons-material/Diversity3Rounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Link, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import FactionLinkList from "@/features/reputations/components/FactionLinkList";
import RenownTrackView from "@/features/reputations/components/RenownTrackView";
import StandingLadderView from "@/features/reputations/components/StandingLadderView";
import { factionQuery, ladderQuery } from "@/features/reputations/hooks/reputationQueries";
import { pathOf } from "@/features/reputations/hooks/useFactionParents";
import type { FactionParents } from "@/features/reputations/hooks/useFactionParents";
import { groupAccentKey } from "@/features/reputations/services/reputationPalette";
import {
  KIND_TITLE,
  ladderSummary,
  pluralize,
  renownSummary,
  rewardCount,
} from "@/features/reputations/services/reputationService";
import type { Faction, FactionRef } from "@/features/reputations/types";
import { WOWHEAD_LABEL, WOWHEAD_ORIGIN } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";

export type FactionDialogProps = {
  /** Whether the dialog is showing; `factionId` stays set through the close transition. */
  open: boolean;
  /** The faction to show (the last one opened). */
  factionId: number | null;
  /** Its name from the card or index, shown until the record loads. */
  fallbackName?: string;
  parents: FactionParents;
  rootIds: ReadonlySet<number>;
  /** Shows another faction (a parent or a child) in this dialog. */
  onNavigate: (faction: FactionRef) => void;
  onClose: () => void;
};

/** The raw records behind the dialog, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (factionId: number): string =>
  `/api-explorer/reputations?${new URLSearchParams({
    endpoint: "reputation-faction",
    reputationFactionId: String(factionId),
  }).toString()}`;

/** Wowhead addresses factions by the game's own id, which Blizzard's API uses too. */
const wowheadFactionUrl = (factionId: number): string =>
  `${WOWHEAD_ORIGIN}/faction=${factionId}`;

/** "Classic › Horde", each step a link that shows that header in the dialog. */
const ParentTrail = ({
  path,
  onNavigate,
}: {
  path: FactionRef[];
  onNavigate: (faction: FactionRef) => void;
}): JSX.Element => (
  <Box
    component="ol"
    role="list"
    aria-label="Parent groups"
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "flex",
      flexWrap: "wrap",
      columnGap: 0.75,
      rowGap: 0.25,
    }}
  >
    {path.map((step, index) => (
      <Box component="li" key={step.id} sx={{ display: "inline-flex", gap: 0.75, minWidth: 0 }}>
        {index > 0 ? (
          <Box component="span" aria-hidden="true" sx={{ color: "text.secondary" }}>
            ›
          </Box>
        ) : null}
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => onNavigate(step)}
          sx={{ textAlign: "left", overflowWrap: "anywhere" }}
        >
          {step.name}
        </Link>
      </Box>
    ))}
  </Box>
);

/** The ladder section's body: its own load and failure, inside a dialog that has the faction. */
const LadderSection = ({ faction }: { faction: Faction }): JSX.Element => {
  const query = useQuery({
    ...ladderQuery(faction.ladderId ?? 0),
    enabled: faction.ladderId !== null,
  });
  if (faction.ladderId === null) {
    return (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        This faction names no standing ladder.
      </Typography>
    );
  }
  if (query.isPending) {
    return <LoadingSkeleton variant="block" height={220} label="Loading standings" />;
  }
  if (query.isError && !query.data) {
    return (
      <ErrorState
        compact
        error={query.error}
        context="this faction's standings"
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data) {
    return (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        Blizzard has no record of this faction&apos;s standing ladder.
      </Typography>
    );
  }
  return <StandingLadderView ladder={query.data} kind={faction.kind} />;
};

/**
 * A faction in full: kind, where it sits in the tree, side and paragon, its
 * description, its standing ladder or renown track drawn out, and the
 * factions it heads. Parents and children open in this same dialog (the URL
 * follows), so the whole tree can be walked without closing it.
 */
const FactionDialog = ({
  open,
  factionId,
  fallbackName,
  parents,
  rootIds,
  onNavigate,
  onClose,
}: FactionDialogProps): JSX.Element => {
  const query = useQuery({
    ...factionQuery(factionId ?? 0),
    enabled: factionId !== null,
  });
  const data = factionId !== null ? query.data : undefined;
  const ladder = useQuery({
    ...ladderQuery(data?.ladderId ?? 0),
    enabled: data !== undefined && data !== null && data.ladderId !== null,
  });

  // Walking to a parent or child replaces what the pressed button belonged
  // to, so focus would fall back to the dialog itself: move it to the new
  // title instead, which also announces the faction just opened.
  const anchorRef = useRef<HTMLSpanElement>(null);
  const focusTitleRef = useRef(false);
  const navigate = (faction: FactionRef): void => {
    focusTitleRef.current = true;
    onNavigate(faction);
  };
  useEffect(() => {
    if (!focusTitleRef.current || !data || data.id !== factionId) {
      return;
    }
    focusTitleRef.current = false;
    const title = anchorRef.current
      ?.closest<HTMLElement>("[role='dialog']")
      ?.querySelector<HTMLElement>("h2");
    if (title) {
      title.tabIndex = -1;
      title.focus();
    }
  }, [data, factionId]);

  const path = factionId !== null ? pathOf(factionId, parents) : [];
  // A root wears its own colour; anything under one, its root's.
  const accent = groupAccentKey(
    path[0]?.id ?? (factionId !== null && rootIds.has(factionId) ? factionId : undefined),
  );
  const title = data?.name ?? fallbackName ?? (factionId !== null ? `Faction #${factionId}` : "");
  // The kind in words; the rows below say where it sits, with links.
  const subtitle = data ? KIND_TITLE[data.kind] : undefined;

  const rows: DetailDialogRow[] = [];
  const sections: DetailDialogSection[] = [];
  if (data) {
    if ((data.kind === "standard" || data.kind === "friendship") && ladder.data) {
      rows.push({
        label: data.kind === "standard" ? "Standings" : "Ranks",
        value: ladderSummary(data.kind, ladder.data),
      });
    }
    if (data.kind === "renown") {
      rows.push({ label: "Renown", value: renownSummary(data.renownLevels) });
    }
    if (path.length > 0) {
      rows.push({ label: "Part of", value: <ParentTrail path={path} onNavigate={navigate} /> });
    } else if (rootIds.has(data.id)) {
      rows.push({ label: "Part of", value: "A top-level group of the reputation pane" });
    }
    if (data.children.length > 0) {
      rows.push({ label: "Heads", value: pluralize(data.children.length, "faction", "factions") });
    }
    if (data.side) {
      rows.push({ label: "Side", value: data.side.name });
    }
    if (data.canParagon) {
      rows.push({
        label: "Paragon",
        value:
          data.kind === "renown"
            ? "Keeps rewarding past the top renown level"
            : "Keeps rewarding past the final standing",
      });
    }
    rows.push({ label: "Faction ID", value: formatNumber(data.id, { useGrouping: false }) });

    if (data.description) {
      sections.push({
        heading: "About",
        content: (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
            {data.description}
          </Typography>
        ),
      });
    }
    if (data.kind === "standard" || data.kind === "friendship") {
      sections.push({
        heading: data.kind === "standard" ? "Standing ladder" : "Friendship ranks",
        content: <LadderSection faction={data} />,
      });
    }
    if (data.kind === "renown") {
      sections.push({
        heading: `Renown track · ${pluralize(rewardCount(data.renownLevels), "reward", "rewards")}`,
        content: <RenownTrackView levels={data.renownLevels} />,
      });
    }
    if (data.children.length > 0) {
      sections.push({
        heading: `Factions in ${data.name}`,
        content: (
          <FactionLinkList
            label={`Factions in ${data.name}`}
            factions={data.children}
            accent={accent}
            onOpen={navigate}
          />
        ),
      });
    }
  }

  const notFound = factionId !== null && query.data === null;

  return (
    <DetailDialog
      open={open && factionId !== null}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      rows={rows}
      sections={sections}
      loading={query.isPending}
      error={query.isError && !query.data ? query.error : undefined}
      onRetry={() => void query.refetch()}
      errorContext="faction details"
      maxWidth="md"
      actions={
        factionId !== null ? (
          <>
            <Button component={RouterLink} to={workbenchUrl(factionId)} size="small">
              Open in API workbench
            </Button>
            {!notFound ? (
              <Button
                href={wowheadFactionUrl(factionId)}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {WOWHEAD_LABEL}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {notFound ? (
        <EmptyState
          compact
          icon={<Diversity3RoundedIcon />}
          title="Faction not found"
          description={`Blizzard has no faction #${factionId} in its game data.`}
        />
      ) : null}
      {/* Locates the dialog for the focus move above; renders nothing. */}
      <Box component="span" ref={anchorRef} sx={{ display: "none" }} />
    </DetailDialog>
  );
};

export default FactionDialog;
