import DataObjectRoundedIcon from "@mui/icons-material/DataObjectRounded"
import HomeRoundedIcon from "@mui/icons-material/HomeRounded"
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded"
import TravelExploreRoundedIcon from "@mui/icons-material/TravelExploreRounded"
import { Box, Chip, Container, Divider, Link, Stack, Typography } from "@mui/material"
import { Link as RouterLink } from "react-router-dom"

const FOOTER_NAV_LINKS = [
  { label: "Home", path: "/", icon: HomeRoundedIcon },
  { label: "Items", path: "/category/items", icon: TravelExploreRoundedIcon },
  { label: "Mounts", path: "/category/mounts", icon: TravelExploreRoundedIcon },
  { label: "Auction House", path: "/category/auction-house", icon: TravelExploreRoundedIcon },
]

const FOOTER_RESOURCE_LINKS = [
  {
    label: "GitHub Repository",
    href: "https://github.com/ArnaldoGonzalez81318/WoW-Citadel",
  },
  {
    label: "Blizzard API Portal",
    href: "https://develop.battle.net/",
  },
  {
    label: "Game Data Docs",
    href: "https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis",
  },
]

const Footer = (): JSX.Element => (
  <Box
    component="footer"
    sx={{
      mt: { xs: 6, md: 8 },
      pt: { xs: 4, md: 5 },
      pb: { xs: 5, md: 6 },
      position: "relative",
      borderTop: "1px solid rgba(30, 155, 233, 0.12)",
      background:
        "linear-gradient(180deg, rgba(5, 8, 19, 0.2), rgba(8, 13, 24, 0.88) 22%, rgba(7, 12, 24, 0.98) 100%)",
      "&::before": {
        content: "''",
        position: "absolute",
        inset: "0 0 auto 0",
        height: 1,
        background:
          "linear-gradient(90deg, rgba(30,155,233,0), rgba(30,155,233,0.34), rgba(245,192,69,0.26), rgba(30,155,233,0))",
        pointerEvents: "none",
      },
    }}
  >
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={{ xs: 3, lg: 5 }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "stretch" }}
        >
          <Stack spacing={2.25} sx={{ maxWidth: 460 }}>
            <Chip
              icon={<DataObjectRoundedIcon />}
              label="Warcraft Data Hub"
              sx={{
                alignSelf: "flex-start",
                borderRadius: 999,
                border: "1px solid rgba(30, 155, 233, 0.18)",
                backgroundColor: "rgba(18, 29, 54, 0.72)",
                color: "#9edbff",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            />
            <Stack spacing={1}>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
                WoW Citadel keeps Blizzard&apos;s live game data readable.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Explore curated Warcraft tools for items, spells, mounts, realms, auctions, and more without dropping into raw endpoint payloads unless you want to.
              </Typography>
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 3, md: 6 }} sx={{ flexShrink: 0 }}>
            <Stack spacing={1.5}>
              <Typography variant="overline" sx={{ color: "#8fd3ff", letterSpacing: "0.18em" }}>
                Explore
              </Typography>
              {FOOTER_NAV_LINKS.map(({ label, path, icon: Icon }) => (
                <Link
                  key={path}
                  component={RouterLink}
                  to={path}
                  underline="none"
                  color="text.secondary"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    transition: "color 0.18s ease, transform 0.18s ease",
                    "&:hover": {
                      color: "text.primary",
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                  {label}
                </Link>
              ))}
            </Stack>

            <Stack spacing={1.5}>
              <Typography variant="overline" sx={{ color: "secondary.light", letterSpacing: "0.18em" }}>
                Resources
              </Typography>
              {FOOTER_RESOURCE_LINKS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  underline="none"
                  color="text.secondary"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    transition: "color 0.18s ease, transform 0.18s ease",
                    "&:hover": {
                      color: "text.primary",
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  <LaunchRoundedIcon sx={{ fontSize: 18 }} />
                  {label}
                </Link>
              ))}
            </Stack>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: "rgba(30, 155, 233, 0.1)" }} />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
            Data powered by Blizzard Entertainment. World of Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard Entertainment, Inc. WoW Citadel is an independent fan-built explorer and is not affiliated with or endorsed by Blizzard Entertainment.
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(156, 167, 199, 0.72)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Built for live game data browsing
          </Typography>
        </Stack>
      </Stack>
    </Container>
  </Box>
)

export default Footer
