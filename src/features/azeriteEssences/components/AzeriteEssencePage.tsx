import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import { Button, Chip, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import EssenceDialog from "@/features/azeriteEssences/components/EssenceDialog";
import EssenceFilters, {
  roleFromParam,
  roleToParam,
} from "@/features/azeriteEssences/components/EssenceFilters";
import type { ClassOption } from "@/features/azeriteEssences/components/EssenceFilters";
import EssenceGrid, {
  EssenceGridSkeleton,
} from "@/features/azeriteEssences/components/EssenceGrid";
import HeartIntro from "@/features/azeriteEssences/components/HeartIntro";
import { essenceListQuery } from "@/features/azeriteEssences/hooks/essenceQueries";
import { useEssenceRecords } from "@/features/azeriteEssences/hooks/useEssenceRecords";
import { useSpecCatalog } from "@/features/azeriteEssences/hooks/useSpecCatalog";
import {
  ROLE_ORDER,
  byNewest,
  describeRoles,
  groupByRoles,
  pluralize,
  roleNamesOf,
  searchablePowerNames,
} from "@/features/azeriteEssences/services/azeriteEssenceService";
import type {
  EssenceGroup,
  EssenceSummary,
  RoleType,
  Specialization,
} from "@/features/azeriteEssences/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, rankByName } from "@/lib/fuzzyMatch";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = { role: "", class: "", q: "", essence: "" };
/** Cards a skeleton section shows: two rows on desktop. */
const SKELETON_COUNT = 8;
const EMPTY: EssenceSummary[] = [];

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Whether one of the essence's specializations plays `role` in `classId`
 * (either may be null for "any"). Per spec, so Paladin and Healer means
 * Holy, not "a paladin spec, and some healer".
 */
const matches = (
  essence: EssenceSummary,
  specs: ReadonlyMap<number, Specialization>,
  role: RoleType | null,
  classId: number | null,
): boolean =>
  (role === null && classId === null) ||
  essence.specs.some((ref) => {
    const spec = specs.get(ref.id);
    return (
      spec !== undefined &&
      (role === null || spec.role === role) &&
      (classId === null || spec.playableClass?.id === classId)
    );
  });

type SearchCandidate = { essence: EssenceSummary; text: string };

const groupTitle = (group: EssenceGroup, names: Record<RoleType, string>): string => {
  if (group.roles.length === 0) {
    return "Essences with unknown roles";
  }
  if (group.roles.length === ROLE_ORDER.length) {
    return "Essences for every role";
  }
  return `${describeRoles(group.roles, names)} essences`;
};

const groupDescription = (group: EssenceGroup, names: Record<RoleType, string>): string => {
  if (group.roles.length === 0) {
    return "Their specialization records could not be read, so their roles are unknown.";
  }
  const reach =
    group.roles.length === ROLE_ORDER.length
      ? "Open to specializations of all three roles."
      : group.roles.length === 1
        ? `Open only to ${names[group.roles[0]]} specializations.`
        : `Open to ${group.roles.map((role) => names[role]).join(" and ")} specializations.`;
  return `${reach} Highest essence ID first.`;
};

/**
 * Azerite Essences: the Heart of Azeroth's essences from Battle for
 * Azeroth as an explorer. The roster is grouped by the roles that can use
 * each essence (every role, then Tank, Healer, Damage), each card showing
 * its icon, roles and major and minor power; role and class filters apply
 * per specialization, and the search covers essence and power names. An
 * essence opens in a dialog with its rank ladder (each rank's spells with
 * icons and tooltips) and its specializations by class. Role, class,
 * search and the open essence all live in the URL.
 *
 * The page loads the essence search (every essence and its specs in one
 * request) and the 39 specialization records behind roles and classes, six
 * at a time; each card loads its record and icon as it nears the viewport,
 * a search loads the rest, and the dialog loads its own spells.
 */
const AzeriteEssencePage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();
  const list = useQuery(essenceListQuery());
  const essences = list.data ?? EMPTY;
  const catalog = useSpecCatalog(list.data);
  const roleNames = useMemo(() => roleNamesOf(catalog.specs), [catalog.specs]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // A Retry puts a list with no data back to pending; errorUpdateCount
  // survives it, so the error (and its focused Retry button) stays up.
  const listFailed = list.data === undefined && list.errorUpdateCount > 0;
  const [lastListError, setLastListError] = useState<unknown>(null);
  if (list.error && list.error !== lastListError) {
    setLastListError(list.error);
  }
  // Likewise for the spec records: a retried one has no error until it fails again.
  const [lastSpecError, setLastSpecError] = useState<Error | null>(null);
  if (catalog.error !== null && catalog.error !== lastSpecError) {
    setLastSpecError(catalog.error);
  }
  const specError = catalog.error ?? lastSpecError;

  /* ---------------- Search (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const search = params.q.trim();
  const searching = search.length >= MIN_FUZZY_QUERY_LENGTH;
  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a shared link): adopt it.
    if (search !== emittedRef.current) {
      emittedRef.current = search;
      setDraft(search);
    }
  }, [search]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ q: next || null }, { replace: true });
    },
    [setParams],
  );
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null }, { replace: true });
  }, [setParams]);

  // Searching is an explicit request: it loads every essence's record
  // (six at a time), so power names match as well as essence names.
  const records = useEssenceRecords(list.data, searching);
  // A retried record has no error until it fails again; the banner keeps the last one.
  const [lastRecordError, setLastRecordError] = useState<Error | null>(null);
  if (records.error !== null && records.error !== lastRecordError) {
    setLastRecordError(records.error);
  }
  const recordError = records.error ?? lastRecordError;
  // Power names still on their way: no count or "no match" is final yet.
  const searchPending = searching && !records.complete;

  /* ---------------- Role and class ---------------- */

  const role = roleFromParam(params.role);
  const requestedClass = parseId(params.class);
  const classes = useMemo<{ id: number; name: string }[]>(() => {
    const byId = new Map<number, string>();
    catalog.specs.forEach((spec) => {
      if (spec.playableClass) {
        byId.set(spec.playableClass.id, spec.playableClass.name);
      }
    });
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [catalog.specs]);
  const classKnown = requestedClass !== null && classes.some((entry) => entry.id === requestedClass);
  // Trusted until every spec record has answered: a class whose specs failed
  // to load is not an unknown class, and keeps its place in the address.
  const classesComplete = catalog.settled && catalog.failedCount === 0;
  const classId = requestedClass !== null && (!classesComplete || classKnown) ? requestedClass : null;

  // A role or class the page cannot use (a typo, another region's class id)
  // falls back to "any" in the address too.
  useEffect(() => {
    if (params.role !== "" && role === null) {
      setParams({ role: null }, { replace: true });
    }
  }, [params.role, role, setParams]);
  useEffect(() => {
    if (params.class === "") {
      return;
    }
    if (requestedClass === null || (classesComplete && !classKnown)) {
      setParams({ class: null }, { replace: true });
    }
  }, [params.class, requestedClass, classesComplete, classKnown, setParams]);

  const changeRole = useCallback(
    (next: RoleType | null): void => {
      setParams({ role: next ? roleToParam(next) : null });
    },
    [setParams],
  );
  const changeClass = useCallback(
    (next: number | null): void => {
      setParams({ class: next === null ? null : String(next) });
    },
    [setParams],
  );
  // The empty state's buttons disappear with what they cleared; focus
  // moves to the search field rather than falling back to the page.
  const clearFilters = useCallback((): void => {
    setParams({ role: null, class: null });
    searchInputRef.current?.focus();
  }, [setParams]);
  const clearSearchAndFocus = useCallback((): void => {
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);
  const clearEverything = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, role: null, class: null }, { replace: true });
    searchInputRef.current?.focus();
  }, [setParams]);

  /* ---------------- What is on screen ---------------- */

  const searchResults = useMemo(() => {
    if (!searching) {
      return EMPTY;
    }
    const candidates: SearchCandidate[] = [];
    essences.forEach((essence) => {
      candidates.push({ essence, text: essence.name });
      const record = records.records.get(essence.id);
      if (record) {
        searchablePowerNames(record).forEach((text) => candidates.push({ essence, text }));
      }
    });
    // Best match first; an essence matched by its name and a power keeps its better rank.
    const seen = new Set<number>();
    const ranked: EssenceSummary[] = [];
    rankByName(candidates, search, (candidate) => candidate.text, candidates.length).forEach(
      (candidate) => {
        if (!seen.has(candidate.essence.id)) {
          seen.add(candidate.essence.id);
          ranked.push(candidate.essence);
        }
      },
    );
    return ranked;
  }, [essences, records.records, search, searching]);

  const base = searching ? searchResults : essences;
  const visible = useMemo(
    () => base.filter((essence) => matches(essence, catalog.specs, role, classId)),
    [base, catalog.specs, role, classId],
  );
  const groups = useMemo(() => groupByRoles(visible, catalog.specs), [visible, catalog.specs]);
  // Before the spec records settle there are no groups: one flat grid, in
  // the order the groups use.
  const newestFirst = useMemo(() => [...essences].sort(byNewest), [essences]);

  const roleCounts = useMemo<Record<RoleType, number> | null>(() => {
    if (!catalog.settled || searchPending) {
      return null;
    }
    const counts = { TANK: 0, HEALER: 0, DAMAGE: 0 };
    ROLE_ORDER.forEach((entry) => {
      counts[entry] = base.filter((essence) => matches(essence, catalog.specs, entry, classId)).length;
    });
    return counts;
  }, [base, catalog.settled, catalog.specs, classId, searchPending]);
  const classOptions = useMemo<ClassOption[]>(
    () =>
      classes.map((entry) => ({
        ...entry,
        count: searchPending
          ? null
          : base.filter((essence) => matches(essence, catalog.specs, role, entry.id)).length,
      })),
    [base, catalog.specs, classes, role, searchPending],
  );

  /* ---------------- Essence dialog ---------------- */

  const essenceId = parseId(params.essence);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownEssenceId, setShownEssenceId] = useState<number | null>(essenceId);
  if (essenceId !== null && essenceId !== shownEssenceId) {
    setShownEssenceId(essenceId);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (essenceId === null) {
      openedHereRef.current = false;
    }
    // A malformed id is dropped; an unknown one opens and says it is not found.
    if (params.essence !== "" && essenceId === null) {
      setParams({ essence: null }, { replace: true });
    }
  }, [essenceId, params.essence, setParams]);

  const openEssence = useCallback(
    (essence: EssenceSummary): void => {
      openedHereRef.current = true;
      setParams({ essence: String(essence.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the essence.
  const closeEssence = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ essence: null }, { replace: true });
  }, [navigate, setParams]);

  const summaryById = useMemo(
    () => new Map(essences.map((essence) => [essence.id, essence])),
    [essences],
  );

  /* ---------------- Render ---------------- */

  const total = essences.length;
  const filterWords = [
    role ? roleNames[role] : undefined,
    // Named as the Class select names it when its specs did not load.
    classId !== null
      ? (classes.find((entry) => entry.id === classId)?.name ?? `Class #${classId}`)
      : undefined,
  ].filter(Boolean);
  const loadedSpecs =
    catalog.queryCount === catalog.specIds.length ? catalog.specIds.length - catalog.pendingCount : 0;

  let summary = "";
  if (!list.data) {
    summary = list.isPending ? "Loading essences…" : "";
  } else if (!catalog.settled) {
    summary = `Reading roles and classes · ${formatNumber(loadedSpecs)} of ${pluralize(catalog.specIds.length, "specialization", "specializations")}`;
  } else if (search !== "" && !searching) {
    // One letter ranks nothing: that is "too short", not "no match".
    summary = "Type at least two letters to search";
  } else if (searching) {
    let matched = `${formatNumber(visible.length)} of ${pluralize(total, "essence", "essences")} match`;
    if (visible.length === 0) {
      matched = searchPending ? "Searching essence and power names" : "No matching essences";
    }
    let pending = "";
    if (searchPending) {
      pending = ` · searching power names, ${formatNumber(records.settledCount)} of ${formatNumber(total)} essences read`;
    } else if (records.failedCount > 0) {
      pending = ` · ${pluralize(records.failedCount, "essence", "essences")} not searched`;
    }
    summary = `${matched}${filterWords.length > 0 ? ` · ${filterWords.join(" · ")}` : ""}${pending}`;
  } else {
    summary = `Showing ${formatNumber(visible.length)} of ${pluralize(total, "essence", "essences")}${filterWords.length > 0 ? ` · ${filterWords.join(" · ")}` : ""}`;
  }
  const progress =
    list.isFetching ||
    (list.data !== undefined && !catalog.settled) ||
    searchPending ||
    (searching && records.retrying);

  const renderMain = (): JSX.Element => {
    if (listFailed) {
      return (
        <ErrorState
          error={list.error ?? lastListError}
          context="Azerite essences"
          onRetry={() => {
            if (list.fetchStatus === "idle") {
              void list.refetch();
            }
          }}
          retryLabel={list.fetchStatus === "idle" ? "Retry" : "Retrying…"}
        />
      );
    }
    // The roster shows while the spec records load (one slow record must
    // not hide 28 loaded essences); only a role or class filter, which needs
    // every record to be right, waits for them.
    const rolesPending = !catalog.settled;
    if (!list.data || (rolesPending && (role !== null || classId !== null))) {
      return (
        <SectionCard
          title="Essences"
          description={
            list.data ? "Reading which roles and classes can use each essence…" : undefined
          }
        >
          <EssenceGridSkeleton count={SKELETON_COUNT} label="Loading essences" />
        </SectionCard>
      );
    }
    if (total === 0) {
      return (
        <EmptyState
          icon={<PsychologyRoundedIcon />}
          title="No essences listed"
          description="Blizzard's essence search returned no essences for this region."
        />
      );
    }

    const specBanner =
      !rolesPending && catalog.failedCount > 0 && specError ? (
        <ErrorState
          compact
          error={specError}
          title={`${pluralize(catalog.failedCount, "specialization", "specializations")} could not be loaded`}
          context="these specializations"
          onRetry={catalog.retryFailed}
          retryLabel={catalog.retrying ? "Retrying…" : "Retry"}
        />
      ) : null;
    // A record the search could not read is a gap in the results, not "no match".
    const recordBanner =
      searching && records.failedCount > 0 && recordError ? (
        <ErrorState
          compact
          error={recordError}
          title={`${pluralize(records.failedCount, "essence's powers", "essences' powers")} could not be searched`}
          context="these essences"
          onRetry={records.retryFailed}
          retryLabel={records.retrying ? "Retrying…" : "Retry"}
        />
      ) : null;
    // While some records are unread, "nothing matches" only covers the rest.
    const among = searching && records.failedCount > 0 ? " among the essences that could be read" : "";

    let body: JSX.Element;
    if (visible.length === 0 && searchPending) {
      // "Concentrated Flame" names no essence: wait for the power names
      // before saying nothing matches.
      body = (
        <SectionCard
          title="Search results"
          description={`Reading every essence's powers to search for “${search}”…`}
        >
          <EssenceGridSkeleton count={4} label="Searching essences" />
        </SectionCard>
      );
    } else if (visible.length === 0) {
      body = searching ? (
        <EmptyState
          title="No essences match"
          description={
            filterWords.length > 0
              ? `Nothing named “${search}” for ${filterWords.join(" ")}${among}. Try another name, or clear the filters.`
              : among
                ? `No essence or power is named like “${search}”${among}. Try part of a name, or retry the others.`
                : `No essence or power is named like “${search}”. Try part of a name.`
          }
          action={
            <Button
              variant="outlined"
              onClick={filterWords.length > 0 ? clearEverything : clearSearchAndFocus}
            >
              {filterWords.length > 0 ? "Clear search and filters" : "Clear search"}
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<PsychologyRoundedIcon />}
          title="No essences for these filters"
          description={`No essence is open to ${filterWords.join(" ")}.`}
          action={
            <Button variant="outlined" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    } else if (searching) {
      body = (
        <SectionCard
          title="Search results"
          description={`Best matches first, by essence name or power name for “${search}”.`}
        >
          <EssenceGrid
            label="Matching essences"
            essences={visible}
            specs={catalog.specs}
            roleNames={roleNames}
            rolesPending={rolesPending}
            onSelect={openEssence}
          />
        </SectionCard>
      );
    } else if (rolesPending) {
      body = (
        <SectionCard
          title="Essences"
          description="Reading which roles and classes can use each essence… Highest essence ID first."
          actions={
            <Chip size="small" variant="outlined" label={pluralize(total, "essence", "essences")} />
          }
        >
          <EssenceGrid
            label="Essences"
            essences={newestFirst}
            specs={catalog.specs}
            roleNames={roleNames}
            rolesPending
            onSelect={openEssence}
          />
        </SectionCard>
      );
    } else {
      body = (
        <>
          {groups.map((group) => {
            const title = groupTitle(group, roleNames);
            return (
              <SectionCard
                key={group.key}
                title={title}
                description={groupDescription(group, roleNames)}
                actions={
                  <Chip
                    size="small"
                    variant="outlined"
                    label={pluralize(group.essences.length, "essence", "essences")}
                  />
                }
              >
                <EssenceGrid
                  label={title}
                  essences={group.essences}
                  specs={catalog.specs}
                  roleNames={roleNames}
                  onSelect={openEssence}
                />
              </SectionCard>
            );
          })}
        </>
      );
    }

    return (
      <Stack
        sx={(theme) => ({
          gap: {
            xs: theme.spacing(theme.wc.layout.sectionGap.xs),
            md: theme.spacing(theme.wc.layout.sectionGap.md),
          },
        })}
      >
        {specBanner}
        {recordBanner}
        {body}
      </Stack>
    );
  };

  // The open essence names the tab, so a shared dialog link reads as itself.
  const openName = essenceId !== null ? summaryById.get(essenceId)?.name : undefined;
  let documentTitle = "Azerite Essences";
  if (openName) {
    documentTitle = `${openName} · Azerite Essences`;
  } else if (searching) {
    documentTitle = "Search · Azerite Essences";
  }

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
        title="Azerite Essences"
        documentTitle={documentTitle}
        icon={<PsychologyRoundedIcon />}
        description="The Heart of Azeroth's essences from Battle for Azeroth: each essence's major and minor power at every rank, with spell tooltips, and the roles, classes and specializations that could slot it. Filter by role or class, or search essence and power names."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {total > 0 ? (
              <Chip size="small" label={pluralize(total, "essence", "essences")} />
            ) : null}
            {catalog.specIds.length > 0 ? (
              <Chip
                size="small"
                label={`${pluralize(catalog.specIds.length, "specialization", "specializations")} with essences`}
              />
            ) : null}
            {catalog.settled && classes.length > 0 ? (
              <Chip size="small" label={pluralize(classes.length, "class", "classes")} />
            ) : null}
          </>
        }
      />

      <EssenceFilters
        draft={draft}
        onDraftChange={setDraft}
        onSearch={handleSearch}
        onClearSearch={clearSearch}
        searchInputRef={searchInputRef}
        role={role}
        onRoleChange={changeRole}
        roleNames={roleNames}
        roleCounts={roleCounts}
        classId={classId}
        onClassChange={changeClass}
        classes={classOptions}
        filtersReady={catalog.settled}
        summary={summary || undefined}
        progress={progress}
      />

      {renderMain()}

      {/* Background, after the essences: the first screen is the roster. */}
      <HeartIntro />

      <EssenceDialog
        open={essenceId !== null}
        essenceId={shownEssenceId}
        summary={shownEssenceId !== null ? summaryById.get(shownEssenceId) : undefined}
        catalog={catalog.specs}
        rolesReady={catalog.settled}
        rolesFailed={listFailed && list.fetchStatus === "idle"}
        roleNames={roleNames}
        totalSpecs={catalog.specIds.length}
        onClose={closeEssence}
      />
    </Stack>
  );
};

export default AzeriteEssencePage;
