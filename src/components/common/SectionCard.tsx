import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useId } from "react";
import type { ElementType, ReactNode } from "react";

import { toSxArray } from "@/lib/sx";

export type SectionCardPadding = "none" | "compact" | "default";

export type SectionCardTone = "default" | "highlight" | "gold";

export type SectionCardTitleAs = "h2" | "h3" | "h4";

export type SectionCardProps = {
  title?: string;
  /** Heading level for the title (h2 by default; sections inside sections use h3). */
  titleAs?: SectionCardTitleAs;
  icon?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header actions. */
  actions?: ReactNode;
  /** Body padding: none (tables, lists), compact 16px, default 20px. */
  padding?: SectionCardPadding;
  /** highlight → primary border; gold → border.gold (value / token content). */
  tone?: SectionCardTone;
  id?: string;
  /** Root element (defaults to `section` when titled, `div` otherwise). */
  component?: ElementType;
  sx?: SxProps<Theme>;
  children?: ReactNode;
};

const PADDING_PX: Record<SectionCardPadding, number> = {
  none: 0,
  compact: 16,
  default: 20,
};

/**
 * Outlined Paper with an optional titled header. Section titles inside pages
 * are always a SectionCard h2/h3 (variant h5 for size).
 */
const SectionCard = ({
  title,
  titleAs = "h2",
  icon,
  description,
  actions,
  padding = "default",
  tone = "default",
  id,
  component,
  sx,
  children,
}: SectionCardProps): JSX.Element => {
  const generatedId = useId();
  const titleId = title ? `${id ?? `section-${generatedId}`}-title` : undefined;
  const hasHeader = Boolean(title) || Boolean(actions) || Boolean(description);
  const bodyPadding = PADDING_PX[padding];
  // The header keeps its own padding even when the body has none (tables).
  const headerPadding = padding === "none" ? PADDING_PX.compact : bodyPadding;

  return (
    <Paper
      component={component ?? (title ? "section" : "div")}
      variant="outlined"
      id={id}
      aria-labelledby={titleId}
      sx={[
        (theme) => ({
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          borderRadius: `${theme.wc.radius.lg}px`,
          borderColor:
            tone === "highlight"
              ? theme.palette.primary.main
              : tone === "gold"
                ? theme.palette.border.gold
                : theme.palette.border.default,
        }),
        ...toSxArray(sx),
      ]}
    >
      {hasHeader ? (
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          sx={{
            padding: `${headerPadding}px`,
            paddingBottom: padding === "none" ? `${headerPadding}px` : 0,
            minWidth: 0,
          }}
        >
          {icon ? (
            <Box
              aria-hidden="true"
              sx={(theme) => ({
                display: "flex",
                flexShrink: 0,
                marginTop: "2px",
                color:
                  tone === "gold"
                    ? theme.palette.secondary.main
                    : theme.palette.primary.light,
                "& svg": { fontSize: 20 },
              })}
            >
              {icon}
            </Box>
          ) : null}

          <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
            {title ? (
              <Typography
                id={titleId}
                variant="h5"
                component={titleAs}
                sx={{ margin: 0 }}
              >
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography
                variant="body2"
                color="text.secondary"
                component="div"
                sx={{ maxWidth: "72ch" }}
              >
                {description}
              </Typography>
            ) : null}
          </Stack>

          {actions ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ flexShrink: 0, marginLeft: "auto" }}
            >
              {actions}
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {hasHeader && padding === "none" ? <Divider /> : null}

      {children !== undefined && children !== null ? (
        <Box
          sx={{
            padding: `${bodyPadding}px`,
            paddingTop:
              hasHeader && padding !== "none"
                ? `${Math.max(12, bodyPadding - 4)}px`
                : `${bodyPadding}px`,
            minWidth: 0,
            flex: 1,
          }}
        >
          {children}
        </Box>
      ) : null}
    </Paper>
  );
};

export default SectionCard;
