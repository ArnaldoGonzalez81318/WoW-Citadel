import { Box } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useState } from "react";

import {
  familyById,
  familyIconUrl,
} from "@/features/battlePets/config/petFamilies";
import type { FamilyAccent, PetFamily } from "@/features/battlePets/config/petFamilies";
import { mixins } from "@/theme";
import type { QualityKey } from "@/theme";

const PALETTE_KEYS: ReadonlySet<string> = new Set([
  "primary",
  "secondary",
  "success",
  "warning",
  "error",
  "info",
]);

type PaletteKey = "primary" | "secondary" | "success" | "warning" | "error" | "info";

/** A family's accent from the theme (palette or item-quality tokens only). */
export const familyColor = (theme: Theme, familyId: number | null | undefined): string => {
  const accent: FamilyAccent | undefined = familyById(familyId)?.accent;
  if (!accent) {
    return theme.palette.text.secondary;
  }
  return PALETTE_KEYS.has(accent)
    ? theme.palette[accent as PaletteKey].main
    : theme.palette.quality[accent as QualityKey];
};

/** Plain `img` (Box would turn `width` / `height` into CSS and drop the attributes). */
const Img = styled("img")({
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
});

export type FamilyIconProps = {
  family: PetFamily;
  /** Square size in px, or one per breakpoint (the larger is the image's own size). */
  size: number | { xs: number; sm: number };
  /** Shown (first letter) when the icon fails to load. */
  name: string;
};

/**
 * A family's icon from Blizzard's render host, decorative (its name is
 * always next to it), with the name's first letter on a tinted square if
 * the image fails.
 */
export const FamilyIcon = ({ family, size, name }: FamilyIconProps): JSX.Element => {
  const [failed, setFailed] = useState(false);
  const largest = typeof size === "number" ? size : Math.max(size.xs, size.sm);
  const smallest = typeof size === "number" ? size : Math.min(size.xs, size.sm);
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: `${Math.max(3, Math.round(smallest / 6))}px`,
        border: `1px solid ${alpha(familyColor(theme, family.id), 0.55)}`,
        backgroundColor: alpha(familyColor(theme, family.id), 0.18),
        color: familyColor(theme, family.id),
        fontSize: Math.max(10, Math.round(smallest * 0.45)),
        fontWeight: 700,
        lineHeight: 1,
      })}
    >
      {failed ? (
        name.charAt(0).toLocaleUpperCase()
      ) : (
        <Img
          src={familyIconUrl(family)}
          alt=""
          width={largest}
          height={largest}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </Box>
  );
};

export type FamilyBadgeProps = {
  familyId: number | undefined;
  /** The localized name (from the record, or the page's learned names). */
  name: string;
  size?: "small" | "medium";
};

/** A family's icon and name in its accent: one line, truncating rather than wrapping. */
const FamilyBadge = ({ familyId, name, size = "small" }: FamilyBadgeProps): JSX.Element => {
  const family = familyById(familyId);
  const iconSize = size === "small" ? 16 : 22;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minWidth: 0,
        maxWidth: "100%",
        verticalAlign: "middle",
      }}
    >
      {family ? <FamilyIcon family={family} size={iconSize} name={name} /> : null}
      <Box
        component="span"
        sx={(theme) => ({
          ...mixins.truncate,
          minWidth: 0,
          fontWeight: 600,
          color: family ? familyColor(theme, family.id) : "text.secondary",
        })}
      >
        {name}
      </Box>
    </Box>
  );
};

export default FamilyBadge;
