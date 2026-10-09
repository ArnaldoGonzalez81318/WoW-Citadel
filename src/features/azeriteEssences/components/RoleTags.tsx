import AllInclusiveRounded from "@mui/icons-material/AllInclusiveRounded";
import HealingRounded from "@mui/icons-material/HealingRounded";
import LocalFireDepartmentRounded from "@mui/icons-material/LocalFireDepartmentRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { Chip, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";

import {
  ROLE_ORDER,
  describeRoles,
} from "@/features/azeriteEssences/services/azeriteEssenceService";
import type { RoleType } from "@/features/azeriteEssences/types";

/** Each role's hue: the theme's info, success and error colours. */
export const roleColor = (theme: Theme, role: RoleType): string => {
  if (role === "TANK") {
    return theme.palette.info.main;
  }
  if (role === "HEALER") {
    return theme.palette.success.main;
  }
  return theme.palette.error.main;
};

/** A role's glyph: a shield, a plaster, a flame. Decorative; the name sits beside it. */
export const RoleIcon = ({ role, ...props }: { role: RoleType } & SvgIconProps): JSX.Element => {
  if (role === "TANK") {
    return <ShieldRounded aria-hidden="true" {...props} />;
  }
  if (role === "HEALER") {
    return <HealingRounded aria-hidden="true" {...props} />;
  }
  return <LocalFireDepartmentRounded aria-hidden="true" {...props} />;
};

export type RoleTagsProps = {
  roles: readonly RoleType[];
  /** Blizzard's localized role names. */
  names: Record<RoleType, string>;
  /** For aria-describedby on the card that shows them. */
  id?: string;
};

/**
 * The roles that can use an essence, as small tinted chips. An essence open
 * to all three wears one gold "Every role" chip instead of three.
 */
const RoleTags = ({ roles, names, id }: RoleTagsProps): JSX.Element => {
  const every = roles.length === ROLE_ORDER.length;
  return (
    <Stack
      id={id}
      component="span"
      direction="row"
      flexWrap="wrap"
      useFlexGap
      gap={0.5}
      sx={{ minWidth: 0 }}
    >
      {every ? (
        <Chip
          component="span"
          size="small"
          variant="outlined"
          icon={<AllInclusiveRounded aria-hidden="true" />}
          label={describeRoles(roles, names)}
          sx={(theme) => ({
            borderColor: theme.palette.border.gold,
            "& .MuiChip-icon": { color: theme.palette.secondary.main },
          })}
        />
      ) : roles.length === 0 ? (
        <Chip component="span" size="small" variant="outlined" label="Roles unknown" />
      ) : (
        roles.map((role) => (
          <Chip
            key={role}
            component="span"
            size="small"
            variant="outlined"
            icon={<RoleIcon role={role} />}
            label={names[role]}
            sx={(theme) => ({
              borderColor: alpha(roleColor(theme, role), 0.55),
              backgroundColor: alpha(roleColor(theme, role), 0.08),
              "& .MuiChip-icon": { color: roleColor(theme, role) },
            })}
          />
        ))
      )}
    </Stack>
  );
};

export default RoleTags;
