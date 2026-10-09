import CheckroomRoundedIcon from "@mui/icons-material/CheckroomRounded";
import { Chip, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SegmentedControl } from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import AppearanceBrowser from "@/features/itemAppearances/components/AppearanceBrowser";
import AppearanceDialog from "@/features/itemAppearances/components/AppearanceDialog";
import AppearanceGuide from "@/features/itemAppearances/components/AppearanceGuide";
import { parseId } from "@/features/itemAppearances/components/appearanceLayout";
import SetBrowser from "@/features/itemAppearances/components/SetBrowser";
import SetDialog from "@/features/itemAppearances/components/SetDialog";
import {
  URL_DEFAULTS,
  parseMode,
} from "@/features/itemAppearances/components/urlState";
import type { AppearanceParams, BrowseMode } from "@/features/itemAppearances/components/urlState";
import {
  appearanceQuery,
  setIndexQuery,
  slotIndexQuery,
} from "@/features/itemAppearances/hooks/appearanceQueries";
import useSlotNames from "@/features/itemAppearances/hooks/useSlotNames";
import { groupSets, pluralize } from "@/features/itemAppearances/services/appearanceService";
import type { SetGroup } from "@/features/itemAppearances/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const MODE_OPTIONS: ReadonlyArray<SegmentedOption<BrowseMode>> = [
  { value: "sets", label: "Sets" },
  { value: "appearances", label: "Appearances" },
];

/** Each view's own parameters, dropped when the other view is on screen. */
const SET_VIEW_PARAMS = ["q", "type"] as const;
const APPEARANCE_VIEW_PARAMS = ["slot", "sort"] as const;

const EMPTY_GROUPS: SetGroup[] = [];

/**
 * Item Appearances: Blizzard's transmog data as two views. Sets (the
 * landing) lists every set name, newest first, searchable on this device
 * and, in English, narrowed by words in the name; a set opens with each of
 * its pieces, and a switch between the sets that share its name. Appearances
 * pages through Blizzard's appearance search by slot, newest or oldest
 * first, and any look opens by its id. A look opens with every item that
 * wears it. Blizzard serves no renders of either, so each look is drawn
 * with its first item's icon. View, search, filters, page and the open set
 * and appearance all live in the URL.
 *
 * The set index is one request; cards load their records (and icons) as
 * they near the viewport, a few at a time (see appearanceQueries).
 */
const ItemAppearancesPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();
  const mode = parseMode(params.mode);

  /* ---------------- Mode (unknown -> Sets; the other view's params go) ---------------- */

  useEffect(() => {
    const patch: Partial<Record<keyof AppearanceParams, null>> = {};
    if (params.mode !== "" && params.mode !== "appearances") {
      patch.mode = null;
    }
    const stale = mode === "sets" ? APPEARANCE_VIEW_PARAMS : SET_VIEW_PARAMS;
    stale.forEach((key) => {
      if (params[key] !== "") {
        patch[key] = null;
      }
    });
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [mode, params, setParams]);

  const changeMode = useCallback(
    (next: BrowseMode): void => {
      setParams({
        mode: next === "sets" ? null : next,
        q: null,
        type: null,
        slot: null,
        sort: null,
        page: null,
      });
    },
    [setParams],
  );

  /* ---------------- Reference data ---------------- */

  const setId = parseId(params.set);
  const appearanceId = parseId(params.appearance);

  // The set index (3,310 names in one request) feeds the Sets view and the
  // set dialog's versions; the Appearances view needs it only for an open set.
  const indexQuery = useQuery({
    ...setIndexQuery(),
    enabled: mode === "sets" || setId !== null,
  });
  const slotsQuery = useQuery(slotIndexQuery());
  const slotNames = useSlotNames();
  const index = indexQuery.data;
  const groups = useMemo(() => (index ? groupSets(index) : EMPTY_GROUPS), [index]);
  const groupBySetId = useMemo(() => {
    const map = new Map<number, SetGroup>();
    groups.forEach((group) => group.ids.forEach((id) => map.set(id, group)));
    return map;
  }, [groups]);

  /* ---------------- Set dialog ---------------- */

  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownSetId, setShownSetId] = useState<number | null>(setId);
  if (setId !== null && setId !== shownSetId) {
    setShownSetId(setId);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedSetHereRef = useRef(false);

  const openSet = useCallback(
    (group: SetGroup): void => {
      openedSetHereRef.current = true;
      // The version the grid sorted the name by (and the card shows).
      setParams({ set: String(group.newestId) });
    },
    [setParams],
  );
  // Switching versions replaces the dialog's history entry, so one Back (or
  // closing) always leaves the dialog, however many versions it looked at.
  const selectVersion = useCallback(
    (next: number): void => {
      setParams({ set: String(next) }, { replace: true });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the set.
  const closeSet = useCallback((): void => {
    if (openedSetHereRef.current) {
      openedSetHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ set: null }, { replace: true });
  }, [navigate, setParams]);

  /* ---------------- Appearance dialog (over the set, when opened from one) ---------------- */

  const [shownAppearanceId, setShownAppearanceId] = useState<number | null>(appearanceId);
  if (appearanceId !== null && appearanceId !== shownAppearanceId) {
    setShownAppearanceId(appearanceId);
  }
  const openedAppearanceHereRef = useRef(false);

  const openAppearance = useCallback(
    (id: number): void => {
      openedAppearanceHereRef.current = true;
      setParams({ appearance: String(id) });
    },
    [setParams],
  );
  const closeAppearance = useCallback((): void => {
    if (openedAppearanceHereRef.current) {
      openedAppearanceHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ appearance: null }, { replace: true });
  }, [navigate, setParams]);

  // Back (or a link) closed a dialog: the next close must not step back again.
  // A malformed id is dropped, so the address only names what is open.
  useEffect(() => {
    if (setId === null) {
      openedSetHereRef.current = false;
    }
    if (appearanceId === null) {
      openedAppearanceHereRef.current = false;
    }
    const patch: { set?: null; appearance?: null } = {};
    if (params.set !== "" && setId === null) {
      patch.set = null;
    }
    if (params.appearance !== "" && appearanceId === null) {
      patch.appearance = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [setId, appearanceId, params.set, params.appearance, setParams]);

  /* ---------------- Labels ---------------- */

  // Same cache entry as the dialog: names the tab without a request of its own.
  const openAppearanceQuery = useQuery({
    ...appearanceQuery(appearanceId ?? 0, "dialog"),
    enabled: appearanceId !== null,
  });
  const shownGroup = shownSetId !== null ? groupBySetId.get(shownSetId) : undefined;
  const openSetName = setId !== null ? groupBySetId.get(setId)?.name : undefined;
  const openLookName =
    appearanceId !== null ? openAppearanceQuery.data?.items[0]?.name : undefined;
  let documentTitle = "Item Appearances";
  if (openLookName) {
    documentTitle = `${openLookName} · Item Appearances`;
  } else if (openSetName) {
    documentTitle = `${openSetName} · Item Appearances`;
  } else if (mode === "appearances") {
    documentTitle = "Appearances · Item Appearances";
  }

  const slotCount = slotsQuery.data?.length ?? 0;

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
        title="Item Appearances"
        documentTitle={documentTitle}
        icon={<CheckroomRoundedIcon />}
        description="Blizzard's transmog data: every appearance set with its pieces, and item appearances by slot (up to the newest or oldest thousand of each, any one by its id) with all the items that share the look. Blizzard's API serves no model renders, so each look is shown by its first item's icon."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {index && index.length > 0 ? (
              <Chip
                size="small"
                label={pluralize(index.length, "appearance set", "appearance sets")}
              />
            ) : null}
            {groups.length > 0 && groups.length !== index?.length ? (
              <Chip
                size="small"
                variant="outlined"
                label={pluralize(groups.length, "set name", "set names")}
              />
            ) : null}
            {slotCount > 0 ? (
              <Chip size="small" label={pluralize(slotCount, "slot", "slots")} />
            ) : null}
          </>
        }
        actions={
          <SegmentedControl
            size="small"
            label="Browse item appearances by"
            options={MODE_OPTIONS}
            value={mode}
            onChange={changeMode}
            sx={{
              // Full width on phones, so both labels have room.
              width: { xs: "100%", md: "auto" },
              minHeight: 40,
              "& .MuiToggleButton-root": { flex: { xs: 1, md: "0 0 auto" }, px: 2 },
            }}
          />
        }
      />

      {mode === "sets" ? (
        <SetBrowser
          indexQuery={indexQuery}
          groups={groups}
          params={params}
          setParams={setParams}
          onOpenSet={openSet}
        />
      ) : (
        <AppearanceBrowser
          params={params}
          setParams={setParams}
          slotIndexQuery={slotsQuery}
          slotNames={slotNames}
          onOpenAppearance={openAppearance}
        />
      )}

      <AppearanceGuide />

      <SetDialog
        open={setId !== null}
        setId={shownSetId}
        group={shownGroup}
        fallbackName={shownGroup?.name}
        onSelectVersion={selectVersion}
        onOpenAppearance={openAppearance}
        onClose={closeSet}
      />
      {/* After the set dialog, so a piece opened from a set stacks over it. */}
      <AppearanceDialog
        open={appearanceId !== null}
        appearanceId={shownAppearanceId}
        onClose={closeAppearance}
      />
    </Stack>
  );
};

export default ItemAppearancesPage;
