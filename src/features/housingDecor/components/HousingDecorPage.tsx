import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import HouseSidingRoundedIcon from "@mui/icons-material/HouseSidingRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import { Box, Chip, Stack, Tab, Tabs } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import PageHeader from "@/components/common/PageHeader";
import DecorBrowser from "@/features/housingDecor/components/DecorBrowser";
import DecorDialog from "@/features/housingDecor/components/DecorDialog";
import FixtureBrowser from "@/features/housingDecor/components/FixtureBrowser";
import FixtureDialog from "@/features/housingDecor/components/FixtureDialog";
import { searchQualifies } from "@/features/housingDecor/components/HousingSearchField";
import type { SearchBinding } from "@/features/housingDecor/components/HousingSearchField";
import RoomBrowser from "@/features/housingDecor/components/RoomBrowser";
import RoomDialog from "@/features/housingDecor/components/RoomDialog";
import {
  decorIndexQuery,
  fixturesQuery,
  roomsQuery,
} from "@/features/housingDecor/hooks/housingQueries";
import useDialogParam, { parseId } from "@/features/housingDecor/hooks/useDialogParam";
import {
  isFixtureKind,
  pluralize,
} from "@/features/housingDecor/services/housingCatalog";
import type {
  DecorEntry,
  DecorSort,
  FixtureFamily,
  HousingParams,
  HousingTab,
  Room,
} from "@/features/housingDecor/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import type { SearchParamsPatch } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS: HousingParams = {
  tab: "",
  q: "",
  page: "",
  sort: "",
  kind: "",
  decor: "",
  fixture: "",
  room: "",
};

const TABS: ReadonlyArray<{ value: HousingTab; label: string; icon: ReactElement }> = [
  { value: "decor", label: "Decor", icon: <ChairRoundedIcon /> },
  { value: "fixtures", label: "Fixtures", icon: <HouseSidingRoundedIcon /> },
  { value: "rooms", label: "Rooms", icon: <MeetingRoomRoundedIcon /> },
];

const TAB_TITLE: Readonly<Record<HousingTab, string>> = {
  decor: "Housing Decor",
  fixtures: "Fixtures · Housing Decor",
  rooms: "Rooms · Housing Decor",
};

const parseTab = (value: string): HousingTab =>
  value === "fixtures" || value === "rooms" ? value : "decor";

/**
 * Housing Decor: player housing's catalogue from Blizzard's game data, in
 * three tabs. Decor (the landing) is every decor piece as an icon card,
 * newest first, A to Z or by a forgiving name search, 24 to a page, each
 * opening its item's tooltip, dye slots and collection count. Fixtures are
 * the parts of a house's exterior, grouped into families by name and filed
 * by kind, each family opening its members' hook points. Rooms are the
 * interior's pieces, grouped by the shape and size their names give and
 * drawn as plans. Tab, search, order, kind, page and any open dialog live
 * in the URL, so every view can be shared.
 *
 * The landing costs the decor index, two searches for the page's items and
 * an icon per card as it nears the viewport; fixtures and rooms load (one
 * request each) when their tab is first opened.
 */
const HousingDecorPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const baseId = useId();

  /* ---------------- URL state (unknown values fall back) ---------------- */

  const tab = parseTab(params.tab);
  const sort: DecorSort = params.sort === "name" ? "name" : "newest";
  const kind = isFixtureKind(params.kind) ? params.kind : null;
  const requestedPage = parseId(params.page);
  const search = params.q.trim();

  // Drop what the page cannot use (a typo, an old link, a page on a tab
  // without pages) so the address always describes what is on screen.
  useEffect(() => {
    const patch: SearchParamsPatch<HousingParams> = {};
    if (params.tab !== "" && (params.tab !== tab || tab === "decor")) {
      patch.tab = null;
    }
    if (params.sort !== "" && params.sort !== "name") {
      patch.sort = null;
    }
    if (params.kind !== "" && kind === null) {
      patch.kind = null;
    }
    if (params.page !== "" && (requestedPage === null || tab !== "decor")) {
      patch.page = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [params.tab, params.sort, params.kind, params.page, tab, kind, requestedPage, setParams]);

  /* ---------------- Search (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(params.q);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const emittedRef = useRef(params.q);
  useEffect(() => {
    // The URL changed on its own (back button, a shared link): adopt it.
    if (params.q !== emittedRef.current) {
      emittedRef.current = params.q;
      setDraft(params.q);
    }
  }, [params.q]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      // Already in the URL (a trailing space, or a dialog's push took it along).
      if (next === emittedRef.current) {
        return;
      }
      emittedRef.current = next;
      setParams({ q: next || null, page: null }, { replace: true });
    },
    [setParams],
  );
  /*
   * A search still waiting on its debounce, as a patch for the history entry
   * a dialog is about to push. Left to the field's timer it would land in
   * the dialog's entry instead, and closing (Back) would wipe it.
   */
  const pendingSearch = useCallback((): SearchParamsPatch<HousingParams> => {
    const next = draftRef.current.trim();
    if (next === emittedRef.current || !searchQualifies(next)) {
      return {};
    }
    emittedRef.current = next;
    return { q: next || null, page: null };
  }, []);
  // Every Clear button disappears with what it cleared; focus moves to the
  // search field rather than falling back to the top of the document.
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
    searchInputRef.current?.focus();
  }, [setParams]);
  const searchBinding = useMemo<SearchBinding>(
    () => ({
      draft,
      onDraftChange: setDraft,
      onSearch: handleSearch,
      onClear: clearSearch,
      inputRef: searchInputRef,
      focus: () => searchInputRef.current?.focus(),
    }),
    [draft, handleSearch, clearSearch],
  );

  /*
   * Decor, fixtures and rooms share almost no words, so a search does not
   * follow the visitor to another tab (it would open on "No matches"); Back
   * brings it back with its tab. Clearing the draft too means a keystroke
   * still waiting on its debounce, which the old tab's field takes with it
   * when it unmounts, cannot linger in the new field unapplied.
   */
  const handleTabChange = useCallback(
    (next: HousingTab): void => {
      if (next === tab) {
        return;
      }
      emittedRef.current = "";
      setDraft("");
      setParams({ tab: next === "decor" ? null : next, page: null, q: null });
    },
    [tab, setParams],
  );

  /* ---------------- Dialogs ---------------- */

  const decorDialog = useDialogParam("decor", params.decor, setParams);
  const fixtureDialog = useDialogParam("fixture", params.fixture, setParams);
  const roomDialog = useDialogParam("room", params.room, setParams);
  // Stable handlers, so the memoized cards do not re-render with every URL change.
  const { open: openDecorId } = decorDialog;
  const { open: openFixtureId } = fixtureDialog;
  const { open: openRoomId } = roomDialog;
  const openDecor = useCallback(
    (entry: DecorEntry): void => openDecorId(entry.id, pendingSearch()),
    [openDecorId, pendingSearch],
  );
  // A family opens on the fixture its id search found, else its first
  // member; the dialog steps through the rest.
  const openFamily = useCallback(
    (family: FixtureFamily): void => {
      const wanted = parseId(search.replace(/^#/, ""));
      const member = family.members.find((entry) => entry.id === wanted) ?? family.members[0];
      if (member) {
        openFixtureId(member.id, pendingSearch());
      }
    },
    [openFixtureId, pendingSearch, search],
  );
  const openRoom = useCallback(
    (room: Room): void => openRoomId(room.id, pendingSearch()),
    [openRoomId, pendingSearch],
  );

  /* ---------------- Names and counts for the header and the tab title ---------------- */

  // The decor index is the landing's own data; on the other tabs it only
  // loads for a decor dialog's name.
  const decorIndex = useQuery({
    ...decorIndexQuery(),
    enabled: tab === "decor" || decorDialog.shownId !== null,
  });
  // These only read what the tabs and dialogs have loaded.
  const fixtures = useQuery({ ...fixturesQuery(), enabled: false }).data;
  const rooms = useQuery({ ...roomsQuery(), enabled: false }).data;

  const decorName =
    decorDialog.shownId !== null
      ? decorIndex.data?.find((entry) => entry.id === decorDialog.shownId)?.name
      : undefined;
  let documentTitle = TAB_TITLE[tab];
  if (decorDialog.id !== null) {
    documentTitle = `${decorName ?? `Decor #${decorDialog.id}`} · Housing Decor`;
  } else if (fixtureDialog.id !== null) {
    const fixture = fixtures?.find((entry) => entry.id === fixtureDialog.id);
    documentTitle = `${fixture?.name || `Fixture #${fixtureDialog.id}`} · Housing Decor`;
  } else if (roomDialog.id !== null) {
    const room = rooms?.find((entry) => entry.id === roomDialog.id);
    documentTitle = `${room?.name ?? `Room #${roomDialog.id}`} · Housing Decor`;
  }

  /* ---------------- Render ---------------- */

  const renderPanel = (): JSX.Element => {
    if (tab === "fixtures") {
      return (
        <FixtureBrowser
          search={search}
          kind={kind}
          setParams={setParams}
          searchBinding={searchBinding}
          onOpen={openFamily}
        />
      );
    }
    if (tab === "rooms") {
      return <RoomBrowser search={search} searchBinding={searchBinding} onOpen={openRoom} />;
    }
    return (
      <DecorBrowser
        search={search}
        sort={sort}
        page={requestedPage ?? 1}
        pageParam={params.page}
        setParams={setParams}
        searchBinding={searchBinding}
        onOpen={openDecor}
      />
    );
  };

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
        title="Housing Decor"
        documentTitle={documentTitle}
        icon={<ChairRoundedIcon />}
        description="Player housing in Blizzard's game data: every decor piece with its item's icon, quality and dye slots, the fixtures that make up a house's exterior, and the rooms its interior is built from. Blizzard's API has no decor renders, so each decor shows the icon of the item that adds it to the House Chest."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {decorIndex.data && decorIndex.data.length > 0 ? (
              <Chip size="small" label={pluralize(decorIndex.data.length, "decor", "decor")} />
            ) : null}
            {fixtures && fixtures.length > 0 ? (
              <Chip size="small" label={pluralize(fixtures.length, "fixture", "fixtures")} />
            ) : null}
            {rooms && rooms.length > 0 ? (
              <Chip size="small" label={pluralize(rooms.length, "room", "rooms")} />
            ) : null}
          </>
        }
      />

      <Box sx={{ minWidth: 0 }}>
        <Tabs
          value={tab}
          onChange={(_event, next: HousingTab) => handleTabChange(next)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Housing catalogue"
          sx={(theme) => ({
            mb: 2.5,
            minHeight: 48,
            borderBottom: `1px solid ${theme.palette.border.subtle}`,
          })}
        >
          {TABS.map((entry) => (
            <Tab
              key={entry.value}
              value={entry.value}
              label={entry.label}
              icon={entry.icon}
              iconPosition="start"
              id={`${baseId}-tab-${entry.value}`}
              aria-controls={`${baseId}-panel-${entry.value}`}
              // Three tabs fit a 320px screen without scrolling.
              sx={{ minHeight: 48, minWidth: 0, px: { xs: 1.25, sm: 2 } }}
            />
          ))}
        </Tabs>
        {TABS.map((entry) => (
          // Only the open tab's panel is filled, so a tab's data loads when
          // it is first opened rather than all at once on the landing.
          <Box
            key={entry.value}
            role="tabpanel"
            id={`${baseId}-panel-${entry.value}`}
            aria-labelledby={`${baseId}-tab-${entry.value}`}
            hidden={tab !== entry.value}
          >
            {tab === entry.value ? renderPanel() : null}
          </Box>
        ))}
      </Box>

      <DecorDialog
        open={decorDialog.id !== null}
        decorId={decorDialog.shownId}
        fallbackName={decorName}
        onClose={decorDialog.close}
      />
      <FixtureDialog
        open={fixtureDialog.id !== null}
        fixtureId={fixtureDialog.shownId}
        onSelect={fixtureDialog.replace}
        onClose={fixtureDialog.close}
      />
      <RoomDialog
        open={roomDialog.id !== null}
        roomId={roomDialog.shownId}
        onSelect={roomDialog.replace}
        onClose={roomDialog.close}
      />
    </Stack>
  );
};

export default HousingDecorPage;
