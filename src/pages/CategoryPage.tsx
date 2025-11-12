import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded"
import UpcomingRoundedIcon from "@mui/icons-material/UpcomingRounded"
import { Alert, AlertTitle, Button, Chip, Paper, Stack, Typography } from "@mui/material"
import { ReactNode, useMemo } from "react"
import { Link as RouterLink, Navigate, useParams } from "react-router-dom"
import SearchExperience from "@/features/search/components/SearchExperience"
import TokenTicker from "@/features/search/components/TokenTicker"
import { SEARCH_CATEGORIES } from "@/features/search/categories"
import { SearchCategoryId } from "@/features/search/types"
import { NAV_SECTIONS, NavFlyoutItem, NavFlyoutSection } from "@/components/layout/navigation/navConfig"

type IndexedNavItem = NavFlyoutItem & { section: NavFlyoutSection }

const NAV_ITEM_INDEX: IndexedNavItem[] = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section }))
)

const isSearchCategory = (value: string): value is SearchCategoryId =>
  SEARCH_CATEGORIES.some((category) => category.id === value)

const findNavItemBySlug = (slug: string): IndexedNavItem | undefined => {
  const pathMatch = `/category-${slug}`
  const hashMatch = `#category-${slug}`
  return NAV_ITEM_INDEX.find((item) => item.path === pathMatch || item.href === hashMatch)
}

const renderContentForSlug = (slug: string): ReactNode => {
  if (isSearchCategory(slug)) {
    return <SearchExperience focusCategoryId={slug} variant="category" />
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

  return undefined
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
  const params = useParams<{ "*": string }>()
  const normalizedSlug = useMemo(() => {
    const raw = params["*"] ?? ""
    const truncated = raw.split("/")[0] ?? ""
    return truncated.replace(/\/+$/, "").trim().toLowerCase()
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
