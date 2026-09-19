import { alpha } from "@mui/material/styles";
import type { PaletteColor, Theme, ThemeOptions } from "@mui/material/styles";
import { alertClasses } from "@mui/material/Alert";
import { chipClasses } from "@mui/material/Chip";
import { inputLabelClasses } from "@mui/material/InputLabel";
import { menuItemClasses } from "@mui/material/MenuItem";
import { outlinedInputClasses } from "@mui/material/OutlinedInput";
import { toggleButtonClasses } from "@mui/material/ToggleButton";

import { focusRing } from "./mixins";
import { BLUE_GREY, SHADOW_INK } from "./tokens";

type ComponentOverrides = NonNullable<ThemeOptions["components"]>;

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

/**
 * Component overrides for the "Arcane Ledger" direction.
 *
 * Built from `base` (palette, shape, transitions and `wc` already resolved)
 * so every value is derived from a token. Slots that need the final type
 * scale use the callback form and read `theme.typography` at render time.
 */
export const components = (base: Theme): ComponentOverrides => {
  const { palette, wc, breakpoints } = base;
  const ring = focusRing(base);
  const ringInset = focusRing(base, true);

  const transition = (
    properties: string[],
    duration: number = wc.motion.base,
  ): string =>
    base.transitions.create(properties, {
      duration,
      easing: wc.motion.easing,
    });

  const popoverPaper = {
    backgroundColor: palette.surface.popover,
    backgroundImage: "none",
    border: `1px solid ${palette.border.default}`,
    borderRadius: wc.radius.lg,
    boxShadow: palette.glow.popover,
  };

  const alertTone = (tone: PaletteColor) => ({
    backgroundColor: alpha(tone.main, 0.1),
    border: `1px solid ${alpha(tone.main, 0.35)}`,
    color: palette.text.primary,
    [`& .${alertClasses.icon}`]: {
      color: tone.light,
    },
  });

  const elevationOverrides: Record<string, { boxShadow: string }> = {};
  for (let level = 1; level <= 24; level += 1) {
    elevationOverrides[`elevation${level}`] = {
      boxShadow: level >= 8 ? palette.glow.popover : palette.glow.card,
    };
  }

  return {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          colorScheme: "dark",
          scrollbarWidth: "thin",
          scrollbarColor: `${alpha(BLUE_GREY, 0.35)} ${palette.surface.sunken}`,
        },
        body: {
          backgroundColor: palette.background.default,
          backgroundImage: `radial-gradient(1200px 600px at 50% -10%, ${alpha(
            palette.primary.main,
            0.14,
          )}, transparent 70%)`,
          backgroundRepeat: "no-repeat",
        },
        ":focus-visible": {
          outline: ring.outline,
          outlineOffset: ring.outlineOffset,
        },
        "::selection": {
          backgroundColor: alpha(palette.primary.main, 0.35),
        },
        img: {
          maxWidth: "100%",
        },
        [REDUCED_MOTION]: {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
            scrollBehavior: "auto !important",
          },
        },
      },
    },

    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": ring,
        },
      },
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          fontWeight: 500,
          textTransform: "none",
          borderRadius: wc.radius.md,
          transition: transition([
            "background-color",
            "border-color",
            "color",
            "box-shadow",
          ]),
        },
        sizeSmall: {
          minHeight: 32,
          paddingInline: 12,
        },
        sizeMedium: {
          minHeight: 40,
          paddingInline: 16,
        },
        sizeLarge: {
          minHeight: 48,
          paddingInline: 24,
          fontSize: "0.9375rem",
        },
        contained: {
          backgroundImage: "none",
          boxShadow: "none",
          "&:hover, &:active, &.Mui-focusVisible": {
            boxShadow: "none",
          },
        },
        outlined: {
          borderColor: palette.border.default,
          "&:hover": {
            borderColor: palette.border.strong,
            backgroundColor: palette.action.hover,
          },
        },
        textSizeSmall: {
          paddingInline: 8,
        },
        textSizeMedium: {
          paddingInline: 8,
        },
        textSizeLarge: {
          paddingInline: 8,
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: wc.radius.md,
          transition: transition(["background-color", "color"], wc.motion.fast),
          "&:hover": {
            backgroundColor: palette.action.hover,
          },
        },
        sizeSmall: {
          width: 32,
          height: 32,
          padding: 4,
        },
        sizeMedium: {
          width: 40,
          height: 40,
          padding: 8,
        },
        sizeLarge: {
          width: 48,
          height: 48,
          padding: 12,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: palette.surface.raised,
        },
        rounded: {
          borderRadius: wc.radius.lg,
        },
        outlined: {
          border: `1px solid ${palette.border.subtle}`,
        },
        ...elevationOverrides,
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: palette.surface.raised,
          backgroundImage: "none",
          border: `1px solid ${palette.border.default}`,
          borderRadius: wc.radius.lg,
          boxShadow: "none",
        },
      },
    },

    MuiCardActionArea: {
      styleOverrides: {
        root: {
          borderRadius: "inherit",
          "&.Mui-focusVisible": ringInset,
        },
      },
    },

    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: 16,
        },
        title: ({ theme }) => ({
          ...theme.typography.h6,
        }),
        subheader: ({ theme }) => ({
          ...theme.typography.body2,
          color: theme.palette.text.secondary,
        }),
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 16,
          "&:last-child": {
            paddingBottom: 16,
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: wc.radius.pill,
          fontWeight: 500,
          height: 28,
          transition: transition(
            ["background-color", "border-color", "color", "box-shadow"],
            wc.motion.fast,
          ),
          [`&.${chipClasses.focusVisible}`]: ring,
          "&[aria-pressed='true']": {
            backgroundColor: alpha(palette.primary.main, 0.24),
            borderColor: palette.border.strong,
            fontWeight: 700,
          },
        },
        sizeSmall: {
          height: 24,
        },
      },
      variants: [
        {
          props: { variant: "filled", color: "default" },
          style: {
            backgroundColor: palette.action.selected,
            color: palette.text.primary,
          },
        },
        {
          props: { variant: "filled", color: "primary" },
          style: {
            backgroundColor: alpha(palette.primary.main, 0.16),
            color: palette.primary.light,
          },
        },
        {
          props: { variant: "outlined", color: "default" },
          style: {
            borderColor: palette.border.default,
          },
        },
        {
          props: { variant: "outlined", color: "primary" },
          style: {
            borderColor: alpha(palette.primary.main, 0.5),
            color: palette.primary.light,
          },
        },
        {
          props: { clickable: true, color: "default" },
          style: {
            "&:hover": {
              backgroundColor: alpha(palette.primary.main, 0.24),
            },
          },
        },
        {
          props: { clickable: true, color: "primary" },
          style: {
            "&:hover": {
              backgroundColor: alpha(palette.primary.main, 0.24),
            },
          },
        },
      ],
    },

    MuiInputBase: {
      styleOverrides: {
        input: {
          "&::placeholder": {
            color: palette.text.secondary,
            opacity: 1,
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: palette.surface.sunken,
          borderRadius: wc.radius.md,
          minHeight: 48,
          transition: transition(
            ["border-color", "box-shadow", "background-color"],
            wc.motion.fast,
          ),
          [`& .${outlinedInputClasses.notchedOutline}`]: {
            borderColor: palette.border.default,
            transition: transition(["border-color"], wc.motion.fast),
          },
          [`&:hover .${outlinedInputClasses.notchedOutline}`]: {
            borderColor: palette.border.strong,
          },
          [`&.${outlinedInputClasses.focused} .${outlinedInputClasses.notchedOutline}`]:
            {
              borderColor: palette.primary.main,
              borderWidth: 1,
            },
          [`&.${outlinedInputClasses.focused}`]: {
            boxShadow: palette.glow.primary,
          },
          [`&.${outlinedInputClasses.error} .${outlinedInputClasses.notchedOutline}`]:
            {
              borderColor: palette.error.main,
            },
          [`&.${outlinedInputClasses.disabled}`]: {
            backgroundColor: palette.action.disabledBackground,
          },
          [`&.${outlinedInputClasses.disabled} .${outlinedInputClasses.notchedOutline}`]:
            {
              borderColor: palette.border.subtle,
            },
        },
        sizeSmall: {
          minHeight: 40,
        },
        input: {
          paddingTop: 12.5,
          paddingBottom: 12.5,
        },
        inputSizeSmall: {
          paddingTop: 8.5,
          paddingBottom: 8.5,
        },
        multiline: {
          paddingTop: 12.5,
          paddingBottom: 12.5,
        },
        inputMultiline: {
          paddingTop: 0,
          paddingBottom: 0,
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: palette.text.secondary,
          [`&.${inputLabelClasses.focused}`]: {
            color: palette.primary.light,
          },
          [`&.${inputLabelClasses.error}`]: {
            color: palette.error.main,
          },
        },
        outlined: {
          transform: "translate(14px, 12px) scale(1)",
          [`&.${inputLabelClasses.sizeSmall}`]: {
            transform: "translate(14px, 9px) scale(1)",
          },
          [`&.${inputLabelClasses.shrink}`]: {
            transform: "translate(14px, -9px) scale(0.75)",
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        icon: {
          color: palette.text.secondary,
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: popoverPaper,
        list: {
          paddingBlock: 4,
          paddingInline: 0,
        },
      },
    },

    MuiPopover: {
      styleOverrides: {
        paper: popoverPaper,
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: wc.radius.sm,
          marginInline: 4,
          minHeight: 40,
          [breakpoints.up("sm")]: {
            minHeight: 40,
          },
          [`&.${menuItemClasses.selected}`]: {
            backgroundColor: palette.action.selected,
            "&:hover": {
              backgroundColor: alpha(palette.primary.main, 0.24),
            },
          },
          [`&.${menuItemClasses.focusVisible}`]: {
            ...ringInset,
            backgroundColor: palette.action.focus,
          },
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: wc.radius.sm,
          "&.Mui-selected": {
            backgroundColor: palette.action.selected,
          },
          "&.Mui-focusVisible": ringInset,
        },
      },
    },

    MuiAutocomplete: {
      styleOverrides: {
        paper: popoverPaper,
        listbox: {
          paddingBlock: 4,
          paddingInline: 0,
        },
        option: {
          borderRadius: wc.radius.sm,
          marginInline: 4,
          minHeight: 40,
          [breakpoints.up("sm")]: {
            minHeight: 40,
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.surface.overlay,
          backgroundImage: "none",
          border: `1px solid ${palette.border.default}`,
          borderRadius: wc.radius.xl,
          boxShadow: palette.glow.popover,
        },
        paperFullScreen: {
          // Edge-to-edge below `sm`: no corners, no frame.
          borderRadius: "0",
          border: "none",
        },
      },
    },

    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(SHADOW_INK, 0.7),
        },
        invisible: {
          backgroundColor: "transparent",
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: wc.radius.md,
          alignItems: "flex-start",
        },
        standardError: alertTone(palette.error),
        standardWarning: alertTone(palette.warning),
        standardInfo: alertTone(palette.info),
        standardSuccess: alertTone(palette.success),
        outlinedError: alertTone(palette.error),
        outlinedWarning: alertTone(palette.warning),
        outlinedInfo: alertTone(palette.info),
        outlinedSuccess: alertTone(palette.success),
      },
    },

    MuiSkeleton: {
      defaultProps: {
        animation: "wave",
      },
      styleOverrides: {
        root: {
          backgroundColor: palette.surface.inset,
          borderRadius: wc.radius.md,
        },
        text: {
          borderRadius: wc.radius.sm,
        },
        circular: {
          borderRadius: "50%",
        },
      },
    },

    MuiLink: {
      defaultProps: {
        underline: "hover",
      },
      styleOverrides: {
        root: {
          color: palette.primary.light,
          borderRadius: wc.radius.sm,
          textDecorationColor: alpha(palette.primary.light, 0.5),
          textUnderlineOffset: 2,
          "&:focus-visible": ring,
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: palette.surface.popover,
          border: `1px solid ${palette.border.default}`,
          borderRadius: wc.radius.md,
          color: palette.text.primary,
          fontSize: "0.75rem",
          fontWeight: 400,
          lineHeight: 1.45,
          paddingBlock: 6,
          paddingInline: 10,
          boxShadow: palette.glow.popover,
        },
        arrow: {
          color: palette.surface.popover,
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
        indicator: {
          height: 2,
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: "none",
          fontWeight: 500,
          borderRadius: wc.radius.sm,
          "&.Mui-focusVisible": ringInset,
        },
      },
    },

    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          borderRadius: wc.radius.md,
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: wc.radius.md,
          border: `1px solid ${palette.border.default}`,
          minHeight: 40,
          paddingBlock: 6,
          paddingInline: 12,
          color: palette.text.secondary,
          textTransform: "none",
          fontWeight: 500,
          transition: transition(
            ["background-color", "border-color", "color"],
            wc.motion.fast,
          ),
          "&:hover": {
            backgroundColor: palette.action.hover,
          },
          [`&.${toggleButtonClasses.selected}`]: {
            backgroundColor: alpha(palette.primary.main, 0.18),
            color: palette.primary.light,
            "&:hover": {
              backgroundColor: alpha(palette.primary.main, 0.24),
            },
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${palette.divider}`,
          paddingBlock: 10,
        },
        head: ({ theme }) => ({
          ...theme.typography.overline,
          color: theme.palette.text.secondary,
        }),
      },
    },

    MuiAppBar: {
      defaultProps: {
        color: "default",
        elevation: 0,
      },
      styleOverrides: {
        root: {
          boxShadow: "none",
          backgroundImage: "none",
        },
        colorDefault: {
          backgroundColor: alpha(palette.surface.base, 0.96),
          color: palette.text.primary,
          borderBottom: `1px solid ${palette.border.subtle}`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.surface.raised,
          backgroundImage: "none",
        },
        paperAnchorLeft: {
          borderRight: `1px solid ${palette.border.subtle}`,
        },
        paperAnchorRight: {
          borderLeft: `1px solid ${palette.border.subtle}`,
        },
        paperAnchorTop: {
          borderBottom: `1px solid ${palette.border.subtle}`,
        },
        paperAnchorBottom: {
          borderTop: `1px solid ${palette.border.subtle}`,
        },
      },
    },

    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          backgroundImage: "none",
          border: `1px solid ${palette.border.default}`,
          boxShadow: "none",
          "&::before": {
            display: "none",
          },
        },
        rounded: {
          borderRadius: wc.radius.lg,
          "&:first-of-type": {
            borderTopLeftRadius: wc.radius.lg,
            borderTopRightRadius: wc.radius.lg,
          },
          "&:last-of-type": {
            borderBottomLeftRadius: wc.radius.lg,
            borderBottomRightRadius: wc.radius.lg,
          },
        },
      },
    },

    MuiContainer: {
      defaultProps: {
        maxWidth: "xl",
      },
      styleOverrides: {
        root: {
          paddingLeft: 16,
          paddingRight: 16,
          [breakpoints.up("md")]: {
            paddingLeft: 24,
            paddingRight: 24,
          },
        },
        disableGutters: {
          paddingLeft: 0,
          paddingRight: 0,
          [breakpoints.up("md")]: {
            paddingLeft: 0,
            paddingRight: 0,
          },
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 2,
          backgroundColor: alpha(palette.primary.main, 0.16),
        },
      },
    },
  };
};
