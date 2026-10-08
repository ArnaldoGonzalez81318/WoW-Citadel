import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import {
  Avatar,
  Box,
  FormControl,
  InputLabel,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId, useMemo } from "react";
import type { ReactElement } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import useBoardSpec from "@/features/pvpSeasons/hooks/useBoardSpec";
import {
  bracketGroupsOf,
  groupKeyOf,
} from "@/features/pvpSeasons/services/pvpBrackets";
import type { PvpBoardRef, PvpBracketGroup } from "@/features/pvpSeasons/types";
import { mixins } from "@/theme";

export type BracketPickerProps = {
  /** The season's boards. */
  boards: readonly PvpBoardRef[];
  /** The board on screen. */
  value: PvpBoardRef;
  /** A bracket tile was pressed (the page picks the board within it). */
  onGroupChange: (groupKey: string) => void;
  /** A board was picked in the specialization select. */
  onBoardChange: (slug: string) => void;
};

const GROUP_ICONS: Record<PvpBracketGroup, ReactElement> = {
  "2v2": <PeopleAltRoundedIcon />,
  "3v3": <GroupsRoundedIcon />,
  rbg: <FlagRoundedIcon />,
  shuffle: <ShuffleRoundedIcon />,
  blitz: <BoltRoundedIcon />,
  other: <LeaderboardRoundedIcon />,
};

/** The bracket's glyph in a small tinted square (decorative: the label names it). */
const GroupGlyph = ({ group }: { group: PvpBracketGroup }): JSX.Element => (
  <Box
    aria-hidden="true"
    className="bracket-glyph"
    sx={(theme) => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      width: 36,
      height: 36,
      borderRadius: `${theme.wc.radius.md}px`,
      bgcolor: theme.palette.surface.inset,
      border: `1px solid ${theme.palette.border.subtle}`,
      color: "text.secondary",
      transition: theme.transitions.create(["color", "background-color"], {
        duration: theme.wc.motion.fast,
      }),
      "& svg": { fontSize: 20 },
    })}
  >
    {GROUP_ICONS[group]}
  </Box>
);

/** One option of the specialization select: its icon, spec and class. */
const SpecOption = ({ board }: { board: PvpBoardRef }): JSX.Element => {
  const spec = useBoardSpec(board);
  return (
    <>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <Avatar
          alt=""
          src={spec?.iconUrl ?? undefined}
          variant="rounded"
          sx={{ width: 28, height: 28, fontSize: "0.875rem" }}
        >
          {spec ? spec.spec.charAt(0) : GROUP_ICONS[board.group]}
        </Avatar>
      </ListItemIcon>
      <ListItemText
        primary={spec ? spec.spec : "All specializations"}
        secondary={spec ? spec.className : "Overall ladder"}
        slotProps={{ secondary: { variant: "caption" } }}
        sx={{ my: 0 }}
      />
    </>
  );
};

/** The select's closed value: the chosen spec's icon and name. */
const SpecValue = ({ board }: { board: PvpBoardRef }): JSX.Element => {
  const spec = useBoardSpec(board);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar
        alt=""
        src={spec?.iconUrl ?? undefined}
        variant="rounded"
        sx={{ width: 22, height: 22, fontSize: "0.75rem", "& svg": { fontSize: 16 } }}
      >
        {spec ? spec.spec.charAt(0) : GROUP_ICONS[board.group]}
      </Avatar>
      <Box component="span" sx={{ ...mixins.truncate, minWidth: 0 }}>
        {spec ? spec.label : "All specializations"}
      </Box>
    </Stack>
  );
};

/**
 * Brackets as tiles (a toggle-button group: one Tab stop each, aria-pressed,
 * Space or Enter picks it), then, for Solo Shuffle and Blitz, a select of
 * their per-spec boards. The select's options load their spec icons only
 * while it is open (about 40 specs, each cached for the session).
 */
const BracketPicker = ({
  boards,
  value,
  onGroupChange,
  onBoardChange,
}: BracketPickerProps): JSX.Element => {
  const idBase = useId();
  const specLabelId = `pvp-spec-${idBase}`;
  const groups = useMemo(() => bracketGroupsOf(boards), [boards]);
  const selectedGroup = groupKeyOf(value);
  const groupBoards = useMemo(
    () => boards.filter((board) => groupKeyOf(board) === selectedGroup),
    [boards, selectedGroup],
  );
  // Overall first, then class-then-spec by slug (the service sorts them:
  // the earlier Dragonflight seasons list their spec boards in no order).
  const specBoards = useMemo(
    () => [
      ...groupBoards.filter((board) => board.specSlug === undefined),
      ...groupBoards.filter((board) => board.specSlug !== undefined),
    ],
    [groupBoards],
  );
  const showSpecs = specBoards.some((board) => board.specSlug !== undefined);

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        value={selectedGroup}
        onChange={(_event, next: string | null) => {
          // Pressing the selected tile again would clear it; a ladder always has a bracket.
          if (next !== null && next !== selectedGroup) {
            onGroupChange(next);
          }
        }}
        aria-label="Bracket"
        sx={(theme) => ({
          display: "grid",
          gap: 1,
          ...gridTemplateColumnsSx({ xs: 2, sm: 3, md: Math.max(1, Math.min(groups.length, 5)) }),
          "& .MuiToggleButtonGroup-grouped": {
            // Undo the group's joined-edge styling: these are separate tiles.
            margin: 0,
            border: `1px solid ${theme.palette.border.subtle}`,
            borderRadius: `${theme.wc.radius.md}px !important`,
          },
        })}
      >
        {groups.map((group) => {
          const captionId = `${idBase}-${group.key}-caption`;
          return (
            <ToggleButton
              key={group.key}
              value={group.key}
              aria-label={group.label}
              aria-describedby={captionId}
              sx={(theme) => ({
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "flex-start",
                gap: 1.25,
                p: 1.5,
                minWidth: 0,
                textAlign: "left",
                textTransform: "none",
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "text.primary",
                  borderColor: `${theme.palette.primary.main} !important`,
                  boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
                "&.Mui-selected .bracket-glyph": {
                  color: theme.palette.primary.light,
                  bgcolor: alpha(theme.palette.primary.main, 0.16),
                },
              })}
            >
              <GroupGlyph group={group.group} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  component="span"
                  sx={{ display: "block", lineHeight: 1.3, overflowWrap: "anywhere" }}
                >
                  {group.label}
                </Typography>
                <Typography
                  id={captionId}
                  variant="caption"
                  component="span"
                  color="text.secondary"
                  sx={{ display: "block", lineHeight: 1.3 }}
                >
                  {group.caption}
                </Typography>
              </Box>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>

      {showSpecs ? (
        <FormControl size="small" sx={{ width: { xs: "100%", sm: 320 }, minWidth: 0 }}>
          <InputLabel id={specLabelId}>Specialization</InputLabel>
          <Select
            labelId={specLabelId}
            label="Specialization"
            value={specBoards.some((board) => board.slug === value.slug) ? value.slug : ""}
            renderValue={() => <SpecValue board={value} />}
            onChange={(event) => {
              const next = String(event.target.value);
              if (next && next !== value.slug) {
                onBoardChange(next);
              }
            }}
            MenuProps={{ slotProps: { paper: { sx: { maxHeight: 440 } } } }}
            sx={{ "& .MuiSelect-select": { display: "flex", alignItems: "center", minWidth: 0 } }}
          >
            {specBoards.map((board) => (
              <MenuItem key={board.slug} value={board.slug}>
                <SpecOption board={board} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
    </Stack>
  );
};

export default BracketPicker;
