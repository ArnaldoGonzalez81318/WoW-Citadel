import {
  Box,
  Chip,
  Grow,
  Link,
  Paper,
  Popper,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect } from "react";
import type { MutableRefObject, RefObject } from "react";
import { Link as RouterLink } from "react-router-dom";

import type { NavFlyoutSection } from "@/components/layout/navigation/navConfig";
import { preloadRouteChunk } from "@/components/layout/navigation/navUtils";
import { focusRing, lineClamp } from "@/theme";

export type NavFlyoutProps = {
  /** Section to render; the last non-null one is kept so the exit Grow has content. */
  section: NavFlyoutSection | null;
  open: boolean;
  anchorEl: HTMLElement | null;
  /** id of the panel (referenced by the trigger's `aria-controls`). */
  id: string;
  /** id of the trigger button that opened the panel. */
  triggerId: string;
  pathname: string;
  onClose: () => void;
  /** Set by the menubar when the panel was opened from the keyboard. */
  focusFirstOnOpen: MutableRefObject<boolean>;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  panelRef: RefObject<HTMLDivElement>;
};

const POPPER_OFFSET = 8;
const VIEWPORT_MARGIN = 16;

/**
 * The md+ navigation panel: a portaled Popper anchored to the open trigger.
 * State (which section is open, hover intent, keyboard roving) lives in
 * NavMenu; this component only renders.
 */
const NavFlyout = ({
  section,
  open,
  anchorEl,
  id,
  triggerId,
  pathname,
  onClose,
  focusFirstOnOpen,
  onPointerEnter,
  onPointerLeave,
  panelRef,
}: NavFlyoutProps): JSX.Element | null => {
  const theme = useTheme();

  useEffect(() => {
    if (!open || !focusFirstOnOpen.current) {
      return;
    }
    focusFirstOnOpen.current = false;
    // Next frame: Popper has positioned the panel by then, so focusing the
    // first link never scrolls the page to the unpositioned portal.
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, section, focusFirstOnOpen, panelRef]);

  if (!section) {
    return null;
  }

  // The trigger sits inside the sticky header, so its bottom edge never
  // exceeds the header height: derive the cap from the theme rather than
  // forcing a layout read (getBoundingClientRect) on every render.
  const maxHeight = `calc(100vh - ${
    theme.wc.layout.headerHeight.md + POPPER_OFFSET + VIEWPORT_MARGIN
  }px)`;
  const titleId = `${id}-title`;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="bottom-start"
      transition
      keepMounted={false}
      modifiers={[
        { name: "offset", options: { offset: [0, POPPER_OFFSET] } },
        { name: "flip", enabled: false },
        { name: "preventOverflow", options: { padding: VIEWPORT_MARGIN } },
      ]}
      sx={{ zIndex: (t) => t.zIndex.appBar + 1 }}
    >
      {({ TransitionProps }) => (
        <Grow
          {...TransitionProps}
          timeout={{ enter: 150, exit: 100 }}
          style={{ transformOrigin: "left top" }}
        >
          <Paper
            elevation={8}
            ref={panelRef}
            id={id}
            role="region"
            aria-labelledby={titleId}
            data-trigger={triggerId}
            tabIndex={-1}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            sx={{
              width: { md: 640, lg: 820 },
              maxWidth: "calc(100vw - 32px)",
              bgcolor: "surface.popover",
              border: `1px solid ${theme.palette.border.default}`,
              borderRadius: `${theme.wc.radius.lg}px`,
              boxShadow: theme.palette.glow.popover,
              overflow: "hidden",
              outline: "none",
            }}
          >
            <Box
              sx={{
                p: 2,
                maxHeight,
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
            >
              <Box sx={{ mb: 1.5 }}>
                <Typography
                  id={titleId}
                  component="p"
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  {section.label}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  {section.description}
                </Typography>
              </Box>

              <Box
                component="ul"
                role="list"
                sx={{
                  listStyle: "none",
                  m: 0,
                  p: 0,
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    md: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                  },
                }}
              >
                {section.items.map((item) => {
                  const isCurrent = item.path === pathname;
                  const preload = (): void => preloadRouteChunk(item.path);

                  return (
                    <Box component="li" key={item.id} sx={{ minWidth: 0 }}>
                      <Link
                        component={RouterLink}
                        to={item.path}
                        underline="none"
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={onClose}
                        onPointerEnter={preload}
                        onFocus={preload}
                        sx={{
                          display: "block",
                          p: 1.25,
                          borderRadius: `${theme.wc.radius.md}px`,
                          border: "1px solid transparent",
                          color: "text.primary",
                          transition: theme.transitions.create(
                            ["color", "border-color", "background-color"],
                            {
                              duration: theme.wc.motion.base,
                              easing: theme.wc.motion.easing,
                            },
                          ),
                          "&:hover": {
                            borderColor: theme.palette.border.strong,
                            bgcolor: "action.hover",
                          },
                          '&[aria-current="page"]': {
                            borderColor: "primary.main",
                            bgcolor: "action.selected",
                          },
                          "&:focus-visible": focusRing(theme, true),
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 1,
                          }}
                        >
                          <Typography
                            component="span"
                            variant="subtitle2"
                            sx={{ color: "text.primary", minWidth: 0 }}
                          >
                            {item.label}
                          </Typography>
                          {item.status === "planned" ? (
                            <Chip
                              label="Planned"
                              size="small"
                              variant="outlined"
                              sx={{ flexShrink: 0, color: "text.secondary" }}
                            />
                          ) : null}
                        </Box>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ ...lineClamp(2), mt: 0.25 }}
                        >
                          {item.description}
                        </Typography>
                      </Link>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Paper>
        </Grow>
      )}
    </Popper>
  );
};

export default NavFlyout;
