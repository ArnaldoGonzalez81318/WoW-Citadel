import { Box, ToggleButton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import { FamilyIcon, familyColor } from "@/features/battlePets/components/FamilyBadge";
import { PET_FAMILIES } from "@/features/battlePets/config/petFamilies";
import type { PetFamily } from "@/features/battlePets/config/petFamilies";
import { pluralize } from "@/features/battlePets/services/battlePetService";

export type FamilyPickerProps = {
  /** Family id -> localized name. */
  names: ReadonlyMap<number, string>;
  /** The pressed family, or null. */
  value: number | null;
  onChange: (familyId: number) => void;
  /** Family id -> how many it lists, once every record's family is known. */
  counts: ReadonlyMap<number, number> | null;
  /** "pet" or "ability", for the counts. */
  noun: { one: string; many: string };
};

/*
 * On phones a grid of ten would leave each tile ~120px, too narrow for
 * "Mechanical" beside its icon, so the tiles wrap like chips there (each as
 * wide as its name, a row stretched to the edge). From `sm` up they are a
 * grid: two rows of five, then one row of ten, icon over name.
 */
const groupSx = {
  display: { xs: "flex", sm: "grid" },
  flexWrap: "wrap",
  gap: 1,
  gridTemplateColumns: {
    sm: "repeat(5, minmax(0, 1fr))",
    lg: "repeat(10, minmax(0, 1fr))",
  },
} as const;

const tileSx = (familyId: number) => (theme: Theme) => {
  const color = familyColor(theme, familyId);
  return {
    position: "relative",
    overflow: "hidden",
    flex: { xs: "1 1 auto", sm: "initial" },
    minWidth: 0,
    minHeight: { xs: 48, sm: 96 },
    px: { xs: 1.25, sm: 1 },
    py: 1,
    display: "flex",
    flexDirection: { xs: "row", sm: "column" },
    alignItems: "center",
    justifyContent: { xs: "flex-start", sm: "center" },
    gap: { xs: 1, sm: 0.75 },
    textAlign: { xs: "left", sm: "center" },
    textTransform: "none",
    color: "text.secondary",
    border: `1px solid ${theme.palette.border.subtle}`,
    borderBottom: `3px solid ${alpha(color, 0.7)}`,
    borderRadius: `${theme.wc.radius.md}px`,
    background: `linear-gradient(160deg, ${alpha(color, 0.18)} 0%, ${alpha(color, 0.03)} 75%)`,
    "@media (hover: hover)": {
      "&:hover": {
        background: `linear-gradient(160deg, ${alpha(color, 0.28)} 0%, ${alpha(color, 0.06)} 75%)`,
      },
    },
    "&.Mui-selected, &.Mui-selected:hover": {
      color: "text.primary",
      borderColor: theme.palette.primary.main,
      borderBottomColor: color,
      boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
      background: `linear-gradient(160deg, ${alpha(color, 0.34)} 0%, ${alpha(color, 0.1)} 75%)`,
    },
  };
};

const FamilyTile = ({
  family,
  name,
  count,
  noun,
  selected,
  onSelect,
}: {
  family: PetFamily;
  name: string;
  count: number | undefined;
  noun: FamilyPickerProps["noun"];
  selected: boolean;
  onSelect: (familyId: number) => void;
}): JSX.Element => (
  // The name and the count are the button's own text, so both are its name
  // ("Beast 312 pets"); the icon is decorative.
  <ToggleButton
    value={family.id}
    selected={selected}
    onChange={() => onSelect(family.id)}
    sx={tileSx(family.id)}
  >
    <FamilyIcon family={family} size={{ xs: 28, sm: 40 }} name={name} />
    <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
      <Typography
        variant="subtitle2"
        component="span"
        sx={{
          display: "block",
          fontWeight: 600,
          lineHeight: 1.3,
          overflowWrap: "anywhere",
          whiteSpace: { xs: "nowrap", sm: "normal" },
        }}
      >
        {name}
      </Typography>
      {count !== undefined ? (
        <Typography
          variant="caption"
          component="span"
          color="text.secondary"
          sx={{ display: "block", lineHeight: 1.3, whiteSpace: "nowrap" }}
        >
          {pluralize(count, noun.one, noun.many)}
        </Typography>
      ) : null}
    </Box>
  </ToggleButton>
);

/**
 * The ten pet families as tiles, each a toggle button (a Tab stop with
 * aria-pressed): pressing one filters the list to it, pressing it again
 * lists every family. The icons come straight from Blizzard's render host,
 * so the tiles cost no API requests and never wait for one.
 */
const FamilyPicker = ({ names, value, onChange, counts, noun }: FamilyPickerProps): JSX.Element => (
  <Box role="group" aria-label="Pet families" sx={groupSx}>
    {PET_FAMILIES.map((family) => (
      <FamilyTile
        key={family.id}
        family={family}
        name={names.get(family.id) ?? family.fallbackName}
        count={counts?.get(family.id)}
        noun={noun}
        selected={family.id === value}
        onSelect={onChange}
      />
    ))}
  </Box>
);

export default FamilyPicker;
