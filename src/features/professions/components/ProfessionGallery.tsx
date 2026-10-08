import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import { useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import ProfessionTile from "@/features/professions/components/ProfessionTile";
import type {
  Profession,
  ProfessionGroupKey,
} from "@/features/professions/types";
import { formatNumber } from "@/lib/format";

export type ProfessionGroups = Record<ProfessionGroupKey, Profession[]>;

export type ProfessionGalleryProps = {
  groups: ProfessionGroups;
  selectedId: number | null;
  /** Whether the internal lines are expanded (the page opens it for a selected one). */
  otherOpen: boolean;
  onOtherOpenChange: (open: boolean) => void;
  onSelect: (professionId: number) => void;
};

/*
 * One column grid for the whole gallery: crafting spans it (eight across on
 * large screens, a single row), gathering and secondary share it half and
 * half. The same 12px gap inside and between the halves keeps every tile on
 * the same column lines at every width.
 */
export const CRAFTING_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 8 };
const HALF_COLS: GridColumns = { xs: 2, sm: 3, md: 2, lg: 4 };
const OTHER_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
export const GALLERY_GAP = 1.5;

type GroupProps = {
  title: string;
  description: string;
  professions: Profession[];
  columns: GridColumns;
  selectedId: number | null;
  muted?: boolean;
  onSelect: (professionId: number) => void;
};

const TileGrid = ({
  labelledBy,
  professions,
  columns,
  selectedId,
  muted = false,
  onSelect,
}: Omit<GroupProps, "title" | "description"> & { labelledBy: string }): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-labelledby={labelledBy}
    sx={{
      display: "grid",
      gap: GALLERY_GAP,
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(columns),
    }}
  >
    {professions.map((profession) => (
      <Box component="li" key={profession.id} sx={{ minWidth: 0 }}>
        <ProfessionTile
          profession={profession}
          selected={profession.id === selectedId}
          muted={muted}
          onSelect={onSelect}
        />
      </Box>
    ))}
  </Box>
);

const Group = ({ title, description, ...grid }: GroupProps): JSX.Element => {
  const headingId = useId();
  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
        <Typography id={headingId} variant="overline" component="h3" sx={{ m: 0, lineHeight: 1.6 }}>
          {title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}
        >
          {description}
        </Typography>
      </Stack>
      <TileGrid labelledBy={headingId} {...grid} />
    </Stack>
  );
};

/**
 * Every profession as an icon tile, grouped the way the game's spellbook
 * does: crafting and gathering primaries, then the secondary professions.
 * The twelve internal crafting lines Blizzard also lists sit collapsed at
 * the end; their tiles (and icons) only mount when the section is opened.
 */
const ProfessionGallery = ({
  groups,
  selectedId,
  otherOpen,
  onOtherOpenChange,
  onSelect,
}: ProfessionGalleryProps): JSX.Element => {
  const otherId = useId();
  const otherCount = groups.other.length;

  return (
    <Stack spacing={3}>
      {groups.crafting.length > 0 ? (
        <Group
          title="Crafting"
          description="Primary professions that make gear and consumables"
          professions={groups.crafting}
          columns={CRAFTING_COLS}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}

      {groups.gathering.length > 0 || groups.secondary.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            columnGap: GALLERY_GAP,
            rowGap: 3,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          {groups.gathering.length > 0 ? (
            <Group
              title="Gathering"
              description="Primary professions that harvest materials"
              professions={groups.gathering}
              columns={HALF_COLS}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ) : null}
          {groups.secondary.length > 0 ? (
            <Group
              title="Secondary"
              description="Any character can learn all of these"
              professions={groups.secondary}
              columns={HALF_COLS}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ) : null}
        </Box>
      ) : null}

      {otherCount > 0 ? (
        <Accordion
          expanded={otherOpen}
          onChange={(_event, expanded) => onOtherOpenChange(expanded)}
          disableGutters
          slotProps={{ transition: { unmountOnExit: true } }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            id={`${otherId}-summary`}
            aria-controls={`${otherId}-details`}
            sx={{ px: 2 }}
          >
            <Stack spacing={0.25} sx={{ minWidth: 0, py: 0.5 }}>
              <Typography id={`${otherId}-title`} variant="subtitle1" component="span">
                {`Other professions (${formatNumber(otherCount)})`}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="span">
                Internal and event crafting lines Blizzard also lists as
                professions; none has skill tiers or recipes in the API
              </Typography>
            </Stack>
          </AccordionSummary>
          {/* The Accordion gives its region the summary's aria-controls as id. */}
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <TileGrid
              labelledBy={`${otherId}-title`}
              professions={groups.other}
              columns={OTHER_COLS}
              selectedId={selectedId}
              muted
              onSelect={onSelect}
            />
          </AccordionDetails>
        </Accordion>
      ) : null}
    </Stack>
  );
};

export default ProfessionGallery;
