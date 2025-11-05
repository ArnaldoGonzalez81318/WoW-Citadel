import { AppBar, Box, Button, Chip, Stack, Toolbar } from "@mui/material"
import Logo from "@/components/layout/Logo"
import NavFlyout from "@/components/layout/navigation/NavFlyout"
import HeaderSearch from "@/components/layout/HeaderSearch"

const Header = (): JSX.Element => (
  <AppBar
    position="static"
    color="transparent"
    elevation={0}
    sx={{
      borderBottom: "1px solid rgba(30, 155, 233, 0.1)",
      backdropFilter: "blur(12px)",
      backgroundColor: "transparent",
    }}
  >
    <Toolbar sx={{ py: 2, px: { xs: 2, md: 0 }, gap: { xs: 2, md: 4 } }}>
      <Stack direction="row" spacing={2} alignItems="center" flexGrow={1}>
        <Logo />
        <Chip
          label="Game Data"
          size="small"
          sx={{
            backgroundColor: "rgba(30, 155, 233, 0.12)",
            color: "#8fd3ff",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        />
        <Box sx={{ display: { xs: "flex", lg: "flex" }, flexGrow: { lg: 0 }, mr: { lg: 2 } }}>
          <HeaderSearch />
        </Box>
        <Box sx={{ display: { xs: "none", md: "flex" }, flexGrow: 1 }}>
          <NavFlyout />
        </Box>
      </Stack>
      <Box sx={{ display: { xs: "none", sm: "block" } }}>
        <Button
          variant="outlined"
          color="primary"
          href="https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis"
          target="_blank"
          rel="noreferrer"
        >
          API Reference
        </Button>
      </Box>
    </Toolbar>
  </AppBar>
)

export default Header
