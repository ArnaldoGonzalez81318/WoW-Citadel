import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { FamilyIcon, familyColor } from "@/features/battlePets/components/FamilyBadge";
import FamilyMatchup, { MATCHUP_NOTE } from "@/features/battlePets/components/FamilyMatchup";
import { familyById } from "@/features/battlePets/config/petFamilies";
import type { CatalogKind } from "@/features/battlePets/types";

export type FamilyBannerProps = {
  familyId: number;
  kind: CatalogKind;
  names: ReadonlyMap<number, string>;
  onClear: () => void;
};

/**
 * The family the list is filtered to: its icon and name over its pet battle
 * matchups (game knowledge, and labelled so), with a button that lists
 * every family again. For pets both sides of the matchup matter; for
 * abilities only what their damage hits.
 */
const FamilyBanner = ({ familyId, kind, names, onClear }: FamilyBannerProps): JSX.Element | null => {
  const family = familyById(familyId);
  if (!family) {
    return null;
  }
  const name = names.get(family.id) ?? family.fallbackName;
  return (
    <Box
      sx={(theme) => {
        const color = familyColor(theme, family.id);
        return {
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(0, 3fr)" },
          alignItems: "center",
          p: 2,
          borderRadius: `${theme.wc.radius.md}px`,
          border: `1px solid ${theme.palette.border.subtle}`,
          borderLeft: `3px solid ${alpha(color, 0.8)}`,
          background: `linear-gradient(120deg, ${alpha(color, 0.16)} 0%, ${alpha(color, 0.02)} 70%)`,
        };
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
        <FamilyIcon family={family} size={56} name={name} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" component="p" sx={{ m: 0, overflowWrap: "anywhere" }}>
            {kind === "pet" ? `${name} pets` : `${name} abilities`}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            {MATCHUP_NOTE}
          </Typography>
          <Button size="small" onClick={onClear} sx={{ mt: 0.5, ml: -0.75 }}>
            Show every family
          </Button>
        </Box>
      </Stack>
      <FamilyMatchup
        familyId={family.id}
        names={names}
        variant={kind === "pet" ? "full" : "attack"}
      />
    </Box>
  );
};

export default FamilyBanner;
