import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import { Box, Button, ClickAwayListener, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useLocation } from "react-router-dom";

import type { NavFlyoutSection } from "@/components/layout/navigation/navConfig";
import {
  NAV_SECTIONS,
  findSectionForPath,
} from "@/components/layout/navigation/navConfig";
import NavFlyout from "@/components/layout/navigation/NavFlyout";
import {
  isMouseLike,
  preloadRouteChunk,
} from "@/components/layout/navigation/navUtils";
import { useHoverIntent } from "@/components/layout/navigation/useHoverIntent";

const PANEL_ID = "primary-nav-panel";

const triggerIdFor = (sectionId: string): string => `nav-trigger-${sectionId}`;

const sectionById = (id: string | null): NavFlyoutSection | null =>
  id ? (NAV_SECTIONS.find((section) => section.id === id) ?? null) : null;

/**
 * The md+ menubar: one text button per section, a single portaled panel.
 * Hover intent, click toggle, full keyboard support (Escape, arrows,
 * Home/End, Tab out) and close-on-route-change all live here; NavFlyout
 * only renders the open section.
 */
const NavMenu = (): JSX.Element => {
  const theme = useTheme();
  const { pathname } = useLocation();
  /**
   * Header hides this menubar with CSS below md, so the trigger buttons stay
   * mounted but leave layout (zero rect). Read live (useSyncExternalStore) so
   * the very render that follows a breakpoint crossing already reports the
   * panel closed: Popper never sees `open` with a display:none anchor.
   */
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const focusFirstOnOpen = useRef(false);
  const navRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  /** Last opened section, kept so the exit Grow still has content. */
  const lastSectionRef = useRef<NavFlyoutSection | null>(null);

  const currentSectionId = useMemo(
    () => findSectionForPath(pathname)?.id ?? null,
    [pathname],
  );

  const openSection = sectionById(openId) ?? lastSectionRef.current;
  if (openId) {
    lastSectionRef.current = sectionById(openId);
  }

  const close = useCallback((): void => {
    focusFirstOnOpen.current = false;
    setOpenId(null);
  }, []);

  const openNow = useCallback(
    (id: string, element: HTMLElement | null): void => {
      if (element) {
        setAnchorEl(element);
      }
      setOpenId(id);
    },
    [],
  );

  const hover = useHoverIntent({
    onOpen: (id) => openNow(id, triggerRefs.current.get(id) ?? null),
    onClose: close,
  });

  const focusTrigger = useCallback((id: string | null): void => {
    if (!id) {
      return;
    }
    triggerRefs.current.get(id)?.focus();
  }, []);

  /* Close on route change and on viewport resize (the anchor moves). */
  useEffect(() => {
    close();
  }, [pathname, close]);

  /* Below md the menubar is display:none; drop the stale open state too. */
  useEffect(() => {
    if (!isMdUp) {
      close();
    }
  }, [isMdUp, close]);

  useEffect(() => {
    if (!openId) {
      return undefined;
    }
    const handleResize = (): void => close();
    /**
     * The nav's own onKeyDown only sees keys while focus is inside the nav or
     * the portaled panel. A hover-opened panel with focus on `main` needs
     * this document listener; focus is left where it is (no trigger to
     * return to) and the in-nav handler keeps owning the focused case.
     */
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Node &&
        (navRef.current?.contains(target) || panelRef.current?.contains(target))
      ) {
        return;
      }
      hover.clearAll();
      close();
    };
    window.addEventListener("resize", handleResize);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [openId, close, hover]);

  const registerTrigger = useCallback(
    (id: string) => (node: HTMLButtonElement | null) => {
      if (node) {
        triggerRefs.current.set(id, node);
      } else {
        triggerRefs.current.delete(id);
      }
    },
    [],
  );

  const preloadSection = (section: NavFlyoutSection): void => {
    const first = section.items[0];
    if (first) {
      preloadRouteChunk(first.path);
    }
  };

  const handleTriggerPointerEnter =
    (section: NavFlyoutSection) =>
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      preloadSection(section);
      if (!isMouseLike(event)) {
        return;
      }
      // A hover-driven open must never pull keyboard focus into the panel.
      focusFirstOnOpen.current = false;
      hover.cancelClose();
      if (openId) {
        // A panel is already showing: switch sections without the intent delay.
        hover.cancelOpen();
        openNow(section.id, event.currentTarget);
        return;
      }
      hover.scheduleOpen(section.id);
    };

  const handleTriggerClick =
    (section: NavFlyoutSection) =>
    (event: MouseEvent<HTMLButtonElement>): void => {
      hover.clearAll();
      if (openId === section.id) {
        close();
        return;
      }
      openNow(section.id, event.currentTarget);
    };

  const handleTriggerFocus = (section: NavFlyoutSection) => (): void => {
    // Focus never opens the panel (mousedown focus + click would toggle twice).
    preloadSection(section);
  };

  const handleNavPointerEnter = (
    event: ReactPointerEvent<HTMLElement>,
  ): void => {
    if (isMouseLike(event)) {
      hover.cancelClose();
    }
  };

  const handleNavPointerLeave = (
    event: ReactPointerEvent<HTMLElement>,
  ): void => {
    if (!isMouseLike(event)) {
      return;
    }
    hover.cancelOpen();
    if (openId) {
      hover.scheduleClose();
    }
  };

  const triggerButtons = (): HTMLButtonElement[] =>
    navRef.current
      ? Array.from(navRef.current.querySelectorAll<HTMLButtonElement>("button"))
      : [];

  const sectionIdOfTrigger = (button: HTMLElement): string | null =>
    NAV_SECTIONS.find((section) => triggerIdFor(section.id) === button.id)
      ?.id ?? null;

  /**
   * Portal events bubble through the React tree, so keys pressed inside the
   * panel arrive here too.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement;
    const isTrigger =
      target instanceof HTMLButtonElement &&
      sectionIdOfTrigger(target) !== null;
    const inPanel = Boolean(panelRef.current?.contains(target));

    if (event.key === "Escape") {
      if (!openId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const id = openId;
      close();
      focusTrigger(id);
      return;
    }

    if (isTrigger) {
      const sectionId = sectionIdOfTrigger(target);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!sectionId) {
          return;
        }
        hover.clearAll();
        if (openId === sectionId) {
          // Already open: no state change would re-run NavFlyout's focus
          // effect, so move focus into the panel directly.
          panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
          return;
        }
        focusFirstOnOpen.current = true;
        openNow(sectionId, target);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        // The native click toggles the panel; flag keyboard origin so the
        // first link receives focus once it opens.
        focusFirstOnOpen.current = openId !== sectionId;
        return;
      }
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      const buttons = triggerButtons();
      if (buttons.length === 0) {
        return;
      }
      const activeIndex = isTrigger
        ? buttons.indexOf(target as HTMLButtonElement)
        : buttons.findIndex((button) => sectionIdOfTrigger(button) === openId);
      if (activeIndex < 0 && !isTrigger && !inPanel) {
        return;
      }
      event.preventDefault();
      let nextIndex = activeIndex;
      if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = buttons.length - 1;
      } else {
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        nextIndex = (activeIndex + delta + buttons.length) % buttons.length;
      }
      const nextButton = buttons[nextIndex];
      nextButton.focus();
      if (openId) {
        const nextId = sectionIdOfTrigger(nextButton);
        if (nextId) {
          focusFirstOnOpen.current = inPanel;
          openNow(nextId, nextButton);
        }
      }
      return;
    }

    if (event.key === "Tab" && openId && inPanel) {
      const links = panelRef.current
        ? Array.from(panelRef.current.querySelectorAll<HTMLAnchorElement>("a"))
        : [];
      const first = links[0];
      const last = links[links.length - 1];
      const leaving = event.shiftKey ? target === first : target === last;
      if (leaving) {
        // The panel is portaled to the end of <body>, so the natural Tab
        // target would be outside the document: return focus to the trigger.
        event.preventDefault();
        const id = openId;
        close();
        focusTrigger(id);
      }
    }
  };

  const handleClickAway = (event: Event): void => {
    if (!openId) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && panelRef.current?.contains(target)) {
      return;
    }
    close();
  };

  const handleNavBlur = (event: FocusEvent<HTMLElement>): void => {
    // Focus moved outside both the nav and the panel (e.g. into the search
    // field): close without stealing focus back.
    const next = event.relatedTarget;
    if (!openId || !(next instanceof Node)) {
      return;
    }
    if (navRef.current?.contains(next) || panelRef.current?.contains(next)) {
      return;
    }
    close();
  };

  const rotate = theme.transitions.create("transform", {
    duration: theme.wc.motion.base,
    easing: theme.wc.motion.easing,
  });

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        component="nav"
        aria-label="Primary"
        ref={navRef}
        onKeyDown={handleKeyDown}
        onPointerEnter={handleNavPointerEnter}
        onPointerLeave={handleNavPointerLeave}
        onBlur={handleNavBlur}
        sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}
      >
        {NAV_SECTIONS.map((section) => {
          const isOpen = openId === section.id;
          const isCurrent = section.id === currentSectionId;

          return (
            <Button
              key={section.id}
              ref={registerTrigger(section.id)}
              id={triggerIdFor(section.id)}
              size="small"
              color="inherit"
              variant="text"
              aria-haspopup="true"
              aria-expanded={isOpen}
              aria-controls={isOpen ? PANEL_ID : undefined}
              data-current={isCurrent || undefined}
              onPointerEnter={handleTriggerPointerEnter(section)}
              onPointerLeave={hover.cancelOpen}
              onClick={handleTriggerClick(section)}
              onFocus={handleTriggerFocus(section)}
              endIcon={
                <ExpandMoreRounded
                  sx={{
                    transition: rotate,
                    transform: isOpen ? "rotate(180deg)" : "none",
                  }}
                />
              }
              sx={{
                color: isOpen || isCurrent ? "text.primary" : "text.secondary",
                whiteSpace: "nowrap",
                flexShrink: 0,
                bgcolor: isOpen ? "action.selected" : "transparent",
                boxShadow:
                  isCurrent && !isOpen
                    ? `inset 0 -2px 0 ${theme.palette.primary.main}`
                    : "none",
                "&:hover": {
                  bgcolor: isOpen ? "action.selected" : "action.hover",
                  color: "text.primary",
                },
              }}
            >
              {section.shortLabel}
            </Button>
          );
        })}

        <NavFlyout
          section={openSection}
          open={Boolean(openId) && isMdUp}
          anchorEl={anchorEl}
          id={PANEL_ID}
          triggerId={triggerIdFor(openId ?? openSection?.id ?? "")}
          pathname={pathname}
          onClose={close}
          focusFirstOnOpen={focusFirstOnOpen}
          onPointerEnter={hover.cancelClose}
          onPointerLeave={hover.scheduleClose}
          panelRef={panelRef}
        />
      </Box>
    </ClickAwayListener>
  );
};

export default NavMenu;
