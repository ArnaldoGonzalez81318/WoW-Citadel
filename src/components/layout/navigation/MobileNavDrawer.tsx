import CloseRounded from "@mui/icons-material/CloseRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import {
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import Logo from "@/components/layout/Logo";
import RegionBadge from "@/components/layout/RegionBadge";
import {
  NAV_SECTIONS,
  findSectionForPath,
} from "@/components/layout/navigation/navConfig";
import {
  API_REFERENCE_URL,
  preloadRouteChunk,
} from "@/components/layout/navigation/navUtils";

const DRAWER_ID = "mobile-nav";

/**
 * Below md the primary navigation lives in a right-hand drawer: one
 * collapsible group per section, the current section expanded. MUI's Modal
 * traps focus, closes on Escape and restores focus to the hamburger.
 */
const MobileNavDrawer = (): JSX.Element => {
  const theme = useTheme();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    () => findSectionForPath(pathname)?.id ?? null,
  );

  const close = useCallback((): void => setOpen(false), []);

  useEffect(() => {
    setOpen(false);
    const current = findSectionForPath(pathname)?.id;
    if (current) {
      setExpandedId(current);
    }
  }, [pathname]);

  const toggleSection = (id: string): void => {
    setExpandedId((previous) => (previous === id ? null : id));
  };

  const rotate = theme.transitions.create("transform", {
    duration: theme.wc.motion.base,
    easing: theme.wc.motion.easing,
  });

  return (
    <>
      <IconButton
        aria-label="Open navigation"
        aria-controls={open ? DRAWER_ID : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        size="large"
        onClick={() => setOpen(true)}
        sx={{ display: { xs: "inline-flex", md: "none" } }}
      >
        <MenuRounded />
      </IconButton>

      <Drawer
        anchor="right"
        id={DRAWER_ID}
        open={open}
        onClose={close}
        slotProps={{
          paper: {
            // The hamburger promises a dialog (aria-haspopup): give the
            // trapped, Escape-closable paper that role and a name.
            role: "dialog",
            "aria-modal": true,
            "aria-label": "Site navigation",
            sx: {
              width: "min(360px, 88vw)",
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 2,
            minHeight: theme.wc.layout.headerHeight.xs,
            borderBottom: `1px solid ${theme.palette.border.subtle}`,
          }}
        >
          <Logo />
          <IconButton aria-label="Close navigation" onClick={close} edge="end">
            <CloseRounded />
          </IconButton>
        </Box>

        <Box
          component="nav"
          aria-label="Primary"
          sx={{
            flex: 1,
            overflowY: "auto",
            overscrollBehavior: "contain",
            py: 1,
          }}
        >
          <List disablePadding sx={{ px: 1 }}>
            {NAV_SECTIONS.map((section) => {
              const expanded = expandedId === section.id;
              const groupId = `${DRAWER_ID}-${section.id}`;

              return (
                <Box component="li" key={section.id} sx={{ listStyle: "none" }}>
                  <ListItemButton
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={expanded}
                    aria-controls={expanded ? groupId : undefined}
                    sx={{ minHeight: theme.wc.layout.touchTarget, gap: 1 }}
                  >
                    <ListItemText
                      primary={section.label}
                      slotProps={{
                        primary: {
                          variant: "subtitle2",
                          color: "text.primary",
                        },
                      }}
                    />
                    <ExpandMoreRounded
                      sx={{
                        color: "text.secondary",
                        transition: rotate,
                        transform: expanded ? "rotate(180deg)" : "none",
                      }}
                    />
                  </ListItemButton>
                  {/* Collapsed groups stay unmounted: ~30 RouterLink rows are not worth rendering at height 0 on every open. */}
                  <Collapse
                    in={expanded}
                    timeout={theme.wc.motion.base}
                    mountOnEnter
                    unmountOnExit
                  >
                    <List id={groupId} disablePadding sx={{ pb: 1 }}>
                      {section.items.map((item) => {
                        const isCurrent = item.path === pathname;
                        const preload = (): void =>
                          preloadRouteChunk(item.path);

                        return (
                          <ListItem key={item.id} disablePadding>
                            <ListItemButton
                              component={RouterLink}
                              to={item.path}
                              selected={isCurrent}
                              aria-current={isCurrent ? "page" : undefined}
                              // Close before the Link navigates: the Modal's
                              // focus restore (to the hamburger) then runs in
                              // this commit's cleanup phase, ahead of
                              // AppShell's route-change focus on `main`.
                              // Closing from the pathname effect instead
                              // would restore focus one commit later and
                              // undo it.
                              onClick={close}
                              onPointerEnter={preload}
                              onFocus={preload}
                              sx={{
                                minHeight: theme.wc.layout.touchTarget,
                                pl: 3,
                                color: isCurrent
                                  ? "text.primary"
                                  : "text.secondary",
                                "&:hover": { color: "text.primary" },
                              }}
                            >
                              <ListItemText
                                primary={item.label}
                                slotProps={{ primary: { variant: "body2" } }}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </Box>

        <Divider />
        <Box
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1.5,
          }}
        >
          <RegionBadge />
          <Button
            variant="outlined"
            size="small"
            href={API_REFERENCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewRounded fontSize="small" />}
            aria-label="Blizzard Game Data API reference (opens in a new tab)"
          >
            API Reference
          </Button>
        </Box>
      </Drawer>
    </>
  );
};

export default MobileNavDrawer;
