import { Breadcrumbs, Link, Skeleton, Typography } from "@mui/material";
import type { MouseEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

export type JournalTrailTarget = "tier" | "instance";

export type JournalTrailStep = {
  /** Undefined while the name is still loading. */
  label: string | undefined;
  /** Search string for the step (`?expansion=516`); the current step has none. */
  href?: string;
  target?: JournalTrailTarget;
};

export type JournalTrailProps = {
  steps: JournalTrailStep[];
  /** A plain click on a step: the page moves focus to what it opens. */
  onNavigate: (target: JournalTrailTarget) => void;
};

/** A click the browser handles itself (new tab, new window, download) moves no focus here. */
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * Where the journal is: expansion › instance › encounter. Each earlier step
 * is a real link (it can open in a new tab) that steps back up the drill
 * down; the last one is the current view. The page header's breadcrumb
 * already names the route, so this one is labelled for the journal.
 */
const JournalTrail = ({ steps, onNavigate }: JournalTrailProps): JSX.Element => (
  <Breadcrumbs
    aria-label="Journal location"
    sx={(theme) => ({
      ...theme.typography.body2,
      color: theme.palette.text.secondary,
      minWidth: 0,
      "& .MuiBreadcrumbs-ol": { rowGap: 0.5 },
      "& .MuiBreadcrumbs-li": { minWidth: 0, overflowWrap: "anywhere" },
    })}
  >
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;
      const key = `${index}-${step.label ?? "loading"}`;
      if (step.label === undefined) {
        return <Skeleton key={key} variant="text" width={96} aria-hidden />;
      }
      if (!isLast && step.href !== undefined && step.target) {
        const target = step.target;
        return (
          <Link
            key={key}
            component={RouterLink}
            to={{ search: step.href }}
            preventScrollReset
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (isPlainClick(event)) {
                onNavigate(target);
              }
            }}
            variant="body2"
            color="text.secondary"
          >
            {step.label}
          </Link>
        );
      }
      return (
        <Typography
          key={key}
          variant="body2"
          component="span"
          color={isLast ? "text.primary" : "text.secondary"}
          // The page header's breadcrumb marks the route as the page; this
          // marks where in the journal the view below is.
          aria-current={isLast ? "location" : undefined}
        >
          {step.label}
        </Typography>
      );
    })}
  </Breadcrumbs>
);

export default JournalTrail;
