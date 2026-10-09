import { Paper, Stack, Typography } from "@mui/material";
import { forwardRef, useId } from "react";
import type { ReactNode } from "react";

import { focusTargetSx, scrollMarginSx } from "@/features/modifiedCrafting/components/cardStyles";

export type ResultsSectionProps = {
  title: string;
  description?: ReactNode;
  /** Right-aligned header actions. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * SectionCard's look with a heading that script can focus: a pick (a
 * theme tile, a page) moves focus here, so the next Tab continues in the
 * cards it brought up. The heading is a focus target only, never a Tab stop.
 */
const ResultsSection = forwardRef<HTMLHeadingElement, ResultsSectionProps>(
  ({ title, description, actions, children }, headingRef) => {
    const titleId = useId();
    return (
      <Paper
        component="section"
        variant="outlined"
        aria-labelledby={titleId}
        sx={(theme) => ({
          ...scrollMarginSx(theme),
          minWidth: 0,
          borderRadius: `${theme.wc.radius.lg}px`,
          borderColor: theme.palette.border.default,
        })}
      >
        <Stack spacing={2} sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "flex-start" }}
            justifyContent="space-between"
            sx={{ minWidth: 0 }}
          >
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography
                ref={headingRef}
                id={titleId}
                variant="h5"
                component="h2"
                tabIndex={-1}
                sx={focusTargetSx}
              >
                {title}
              </Typography>
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
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                {actions}
              </Stack>
            ) : null}
          </Stack>
          {children}
        </Stack>
      </Paper>
    );
  },
);

ResultsSection.displayName = "ResultsSection";

export default ResultsSection;
