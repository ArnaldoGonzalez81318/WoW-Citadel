import { Suspense, lazy } from "react"
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded"
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded"
import HubRoundedIcon from "@mui/icons-material/HubRounded"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded"
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material"
import { useNavigate } from "react-router-dom"
import TokenTicker from "@/features/search/components/TokenTicker"
import { useSearchState } from "@/features/search/context/SearchContext"

const SearchQueryResults = lazy(() => import("@/features/search/components/SearchQueryResults"))

const QUICK_SEARCHES = ["Shadowmourne", "Chaos Bolt", "Onyxia", "Invincible"]

const FEATURED_EXPLORERS = [
  {
    label: "Items",
    description: "Browse item classes, subclasses, and live item samples.",
    path: "/category/items",
  },
  {
    label: "Spells",
    description: "Search live spell records and inspect icons and descriptions.",
    path: "/category/spells",
  },
  {
    label: "Mounts",
    description: "Browse featured mounts or search for specific collection targets.",
    path: "/category/mounts",
  },
  {
    label: "Auction House",
    description: "Check commodities and connected-realm auction activity.",
    path: "/category/auction-house",
  },
  {
    label: "Realms",
    description: "Inspect live realm metadata and connected-realm references.",
    path: "/category/realm",
  },
  {
    label: "Covenants",
    description: "Inspect covenant abilities, soulbind-era data, and rewards.",
    path: "/category/covenant",
  },
  {
    label: "Azerite Essence",
    description: "Explore essences, specs, and rank-by-rank powers.",
    path: "/category/azerite-essence",
  },
]

const HIGHLIGHTS = [
  {
    title: "Focused search",
    description: "Use the header to search items, spells, mounts, and creatures without extra homepage clutter.",
    icon: SearchRoundedIcon,
  },
  {
    title: "Direct explorers",
    description: "Jump straight into the Blizzard API families that already have dedicated views.",
    icon: HubRoundedIcon,
  },
  {
    title: "Live economy pulse",
    description: "Keep the WoW Token market visible without turning the homepage into a dashboard.",
    icon: ShowChartRoundedIcon,
  },
]

