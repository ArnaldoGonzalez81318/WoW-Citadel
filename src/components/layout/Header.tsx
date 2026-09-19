import { AppBar, Box, Container, Toolbar } from "@mui/material";

import HeaderSearch from "@/components/layout/HeaderSearch";
import Logo from "@/components/layout/Logo";
import MobileNavDrawer from "@/components/layout/navigation/MobileNavDrawer";
import NavMenu from "@/components/layout/navigation/NavMenu";

/**
 * One sticky, opaque row (56px xs / 64px md+). The theme's MuiAppBar
 * override supplies the background, the subtle bottom border and removes
 * the shadow; nothing here paints its own surface.
 *
 * Order: logo, section menubar (md+), search (inline at md+, an icon that
 * opens a dialog below), hamburger (below md).
 */
const Header = (): JSX.Element => (
  <AppBar position="sticky" color="default" elevation={0}>
    <Container maxWidth="xl">
      <Toolbar
        disableGutters
        sx={(theme) => ({
          minHeight: theme.wc.layout.headerHeight.xs,
          [theme.breakpoints.up("md")]: {
            minHeight: theme.wc.layout.headerHeight.md,
          },
          gap: { xs: 1, md: 2 },
        })}
      >
        <Logo />
        <Box sx={{ display: { xs: "none", md: "flex" }, minWidth: 0 }}>
          <NavMenu />
        </Box>
        <HeaderSearch />
        <MobileNavDrawer />
      </Toolbar>
    </Container>
  </AppBar>
);

export default Header;
