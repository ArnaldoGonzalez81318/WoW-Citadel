import { Box, Container } from "@mui/material";
import { useEffect, useRef } from "react";
import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { MAIN_PADDING_TOP } from "@/components/layout/layoutMetrics";

/**
 * Header, main landmark and footer. The body paints the only background
 * (theme CssBaseline); nothing here adds a wash, an overlay layer or debug UI.
 *
 * RootLayout owns the skip link and the `#main-content` target, and the
 * router's ScrollRestoration owns scroll position. This shell only moves
 * keyboard focus to `main` after a route change so the next Tab starts in
 * the new page rather than deep inside the header.
 */
const AppShell = ({ children }: PropsWithChildren): JSX.Element => {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  /**
   * Compared against the current pathname rather than a "first render" flag:
   * StrictMode re-runs mount effects (refs intact), and a boolean guard would
   * focus `main` on the initial load, pushing the skip link out of the first
   * Tab stop.
   */
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }
    previousPathname.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        "@supports (height: 100dvh)": { minHeight: "100dvh" },
        display: "flex",
        flexDirection: "column",
        // Transparent on purpose: body paints background.default plus the one
        // radial wash (CssBaseline); an opaque shell would hide it.
      }}
    >
      <Header />
      <Container
        component="main"
        ref={mainRef}
        tabIndex={-1}
        maxWidth="xl"
        sx={(theme) => ({
          flex: 1,
          pt: MAIN_PADDING_TOP,
          pb: { xs: 6, md: 8 },
          outline: "none",
          // Responsive object, not a `breakpoints.up` key: an explicit media
          // key after `pt`/`pb` would replace their md values in this sx.
          scrollMarginTop: {
            xs: theme.wc.layout.headerHeight.xs,
            md: theme.wc.layout.headerHeight.md,
          },
        })}
      >
        {children}
      </Container>
      <Footer />
    </Box>
  );
};

export default AppShell;