const HomePage = (): JSX.Element => {
  const navigate = useNavigate()
  const { query, setQuery } = useSearchState()

  return (
    <Stack spacing={{ xs: 5, md: 8 }}>
      <Paper
        variant="outlined"
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 5,
          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 6 },
          background:
            "linear-gradient(145deg, rgba(8,14,27,0.96) 0%, rgba(13,23,40,0.92) 48%, rgba(25,17,10,0.92) 100%)",
          borderColor: "rgba(255, 196, 88, 0.2)",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.38)",
          "&::before": {
            content: "''",
            position: "absolute",
            inset: "-20% auto auto -10%",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(39, 167, 255, 0.22), transparent 72%)",
            pointerEvents: "none",
          },
          "&::after": {
            content: "''",
            position: "absolute",
            right: -40,
            bottom: -80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 196, 88, 0.18), transparent 70%)",
            pointerEvents: "none",
          },
        }}
      >
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="stretch">
          <Grid item xs={12} md={7}>
            <Stack spacing={3.5} sx={{ position: "relative", zIndex: 1 }}>
              <Chip
                label="World of Warcraft Game Data"
                icon={<AutoAwesomeRoundedIcon />}
                sx={{
                  alignSelf: "flex-start",
                  px: 1,
                  height: 36,
                  borderRadius: 999,
                  backgroundColor: "rgba(255, 196, 88, 0.14)",
                  color: "#ffe1a6",
                  border: "1px solid rgba(255, 196, 88, 0.22)",
                }}
              />
              <Stack spacing={2}>
                <Typography
                  variant="h2"
                  sx={{
                    maxWidth: 680,
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    fontSize: { xs: "2.7rem", md: "4.5rem" },
                  }}
                >
                  Built to explore Azeroth, not overwhelm the homepage.
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ maxWidth: 620, fontSize: { xs: "1rem", md: "1.05rem" } }}
                >
                  Start with a quick search, jump into a dedicated explorer, or check the token market.
                  Everything else stays out of the way until you need it.
                </Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={() => setQuery("Shadowmourne")}
                  endIcon={<SearchRoundedIcon />}
                >
                  Search Shadowmourne
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="large"
                  onClick={() => navigate("/category/items")}
                  endIcon={<ArrowOutwardRoundedIcon />}
                >
                  Open item explorer
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                {QUICK_SEARCHES.map((term) => (
                  <Chip
                    key={term}
                    label={term}
                    onClick={() => setQuery(term)}
                    variant="outlined"
                    sx={{
                      borderRadius: 999,
                      borderColor: "rgba(148, 163, 184, 0.28)",
                      backgroundColor: "rgba(8, 14, 27, 0.58)",
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2} sx={{ position: "relative", zIndex: 1, height: "100%" }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 4,
                  backgroundColor: "rgba(7, 12, 24, 0.72)",
                  borderColor: "rgba(39, 167, 255, 0.18)",
                }}
              >
                <Stack spacing={2.5}>
                  <Typography variant="overline" sx={{ color: "#8fd3ff", letterSpacing: "0.16em" }}>
                    What stays on this page
                  </Typography>
                  {HIGHLIGHTS.map(({ title, description, icon: Icon }) => (
                    <Stack key={title} direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(39, 167, 255, 0.12)",
                          color: "primary.light",
                          flexShrink: 0,
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>
                          {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {description}
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 4,
                  background:
                    "linear-gradient(160deg, rgba(29,20,8,0.92), rgba(12,18,34,0.88))",
                  borderColor: "rgba(255, 196, 88, 0.18)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  flex: 1,
                }}
              >
                <Typography variant="overline" sx={{ color: "secondary.light", letterSpacing: "0.16em" }}>
                  Live entry points
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  The custom explorer set keeps growing.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Items, spells, mounts, realms, auctions, covenants, and essences now have richer custom views before you ever need the raw endpoint workbench.
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {FEATURED_EXPLORERS.map((explorer) => (
          <Grid item xs={12} sm={6} md={3} key={explorer.path}>
            <Paper
              variant="outlined"
              sx={{
                height: "100%",
                p: 3,
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                background:
                  "linear-gradient(180deg, rgba(11,17,31,0.94), rgba(8,13,24,0.88))",
                borderColor: "rgba(39, 167, 255, 0.14)",
                transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                "&:hover": {
                  transform: "translateY(-4px)",
                  borderColor: "rgba(39, 167, 255, 0.3)",
                  boxShadow: "0 22px 44px rgba(0, 0, 0, 0.28)",
                },
              }}
            >
              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {explorer.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {explorer.description}
                </Typography>
              </Stack>
              <Button
                variant="text"
                color="primary"
                onClick={() => navigate(explorer.path)}
                endIcon={<ArrowOutwardRoundedIcon />}
                sx={{ alignSelf: "flex-start", mt: "auto", px: 0.5 }}
              >
                Open explorer
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <TokenTicker />

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          backgroundColor: "rgba(9, 14, 25, 0.76)",
          borderColor: "rgba(148, 163, 184, 0.16)",
        }}
      >
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack spacing={0.75}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Search when you need it
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use the header search for ad hoc lookups. Results only appear here after you search.
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => navigate("/category/auction-house")}
              endIcon={<ArrowOutwardRoundedIcon />}
            >
              Browse auction data
            </Button>
          </Stack>
          <Divider />
          {query.trim() ? (
            <Suspense fallback={<Box sx={{ minHeight: 220 }} />}>
              <SearchQueryResults query={query} compact autoScroll />
            </Suspense>
          ) : (
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              {QUICK_SEARCHES.map((term) => (
                <Chip
                  key={`secondary-${term}`}
                  label={`Search ${term}`}
                  onClick={() => setQuery(term)}
                  clickable
                  sx={{ borderRadius: 999 }}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}

export default HomePage
