import { Suspense, lazy } from "react"
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded"
import UpcomingRoundedIcon from "@mui/icons-material/UpcomingRounded"
import { Alert, AlertTitle, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material"
import { ReactNode, useMemo } from "react"
import { Link as RouterLink, Navigate, useParams } from "react-router-dom"
import TokenTicker from "@/features/search/components/TokenTicker"
import ApiFamilyGallery from "@/features/apiExplorer/components/ApiFamilyGallery"
import { getApiFamilyConfigBySlug } from "@/features/apiExplorer/config/apiCatalog"
import { SEARCH_CATEGORIES } from "@/features/search/categories"
import { SearchCategoryId } from "@/features/search/types"
import { NAV_SECTIONS, NavFlyoutItem, NavFlyoutSection } from "@/components/layout/navigation/navConfig"

type IndexedNavItem = NavFlyoutItem & { section: NavFlyoutSection }

const ItemsPage = lazy(() => import("@/features/items/components/ItemsPage"))
const AuctionHousePage = lazy(() => import("@/features/auctionHouse/components/AuctionHousePage"))
const CovenantPage = lazy(() => import("@/features/covenants/components/CovenantPage"))
const AzeriteEssencePage = lazy(() => import("@/features/azeriteEssences/components/AzeriteEssencePage"))
const SpellsPage = lazy(() => import("@/features/spells/components/SpellsPage"))
const MountsPage = lazy(() => import("@/features/mounts/components/MountsPage"))
const RealmsPage = lazy(() => import("@/features/realms/components/RealmsPage"))
const SearchExperience = lazy(() => import("@/features/search/components/SearchExperience"))

const NAV_ITEM_INDEX: IndexedNavItem[] = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section }))
)

const CategoryLoadingFallback = (): JSX.Element => (
  <Box sx={{ minHeight: "36vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <CircularProgress color="primary" />
  </Box>
)

const renderLazyPage = (node: ReactNode): ReactNode => (
  <Suspense fallback={<CategoryLoadingFallback />}>
    {node}
  </Suspense>
)

const isSearchCategory = (value: string): value is SearchCategoryId =>
  SEARCH_CATEGORIES.some((category) => category.id === value)

const findNavItemBySlug = (slug: string): IndexedNavItem | undefined => {
  const pathMatch = `/category/${slug}`
  const hashMatch = `#category-${slug}`
  return NAV_ITEM_INDEX.find((item) => item.path === pathMatch || item.href === hashMatch)
}

const withFamilyGallery = (slug: string, content?: ReactNode): ReactNode => {
  const family = getApiFamilyConfigBySlug(slug)

  if (!family) {
    return content
  }

  return (
    <Stack spacing={{ xs: 5, md: 6 }}>
      {content ?? null}
      {!content ? <ApiFamilyGallery family={family} /> : null}
    </Stack>
  )
}

const renderContentForSlug = (slug: string): ReactNode => {
  if (slug === "items") {
    return renderLazyPage(<ItemsPage />)
  }

  if (slug === "auction-house") {
    return renderLazyPage(<AuctionHousePage />)
  }

  if (slug === "covenant") {
    return renderLazyPage(<CovenantPage />)
  }

  if (slug === "azerite-essence") {
    return renderLazyPage(<AzeriteEssencePage />)
  }

  if (slug === "spells") {
    return renderLazyPage(<SpellsPage />)
  }

  if (slug === "mounts") {
    return renderLazyPage(<MountsPage />)
  }

  if (slug === "realm") {
    return renderLazyPage(<RealmsPage />)
  }

  if (isSearchCategory(slug)) {
    return renderLazyPage(<SearchExperience focusCategoryId={slug} variant="category" />)
  }

  if (slug === "wow-token") {
    return (
      <Stack spacing={4}>
        <TokenTicker />
        <Alert severity="info" icon={<LaunchRoundedIcon fontSize="small" />} sx={{ borderRadius: 3 }}>
          <AlertTitle>Live market data</AlertTitle>
          Data refreshes every 30 minutes using Blizzard's WoW Token commodity endpoint. Keep the page open to watch regional trends without refreshing the home dashboard.
        </Alert>
      </Stack>
    )
  }

  return withFamilyGallery(slug)
}

const ComingSoonPanel = ({ item }: { item: IndexedNavItem }): JSX.Element => (
  <Paper
    variant="outlined"
    sx={{
      borderRadius: 4,
      p: { xs: 4, md: 5 },
      backgroundColor: "rgba(12, 18, 34, 0.78)",
      borderColor: "rgba(148, 163, 184, 0.25)",
    }}
  >
    <Stack spacing={3}>
      <Chip
        icon={<UpcomingRoundedIcon />}
        label="Explorer in progress"
        color="primary"
        variant="outlined"
        sx={{ alignSelf: "flex-start", borderRadius: 2 }}
      />
      <Typography variant="body1" color="text.secondary">
        We're building a dedicated experience for {item.label}. Expect curated data pulls, filters, and related media once the Blizzard API integration lands. In the meantime, use the global search in the header for quick lookups.
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button
          component={RouterLink}
          to="/"
          variant="outlined"
          color="primary"
          sx={{ borderRadius: 2 }}
        >
          Back to overview
        </Button>
        <Button
          href="https://develop.battle.net/documentation/world-of-warcraft"
          target="_blank"
          rel="noreferrer"
          variant="text"
          color="primary"
          sx={{ borderRadius: 2 }}
          endIcon={<LaunchRoundedIcon fontSize="small" />}
        >
          Blizzard API docs
        </Button>
      </Stack>
    </Stack>
  </Paper>
)

const CategoryPage = (): JSX.Element => {
  const params = useParams<{ slug: string }>()
  const normalizedSlug = useMemo(() => {
    const raw = params.slug ?? ""
    return raw.replace(/\/+$/, "").trim().toLowerCase()
  }, [params])

  const navItem = useMemo(() => (normalizedSlug ? findNavItemBySlug(normalizedSlug) : undefined), [normalizedSlug])

  if (!normalizedSlug || !navItem) {
    return <Navigate to="/" replace />
  }

  const content = renderContentForSlug(normalizedSlug)

  return (
    <Stack spacing={{ xs: 6, md: 8 }}>
      <Stack spacing={1.5}>
        <Typography
          variant="overline"
          sx={{ letterSpacing: "0.28em", color: "secondary.light" }}
        >
          {navItem.section.label}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700 }}>
          {navItem.label}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {navItem.description}
        </Typography>
      </Stack>

      {content ? content : <ComingSoonPanel item={navItem} />}
    </Stack>
  )
}

export default CategoryPage
