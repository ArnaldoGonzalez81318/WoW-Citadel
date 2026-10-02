import CloseRounded from "@mui/icons-material/CloseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import {
  Box,
  Dialog,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";

import { isTypingTarget } from "@/components/layout/navigation/navUtils";
import SearchCombobox, {
  SEARCH_KEY_SHORTCUTS,
} from "@/components/search/SearchCombobox";
import {
  focusPrimarySearch,
  usePrimarySearchInView,
} from "@/components/search/primarySearch";

/* ------------------------------------------------------------------ */
/* HeaderSearch                                                        */
/* ------------------------------------------------------------------ */

const DIALOG_TITLE_ID = "site-search-dialog-title";

/**
 * Inline combobox at md+, a full-screen search dialog below. `/` and
 * Ctrl/Cmd+K focus the field (or open the dialog). On a page that registers
 * a primary search (the home hero), they focus that field instead while it
 * is on screen, and the inline field steps aside so only one search shows.
 */
const HeaderSearch = (): JSX.Element => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const heroInView = usePrimarySearchInView();
  const [dialogOpen, setDialogOpen] = useState(false);
  const inlineRef = useRef<HTMLDivElement | null>(null);
  const dialogBodyRef = useRef<HTMLDivElement | null>(null);

  const closeDialog = useCallback((): void => setDialogOpen(false), []);

  /**
   * The field's `autoFocus` fires on mount, but the Modal's FocusTrap can
   * still end up on its container (StrictMode replays its mount effect, which
   * restores focus to the trigger and then re-traps on the container). Once
   * the transition has settled, make sure the field really has focus.
   */
  const focusDialogField = useCallback((): void => {
    const input = dialogBodyRef.current?.querySelector("input");
    if (input && document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      const isCommandK =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k";
      const isSlash =
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target);

      if (!isCommandK && !isSlash) {
        return;
      }
      event.preventDefault();

      if (focusPrimarySearch()) {
        return;
      }

      if (isDesktop) {
        inlineRef.current?.querySelector("input")?.focus();
        return;
      }
      setDialogOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop]);

  return (
    <>
      <Box
        role="search"
        aria-label="Site search"
        ref={inlineRef}
        sx={(t) => ({
          display: { xs: "none", md: "block" },
          flex: "1 1 auto",
          minWidth: { md: 200, lg: 240 },
          maxWidth: 440,
          ml: "auto",
          transition: t.transitions.create(["opacity", "visibility"], {
            duration: t.wc.motion.base,
            easing: t.wc.motion.easing,
          }),
          // `visibility`, not `display`: the toolbar keeps its layout, and the
          // hidden landmark leaves the accessibility tree and the tab order.
          // A field that already holds focus is never hidden under the user.
          ...(heroInView
            ? {
                opacity: 0,
                visibility: "hidden",
                "&:focus-within": { opacity: 1, visibility: "visible" },
              }
            : {}),
        })}
      >
        <Tooltip
          title="Press / to search"
          describeChild
          disableFocusListener
          enterDelay={600}
        >
          <Box>
            <SearchCombobox id="site-search" keyShortcuts={SEARCH_KEY_SHORTCUTS} />
          </Box>
        </Tooltip>
      </Box>

      <IconButton
        aria-label="Open search"
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        size="large"
        onClick={() => setDialogOpen(true)}
        sx={{ display: { xs: "inline-flex", md: "none" }, ml: "auto" }}
      >
        <SearchRounded />
      </IconButton>

      <Dialog
        fullScreen
        open={dialogOpen}
        onClose={closeDialog}
        aria-labelledby={DIALOG_TITLE_ID}
        slotProps={{ transition: { onEntered: focusDialogField } }}
      >
        <Toolbar
          sx={{
            minHeight: theme.wc.layout.headerHeight.xs,
            gap: 1,
            borderBottom: `1px solid ${theme.palette.border.subtle}`,
          }}
        >
          <Typography
            id={DIALOG_TITLE_ID}
            component="h2"
            variant="h6"
            sx={{ flex: 1 }}
          >
            Search
          </Typography>
          <IconButton
            aria-label="Close search"
            onClick={closeDialog}
            edge="end"
          >
            <CloseRounded />
          </IconButton>
        </Toolbar>
        <Box
          role="search"
          aria-label="Site search"
          ref={dialogBodyRef}
          sx={{ p: 2 }}
        >
          <SearchCombobox
            id="site-search-dialog"
            autoFocus
            onNavigated={closeDialog}
            size="medium"
          />
        </Box>
      </Dialog>
    </>
  );
};

export default HeaderSearch;
