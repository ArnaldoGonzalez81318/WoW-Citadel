import { Link } from "@mui/material";
import type { MouseEvent } from "react";

import { visuallyHidden } from "@/theme";

export type SkipLinkProps = {
  /** id of the main landmark (the app shell renders `<main id="main-content">`). */
  targetId?: string;
  label?: string;
};

/**
 * First focusable element on the page: hidden until it receives keyboard
 * focus, then moves focus straight to the main content.
 */
const SkipLink = ({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps): JSX.Element => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    event.preventDefault();
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
    // `focus()` alone leaves a target that already fills the viewport where
    // it is; align its start instead (honours the target's scroll-margin-top,
    // which keeps it clear of the sticky header).
    target.scrollIntoView({ block: "start" });
  };

  return (
    <Link
      href={`#${targetId}`}
      onClick={handleClick}
      underline="none"
      sx={(theme) => ({
        ...visuallyHidden,
        "&:focus-visible": {
          position: "fixed",
          top: theme.spacing(1),
          left: theme.spacing(1),
          zIndex: theme.zIndex.tooltip + 1,
          width: "auto",
          height: "auto",
          margin: 0,
          padding: theme.spacing(1, 2),
          clip: "auto",
          clipPath: "none",
          overflow: "visible",
          whiteSpace: "nowrap",
          backgroundColor: theme.palette.surface.popover,
          border: `1px solid ${theme.palette.border.strong}`,
          borderRadius: `${theme.wc.radius.md}px`,
          boxShadow: theme.palette.glow.popover,
          color: theme.palette.text.primary,
          fontWeight: 500,
        },
      })}
    >
      {label}
    </Link>
  );
};

export default SkipLink;
