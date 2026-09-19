import type { Theme, TypographyVariantsOptions } from "@mui/material/styles";

export const FONT_FAMILY =
  "'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Font family and the three permitted weights. Passed to the *base*
 * createTheme so every variant MUI builds already carries the right stack.
 */
export const typographyBase: TypographyVariantsOptions = {
  fontFamily: FONT_FAMILY,
  fontWeightLight: 400,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
};

/**
 * Type scale for the "Arcane Ledger" direction.
 *
 * Roboto 400 / 500 / 700 only. Headings h1-h4 grow at the `md` breakpoint
 * (no responsiveFontSizes: the sizes are part of the spec, not derived).
 */
export const typography = (base: Theme): TypographyVariantsOptions => {
  const md = base.breakpoints.up("md");

  return {
    ...typographyBase,
    h1: {
      fontSize: "2rem",
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
      [md]: { fontSize: "2.75rem" },
    },
    h2: {
      fontSize: "1.5rem",
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: "-0.01em",
      [md]: { fontSize: "1.875rem" },
    },
    h3: {
      fontSize: "1.25rem",
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: "-0.005em",
      [md]: { fontSize: "1.5rem" },
    },
    h4: {
      fontSize: "1.125rem",
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: 0,
      [md]: { fontSize: "1.25rem" },
    },
    h5: {
      fontSize: "1rem",
      fontWeight: 700,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    h6: {
      fontSize: "0.9375rem",
      fontWeight: 700,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    subtitle1: {
      fontSize: "1rem",
      fontWeight: 500,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: "0.875rem",
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.6,
      fontVariantNumeric: "tabular-nums",
    },
    body2: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.55,
      fontVariantNumeric: "tabular-nums",
    },
    caption: {
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: 1.45,
      color: base.palette.text.secondary,
    },
    overline: {
      fontSize: "0.6875rem",
      fontWeight: 700,
      lineHeight: 1.5,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: base.palette.text.secondary,
    },
    button: {
      fontSize: "0.875rem",
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: 0,
      textTransform: "none",
    },
  };
};
