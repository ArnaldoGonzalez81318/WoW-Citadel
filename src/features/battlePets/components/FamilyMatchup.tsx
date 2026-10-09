import { Box, Typography } from "@mui/material";

import FamilyBadge from "@/features/battlePets/components/FamilyBadge";
import {
  familyById,
  resistantTo,
  vulnerableTo,
} from "@/features/battlePets/config/petFamilies";

export type FamilyMatchupProps = {
  familyId: number;
  names: ReadonlyMap<number, string>;
  /**
   * "attack" for an ability (what its damage type hits hard and soft);
   * "full" for a pet or a family (its attacks, then what hits it).
   */
  variant: "attack" | "full";
};

/** Why the rows below are not Blizzard's: the API has no matchup data at all. */
export const MATCHUP_NOTE = "Pet battle matchups are game knowledge, not Blizzard API data.";

type Row = { label: string; familyId: number | undefined };

/**
 * A family's pet battle matchups as a label/value list: its abilities deal
 * 50% more damage to one family and 33% less to another, and its pets take
 * 50% more from one and 33% less from another. Game knowledge, so the
 * caller shows MATCHUP_NOTE with it.
 */
const FamilyMatchup = ({ familyId, names, variant }: FamilyMatchupProps): JSX.Element | null => {
  const family = familyById(familyId);
  if (!family) {
    return null;
  }
  const rows: Row[] = [
    { label: "Strong against (+50%)", familyId: family.strongAgainst },
    { label: "Weak against (−33%)", familyId: family.weakAgainst },
  ];
  if (variant === "full") {
    rows.push(
      { label: "Takes more from (+50%)", familyId: vulnerableTo(family.id)?.id },
      { label: "Takes less from (−33%)", familyId: resistantTo(family.id)?.id },
    );
  }

  return (
    <Box
      component="dl"
      sx={{
        display: "grid",
        // Label over value on phones, where a label column would squeeze the
        // family names to an ellipsis.
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "max-content minmax(0, 1fr)" },
        columnGap: 1.5,
        rowGap: { xs: 0.25, sm: 0.75 },
        m: 0,
        alignItems: "center",
      }}
    >
      {rows.map((row) =>
        row.familyId === undefined ? null : (
          <Box key={row.label} sx={{ display: "contents" }}>
            <Typography
              component="dt"
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              {row.label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, mb: { xs: 0.75, sm: 0 }, minWidth: 0 }}
            >
              <FamilyBadge
                familyId={row.familyId}
                name={names.get(row.familyId) ?? familyById(row.familyId)?.fallbackName ?? ""}
              />
            </Typography>
          </Box>
        ),
      )}
    </Box>
  );
};

export default FamilyMatchup;
