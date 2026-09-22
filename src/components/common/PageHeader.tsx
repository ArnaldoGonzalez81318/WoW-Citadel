import { Box, Breadcrumbs, Link, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { toSxArray } from "@/lib/sx";

export type PageHeaderBreadcrumb = {
  label: string;
  /** Route path; the last crumb (current page) usually has none. */
  to?: string;
};

export type PageHeaderProps = {
  /** The page's single h1. */
  title: string;
  /** Gold overline above the title (the nav section, e.g. "Game data"). */
  eyebrow?: string;
  /** Lead paragraph under the title (body1, text.secondary, max 72ch). */
  description?: ReactNode;
  /** Icon element shown in a 40px tile on md+. */
  icon?: ReactNode;
  /** Buttons, right-aligned on md+. */
  actions?: ReactNode;
  /** Chip row of real facts ("Region US", "1,204 items"). */
  meta?: ReactNode;
  breadcrumbs?: PageHeaderBreadcrumb[];
  /** Overrides the document title (defaults to `title`). */
  documentTitle?: string;
  /** Halves the vertical spacing (sub-pages, dialogs' host pages). */
  compact?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * Page header anatomy: breadcrumbs → gold eyebrow → h1 → lead → meta + actions.
 * Renders the route's only h1 and owns `document.title`.
 */
const PageHeader = ({
  title,
  eyebrow,
  description,
  icon,
  actions,
  meta,
  breadcrumbs,
  documentTitle,
  compact = false,
  sx,
}: PageHeaderProps): JSX.Element => {
  useDocumentTitle(documentTitle ?? title);

  const gap = compact ? 1 : 2;
  const hasFooterRow = Boolean(meta) || Boolean(actions);

  return (
    <Box
      component="header"
      sx={[
        {
          display: "flex",
          flexDirection: "column",
          gap,
          minWidth: 0,
        },
        ...toSxArray(sx),
      ]}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs
          aria-label="Breadcrumb"
          sx={(theme) => ({
            ...theme.typography.caption,
            color: theme.palette.text.secondary,
            "& .MuiBreadcrumbs-separator": { marginInline: 0.75 },
          })}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            if (crumb.to && !isLast) {
              return (
                <Link
                  key={`${crumb.label}-${index}`}
                  component={RouterLink}
                  to={crumb.to}
                  variant="caption"
                  color="text.secondary"
                >
                  {crumb.label}
                </Link>
              );
            }

            return (
              <Typography
                key={`${crumb.label}-${index}`}
                variant="caption"
                component="span"
                color={isLast ? "text.primary" : "text.secondary"}
                aria-current={isLast ? "page" : undefined}
              >
                {crumb.label}
              </Typography>
            );
          })}
        </Breadcrumbs>
      ) : null}

      {/*
        `useFlexGap`: the icon tile is `display: none` below md, and a CSS gap
        (unlike Stack's margin spacing) leaves no 16px indent behind it.
      */}
      <Stack direction="row" spacing={2} alignItems="flex-start" useFlexGap>
        {icon ? (
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 40,
              height: 40,
              marginTop: 0.5,
              borderRadius: `${theme.wc.radius.md}px`,
              backgroundColor: theme.palette.surface.inset,
              border: `1px solid ${theme.palette.border.subtle}`,
              color: theme.palette.primary.light,
              "& svg": { fontSize: 22 },
            })}
          >
            {icon}
          </Box>
        ) : null}

        <Stack spacing={compact ? 0.5 : 1} sx={{ minWidth: 0, flex: 1 }}>
          {eyebrow ? (
            <Typography
              variant="overline"
              component="p"
              sx={{ color: "secondary.main", margin: 0, lineHeight: 1.4 }}
            >
              {eyebrow}
            </Typography>
          ) : null}

          <Typography variant="h1" component="h1" sx={{ margin: 0 }}>
            {title}
          </Typography>

          {description ? (
            <Typography
              variant="body1"
              color="text.secondary"
              component="div"
              sx={{ maxWidth: "72ch" }}
            >
              {description}
            </Typography>
          ) : null}
        </Stack>
      </Stack>

      {hasFooterRow ? (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={compact ? 1 : 1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
          useFlexGap
        >
          {meta ? (
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              {meta}
            </Stack>
          ) : (
            <Box sx={{ display: { xs: "none", md: "block" } }} />
          )}
          {actions ? (
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              alignItems="center"
              sx={{ marginLeft: { md: "auto" }, flexShrink: 0 }}
            >
              {actions}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
};

export default PageHeader;
