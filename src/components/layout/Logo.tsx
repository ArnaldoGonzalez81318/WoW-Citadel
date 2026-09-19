import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import { focusRing } from "@/theme";

export type LogoProps = {
  /** Hide the wordmark and show only the mark. */
  compact?: boolean;
};

/**
 * Brand mark: the same drawing as public/favicon.svg (raised-surface square,
 * gold diamond), inline so it scales crisply and follows the palette.
 */
const LogoMark = ({ size = 32 }: { size?: number }): JSX.Element => {
  const theme = useTheme();

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="8"
        fill={theme.palette.surface.overlay}
        stroke={theme.palette.border.default}
        strokeWidth="1"
      />
      <rect
        x="9"
        y="9"
        width="14"
        height="14"
        rx="2"
        fill="none"
        stroke={theme.palette.secondary.main}
        strokeWidth="3"
        strokeLinejoin="round"
        transform="rotate(45 16 16)"
      />
    </svg>
  );
};

/** Home link. The visible wordmark labels it; no aria-label override. */
const Logo = ({ compact = false }: LogoProps): JSX.Element => (
  <Box
    component={RouterLink}
    to="/"
    sx={(theme) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 1.25,
      minWidth: 0,
      flexShrink: 0,
      textDecoration: "none",
      color: "text.primary",
      borderRadius: `${theme.wc.radius.md}px`,
      "&:focus-visible": focusRing(theme),
    })}
  >
    <LogoMark />
    {compact ? null : (
      <Typography
        component="span"
        variant="h6"
        sx={{ fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" }}
      >
        WoW Citadel
      </Typography>
    )}
  </Box>
);

export default Logo;
