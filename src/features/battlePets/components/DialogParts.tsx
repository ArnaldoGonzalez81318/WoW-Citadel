import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useId } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { WOWHEAD_LABEL } from "@/lib/externalLinks";
import { visuallyHidden } from "@/theme";

export type Fact = { label: string; value: ReactNode };

/** A label/value list, beside the render instead of under it (DetailDialog's rows stack on phones only). */
export const FactList = ({ facts }: { facts: Fact[] }): JSX.Element => (
  <Box
    component="dl"
    sx={{
      display: "grid",
      gridTemplateColumns: "minmax(96px, max-content) minmax(0, 1fr)",
      columnGap: 2,
      rowGap: 1.25,
      m: 0,
      alignContent: "start",
    }}
  >
    {facts.map((fact) => (
      <Box key={fact.label} sx={{ display: "contents" }}>
        <Typography
          component="dt"
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 500, alignSelf: "center" }}
        >
          {fact.label}
        </Typography>
        <Typography
          component="dd"
          variant="body2"
          sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "center" }}
        >
          {fact.value}
        </Typography>
      </Box>
    ))}
  </Box>
);

/** An id in the mono face. */
export const Mono = ({ children }: { children: ReactNode }): JSX.Element => (
  <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
    {children}
  </Box>
);

/** A titled block of a dialog: an h3 in DetailDialog's overline style. */
export const DialogSection = ({
  title,
  note,
  children,
}: {
  title: string;
  /** A caption under the heading (where the data comes from). */
  note?: ReactNode;
  children: ReactNode;
}): JSX.Element => {
  const headingId = useId();
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ minWidth: 0 }}>
      <Typography id={headingId} variant="overline" component="h3" sx={{ m: 0, mb: note ? 0.25 : 0.75 }}>
        {title}
      </Typography>
      {note ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mb: 1 }}>
          {note}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
};

/** The dialog's footer: wraps at phone width instead of pushing the dialog sideways. */
export const DialogActionsRow = ({
  primary,
  workbenchUrl,
  wowheadUrl,
  title,
}: {
  /** A page action (show this family), first. */
  primary?: ReactNode;
  workbenchUrl: string;
  wowheadUrl: string;
  /** For the external link's hidden context. */
  title: string;
}): JSX.Element => (
  <Stack
    direction="row"
    flexWrap="wrap"
    useFlexGap
    gap={1}
    justifyContent="flex-end"
    sx={{ width: "100%" }}
  >
    {primary}
    <Button component={RouterLink} to={workbenchUrl} size="small">
      Open in API workbench
    </Button>
    <Button
      href={wowheadUrl}
      target="_blank"
      rel="noreferrer"
      size="small"
      endIcon={<OpenInNewRoundedIcon />}
    >
      {WOWHEAD_LABEL}
      <Box component="span" sx={visuallyHidden}>
        {`: ${title}, opens in a new tab`}
      </Box>
    </Button>
  </Stack>
);

/** The raw record in the API workbench (catalog slug "pet", endpoint and path parameter). */
export const workbenchUrl = (endpoint: "pet" | "pet-ability", id: number): string =>
  `/api-explorer/pet?${new URLSearchParams({
    endpoint,
    [endpoint === "pet" ? "petId" : "petAbilityId"]: String(id),
  }).toString()}`;
