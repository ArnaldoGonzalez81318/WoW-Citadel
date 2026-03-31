import { AppBar, Box, Button, Chip, Container, Stack, Toolbar } from "@mui/material"
import Logo from "@/components/layout/Logo"
import NavFlyout from "@/components/layout/navigation/NavFlyout"
import HeaderSearch from "@/components/layout/HeaderSearch"

const Header = (): JSX.Element => (
  <AppBar
    position="sticky"
    color="transparent"
    elevation={0}
    sx={{
      top: 0,
      borderBottom: "1px solid rgba(30, 155, 233, 0.12)",
      backdropFilter: "blur(18px)",
      background:
        "linear-gradient(180deg, rgba(4, 8, 19, 0.92), rgba(4, 8, 19, 0.78))",
      boxShadow: "0 20px 44px rgba(4, 8, 19, 0.26)",
      "&::after": {
        content: "''",
        position: "absolute",
        inset: "auto 0 0 0",
        height: 1,
        background:
          "linear-gradient(90deg, rgba(30,155,233,0), rgba(30,155,233,0.38), rgba(245,192,69,0.28), rgba(30,155,233,0))",
        pointerEvents: "none",
      },
    }}
  >
    <Container maxWidth="xl" disableGutters>
      <Toolbar
        disableGutters
        sx={{
          minHeight: "auto !important",
          py: { xs: 2, md: 2.5 },
          px: { xs: 2, md: 3 },
          gap: { xs: 1.75, md: 2.25 },
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1.5, sm: 2 }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Logo />
            <Chip
              label="Game Data"
              size="small"
              sx={{
                height: 28,
                px: 0.5,
                borderRadius: 999,
                border: "1px solid rgba(30, 155, 233, 0.16)",
                backgroundColor: "rgba(18, 29, 54, 0.78)",
                color: "#9edbff",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            />
          </Stack>

          <Button
            variant="contained"
            color="primary"
            href="https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis"
            target="_blank"
            rel="noreferrer"
            sx={{
              alignSelf: { xs: "stretch", sm: "center" },
              background: "linear-gradient(135deg, rgba(30,155,233,0.92), rgba(11,79,122,0.96))",
              boxShadow: "0 16px 30px rgba(8, 30, 52, 0.34)",
              border: "1px solid rgba(143, 211, 255, 0.2)",
              "&:hover": {
                background: "linear-gradient(135deg, rgba(76,183,255,0.96), rgba(30,155,233,0.92))",
              },
            }}
          >
            API Reference
          </Button>
        </Stack>

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={{ xs: 1.5, lg: 2 }}
          alignItems={{ xs: "stretch", lg: "center" }}
        >
          <Box sx={{ flex: { lg: "0 1 520px" }, width: { xs: "100%", lg: "auto" } }}>
            <HeaderSearch />
          </Box>
          <Box sx={{ display: { xs: "none", md: "flex" }, flex: 1, minWidth: 0 }}>
            <NavFlyout />
          </Box>
        </Stack>
      </Toolbar>
    </Container>
  </AppBar>
)

export default Header
