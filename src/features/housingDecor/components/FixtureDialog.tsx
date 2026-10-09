import {
  Box,
  Button,
  ButtonBase,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import FixtureKindTile from "@/features/housingDecor/components/FixtureKindTile";
import { idTextSx } from "@/features/housingDecor/components/housingStyles";
import {
  fixtureQuery,
  fixturesQuery,
} from "@/features/housingDecor/hooks/housingQueries";
import useHeldFailure from "@/features/housingDecor/hooks/useHeldFailure";
import {
  FIXTURE_KIND_SINGULAR,
  familyCountLabel,
  familyMemberNoun,
  formatHookCounts,
  groupFixtures,
  memberLabel,
  pluralize,
} from "@/features/housingDecor/services/housingCatalog";
import { countHooks } from "@/features/housingDecor/services/housingService";
import type {
  FixtureFamily,
  FixtureMember,
  FixtureRecord,
} from "@/features/housingDecor/types";
import { formatNumber } from "@/lib/format";
import { focusRing } from "@/theme";

export type FixtureDialogProps = {
  /** Whether the dialog is showing; `fixtureId` stays set through the close transition. */
  open: boolean;
  /** The fixture to show (the last one opened); its family comes with it. */
  fixtureId: number | null;
  /** Another fixture of the family was picked (the page replaces its URL entry). */
  onSelect: (fixtureId: number) => void;
  onClose: () => void;
};

/** The raw fixture record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (fixtureId: number): string =>
  `/api-explorer/housing-decor?${new URLSearchParams({
    endpoint: "fixture",
    fixtureId: String(fixtureId),
  }).toString()}`;

type RecordResult = UseQueryResult<FixtureRecord | null>;

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** A record failed (and has nothing to show) at least once; a Retry keeps it so. */
const recordFailed = (result: RecordResult): boolean =>
  result.data === undefined && result.errorUpdateCount > 0;

/** One member's hook line: loading, failed, none, or the counts. */
const hookLine = (result: RecordResult | undefined): string | null => {
  if (!result || (result.data === undefined && !recordFailed(result))) {
    return null;
  }
  if (recordFailed(result)) {
    return "Hook points unavailable";
  }
  if (result.data === null) {
    return "No record";
  }
  const hooks = result.data?.hooks ?? [];
  return hooks.length > 0 ? formatHookCounts(countHooks(hooks)) : "No hook points";
};

/**
 * Across a family: each hook type's count, or its range when the members
 * differ ("Window 6–16"). Types a member lacks count as zero for it.
 */
const familyHookRanges = (records: readonly (FixtureRecord | null)[]): string[] => {
  const perMember = records.map((record) => countHooks(record?.hooks ?? []));
  const types = [...new Set(perMember.flatMap((counts) => counts.map((entry) => entry.type)))];
  return types
    .map((type) => {
      const values = perMember.map(
        (counts) => counts.find((entry) => entry.type === type)?.count ?? 0,
      );
      const low = Math.min(...values);
      const high = Math.max(...values);
      return { type, low, high };
    })
    .sort((left, right) => right.high - left.high || left.type.localeCompare(right.type))
    .map(({ type, low, high }) =>
      low === high ? `${type} ${formatNumber(high)}` : `${type} ${formatNumber(low)}–${formatNumber(high)}`,
    );
};

/** One member as a toggle: its variant (or id), and its hook points once loaded. */
const MemberButton = ({
  member,
  result,
  selected,
  onSelect,
}: {
  member: FixtureMember;
  result: RecordResult | undefined;
  selected: boolean;
  onSelect: (fixtureId: number) => void;
}): JSX.Element => {
  const line = hookLine(result);
  // Without a variant the label already is "Fixture 629"; the id once is enough.
  const showId = member.variant !== null;
  // The button's text (label, id, hook points) is its accessible name.
  return (
    <ButtonBase
      onClick={() => onSelect(member.id)}
      aria-pressed={selected}
      sx={(theme) => ({
        width: "100%",
        minHeight: 56,
        px: 1.5,
        py: 1,
        justifyContent: "flex-start",
        textAlign: "left",
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.border.subtle}`,
        boxShadow: selected ? `inset 0 0 0 1px ${theme.palette.primary.main}` : "none",
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.surface.inset,
        "@media (hover: hover)": {
          "&:hover": { borderColor: selected ? theme.palette.primary.light : theme.palette.border.strong },
        },
        "&.Mui-focusVisible": focusRing(theme),
      })}
    >
      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" component="span" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
          {memberLabel(member)}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="span">
          {showId ? (
            <Box component="span" sx={idTextSx}>
              {`#${member.id}`}
            </Box>
          ) : null}
          {line ? `${showId ? " · " : ""}${line}` : null}
          {line === null ? (
            <Skeleton
              variant="text"
              width={96}
              sx={{ display: "inline-block", ml: showId ? 1 : 0, verticalAlign: "middle" }}
            />
          ) : null}
        </Typography>
      </Stack>
    </ButtonBase>
  );
};

/**
 * A fixture family: the picked fixture's hook points by type, the family's
 * range of each across its members, and every member as a toggle with its
 * own counts. Opening a family loads its members' records (up to eighteen,
 * six at a time): the only place hook points come from.
 */
const FixtureDialog = ({
  open,
  fixtureId,
  onSelect,
  onClose,
}: FixtureDialogProps): JSX.Element => {
  const enabled = fixtureId !== null;
  const query = useQuery({ ...fixturesQuery(), enabled });
  const failure = useHeldFailure(query);
  const families = useMemo(
    () => (query.data ? groupFixtures(query.data) : undefined),
    [query.data],
  );
  const family: FixtureFamily | undefined = useMemo(
    () => families?.find((entry) => entry.members.some((member) => member.id === fixtureId)),
    [families, fixtureId],
  );
  const notFound = enabled && families !== undefined && family === undefined;
  const members = family?.members ?? [];
  const selected = members.find((member) => member.id === fixtureId);

  // No combine (whose memoized result can lag a changed list by a render);
  // the rows are matched to the members only when the lengths agree.
  const results = useQueries({
    queries: members.map((member) => ({
      ...fixtureQuery(member.id),
      enabled: open && enabled,
    })),
  });
  const aligned = results.length === members.length;
  const resultById = new Map<number, RecordResult>(
    aligned ? members.map((member, index) => [member.id, results[index]]) : [],
  );
  const selectedResult = selected ? resultById.get(selected.id) : undefined;

  const loadedCount = aligned ? results.filter((result) => result.data !== undefined).length : 0;
  const failedResults = aligned ? results.filter(recordFailed) : [];
  const retrying = failedResults.some((result) => result.fetchStatus !== "idle");
  const allLoaded = aligned && members.length > 0 && loadedCount === members.length;
  const ranges = allLoaded ? familyHookRanges(results.map((result) => result.data ?? null)) : [];

  // A Retry clears the records' errors while it runs; the banner keeps the last one.
  const recordError = failedResults.find((result) => result.error !== null)?.error ?? null;
  const [lastRecordError, setLastRecordError] = useState<unknown>(null);
  if (recordError !== null && recordError !== lastRecordError) {
    setLastRecordError(recordError);
  }

  const membersHeadingId = useId();
  const title = family?.name ?? (fixtureId !== null ? `Fixture #${fixtureId}` : "");

  const renderSelectedHooks = (): JSX.Element | null => {
    if (!selectedResult || (selectedResult.data === undefined && !recordFailed(selectedResult))) {
      return <Skeleton variant="rounded" width={200} height={24} />;
    }
    // The banner under it says why, with the Retry.
    if (recordFailed(selectedResult)) {
      return null;
    }
    const record = selectedResult.data;
    if (!record) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard has no record for this fixture, so its hook points are unknown.
        </Typography>
      );
    }
    const counts = countHooks(record.hooks);
    if (counts.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          No hook points: its record lists none.
        </Typography>
      );
    }
    return (
      <Stack
        component="ul"
        role="list"
        aria-label="Hook points"
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={0.75}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {counts.map((entry) => (
          <Box component="li" key={entry.type}>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${entry.type} · ${formatNumber(entry.count)}`}
            />
          </Box>
        ))}
      </Stack>
    );
  };

  const renderSelected = (): JSX.Element | null => {
    if (!family || !selected) {
      return null;
    }
    return (
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ minWidth: 0 }}>
        <FixtureKindTile kind={family.kind} size={72} />
        <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          <Box>
            <Typography variant="subtitle1" component="p" sx={{ m: 0, overflowWrap: "anywhere" }}>
              {selected.name || memberLabel(selected)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              {"Fixture "}
              <Box component="span" sx={idTextSx}>
                {selected.id}
              </Box>
              {` · ${FIXTURE_KIND_SINGULAR[family.kind]}`}
            </Typography>
          </Box>
          {renderSelectedHooks()}
        </Stack>
      </Stack>
    );
  };

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Fixture not found"
          description={`Blizzard's fixture search has no fixture #${fixtureId ?? ""}.`}
        />
      );
    }
    if (!family) {
      return null;
    }
    return (
      <Stack spacing={2.5}>
        {renderSelected()}

        {failedResults.length > 0 ? (
          <ErrorState
            compact
            error={recordError ?? lastRecordError}
            title={`${pluralize(failedResults.length, "fixture record", "fixture records")} could not be loaded`}
            context="these fixtures"
            onRetry={() =>
              failedResults
                .filter((result) => result.fetchStatus === "idle")
                .forEach((result) => void result.refetch())
            }
            retryLabel={retrying ? "Retrying…" : "Retry"}
          />
        ) : null}

        {members.length > 1 ? (
          <Box component="section" aria-labelledby={membersHeadingId}>
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              columnGap={1}
              alignItems="baseline"
              sx={{ mb: 1 }}
            >
              <Typography id={membersHeadingId} variant="overline" component="h3" sx={{ m: 0 }}>
                {`${capitalize(familyMemberNoun(family)[1])} (${formatNumber(members.length)})`}
              </Typography>
              {allLoaded && ranges.length > 0 ? (
                <Typography variant="caption" color="text.secondary" component="span">
                  {`Across the family: ${ranges.join(" · ")}`}
                </Typography>
              ) : null}
            </Stack>
            {!allLoaded && failedResults.length === 0 ? (
              <Box sx={{ mb: 1.25 }}>
                {/* Not a live region: eighteen records would announce eighteen times. */}
                <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                  {`Loading hook points · ${formatNumber(loadedCount)} of ${formatNumber(members.length)}`}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(loadedCount / Math.max(1, members.length)) * 100}
                  aria-hidden="true"
                  sx={{ mt: 0.5, height: 2 }}
                />
              </Box>
            ) : null}
            <Box
              component="ul"
              role="list"
              aria-labelledby={membersHeadingId}
              sx={{
                listStyle: "none",
                m: 0,
                p: 0,
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
              }}
            >
              {members.map((member) => (
                <Box component="li" key={member.id} sx={{ minWidth: 0 }}>
                  <MemberButton
                    member={member}
                    result={resultById.get(member.id)}
                    selected={member.id === fixtureId}
                    onSelect={onSelect}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={family ? `${FIXTURE_KIND_SINGULAR[family.kind]} · ${familyCountLabel(family)}` : undefined}
      maxWidth="md"
      loading={enabled && query.isPending && !failure.failed}
      error={failure.failed ? failure.error : undefined}
      onRetry={failure.retry}
      errorContext="fixtures"
      actions={
        fixtureId !== null ? (
          <Button component={RouterLink} to={workbenchUrl(fixtureId)} size="small">
            Open in API workbench
          </Button>
        ) : null
      }
    >
      {renderBody()}
    </DetailDialog>
  );
};

export default FixtureDialog;
