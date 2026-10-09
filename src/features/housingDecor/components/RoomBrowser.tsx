import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo } from "react";

import { ExplorerFilterBar } from "@/components/common/ExplorerFilterBar";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import HousingSearchField from "@/features/housingDecor/components/HousingSearchField";
import type { SearchBinding } from "@/features/housingDecor/components/HousingSearchField";
import RoomGrid, { RoomGroupsSkeleton } from "@/features/housingDecor/components/RoomGrid";
import { roomsQuery } from "@/features/housingDecor/hooks/housingQueries";
import useHeldFailure from "@/features/housingDecor/hooks/useHeldFailure";
import {
  groupRooms,
  pluralize,
} from "@/features/housingDecor/services/housingCatalog";
import type { Room } from "@/features/housingDecor/types";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, rankByName } from "@/lib/fuzzyMatch";

const EMPTY_ROOMS: Room[] = [];
/** US's 39 rooms by group (shapes, halls, plots, themed): what loading shows. */
const EXPECTED_GROUP_SIZES: readonly number[] = [12, 6, 1, 20];

export type RoomBrowserProps = {
  /** The URL's search, trimmed. */
  search: string;
  searchBinding: SearchBinding;
  onOpen: (room: Room) => void;
};

/**
 * Every room Blizzard lists, grouped by what its name says: shapes by
 * size, halls, closets, entries and stairs, plots, and themed rooms.
 * One request loads them all; room records hold nothing more.
 */
const RoomBrowser = ({ search, searchBinding, onOpen }: RoomBrowserProps): JSX.Element => {
  const query = useQuery(roomsQuery());
  const failure = useHeldFailure(query);
  const rooms = query.data ?? EMPTY_ROOMS;
  const loaded = query.data !== undefined;
  const headingId = useId();

  const searching = search !== "";
  const numeric = /^#?\d+$/.test(search);
  const tooShort = searching && !numeric && search.length < MIN_FUZZY_QUERY_LENGTH;
  const matches = useMemo(() => {
    if (!searching || tooShort) {
      return EMPTY_ROOMS;
    }
    const id = search.replace(/^#/, "");
    const byId = numeric ? rooms.filter((room) => String(room.id) === id) : [];
    const byName = rankByName(rooms, search, (room) => room.name, rooms.length);
    return [...byId, ...byName.filter((room) => !byId.includes(room))];
  }, [rooms, search, searching, tooShort, numeric]);
  const groups = useMemo(() => groupRooms(rooms), [rooms]);

  const summary = ((): string => {
    if (!loaded) {
      return failure.failed ? "Couldn't load rooms" : "Loading rooms…";
    }
    if (tooShort) {
      return "Type at least two letters";
    }
    if (searching) {
      return matches.length === 0
        ? "No matching rooms"
        : `${pluralize(matches.length, "room matches", "rooms match")}`;
    }
    return `${pluralize(rooms.length, "room", "rooms")} in ${pluralize(groups.length, "group", "groups")}`;
  })();

  const renderBody = (): JSX.Element => {
    if (failure.failed) {
      return (
        <ErrorState
          error={failure.error}
          context="rooms"
          onRetry={failure.retry}
          retryLabel={failure.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (!loaded) {
      return <RoomGroupsSkeleton sections={EXPECTED_GROUP_SIZES} />;
    }
    if (rooms.length === 0) {
      return (
        <EmptyState
          icon={<MeetingRoomRoundedIcon />}
          title="No rooms listed"
          description="Blizzard's room search returned nothing for this region."
        />
      );
    }
    if (searching && (tooShort || matches.length === 0)) {
      return (
        <EmptyState
          compact
          icon={<SearchOffRoundedIcon />}
          title={tooShort ? "Type at least two letters" : `No rooms match “${search}”`}
          description={
            tooShort
              ? "One letter matches nearly every room; add another to narrow it down."
              : "Try another word, or clear the search to see every room."
          }
          action={
            <Button variant="outlined" size="small" onClick={searchBinding.onClear}>
              Clear search
            </Button>
          }
        />
      );
    }
    if (searching) {
      return <RoomGrid rooms={matches} label={`Rooms matching ${search}`} onSelect={onOpen} />;
    }
    return (
      <Stack spacing={3}>
        {groups.map((group) => {
          const groupHeadingId = `${headingId}-${group.key}`;
          return (
            <Box component="section" key={group.key} aria-labelledby={groupHeadingId}>
              <Stack spacing={0.25} sx={{ mb: 1.25 }}>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography id={groupHeadingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
                    {group.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    {pluralize(group.rooms.length, "room", "rooms")}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
                  {group.description}
                </Typography>
              </Stack>
              <RoomGrid rooms={group.rooms} label={group.title} onSelect={onOpen} />
            </Box>
          );
        })}
      </Stack>
    );
  };

  return (
    <Stack spacing={2.5}>
      <ExplorerFilterBar label="Room search" summary={summary}>
        <HousingSearchField
          binding={searchBinding}
          label="Search rooms by name or id"
          placeholder={rooms.length > 0 ? `Search ${formatNumber(rooms.length)} rooms` : "Search rooms"}
          disabled={failure.failed}
        />
      </ExplorerFilterBar>

      <SectionCard
        title={searching ? `Rooms matching “${search}”` : "Rooms"}
        description="The rooms a house's interior is built from. Blizzard's room records hold only an id and a name, so shapes and sizes are read from the English names, and the floor plans are this page's drawings of them (sizes relative, not to scale)."
      >
        {renderBody()}
      </SectionCard>
    </Stack>
  );
};

export default RoomBrowser;
