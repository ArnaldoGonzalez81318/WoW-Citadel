import ArrowCircleDownRoundedIcon from "@mui/icons-material/ArrowCircleDownRounded"
import UpcomingRoundedIcon from "@mui/icons-material/UpcomingRounded"
import { Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material"
import { useCallback, useMemo } from "react"
import { NAV_SECTIONS } from "@/components/layout/navigation/navConfig"
import { SEARCH_CATEGORIES } from "@/features/search/categories"

const CategoryShowcase = (): JSX.Element => {
  const supportedAnchors = useMemo(
    () => new Set(SEARCH_CATEGORIES.map((category) => `category-${category.id}`)),
    []
  )

  const handleJump = useCallback((anchorId: string) => {
    const element = document.getElementById(anchorId)

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
      window.history.replaceState(null, "", `#${anchorId}`)
      return
    }

    window.location.hash = anchorId
  }, [])

  return (
    <Stack spacing={4}>
      <Stack spacing={1.5}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Explore the Warcraft knowledge base
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Use the navigation flyout or the cards below to dive directly into the data sets you care about. Supported categories link straight to their rich search results.
        </Typography>
      </Stack>
      <Stack spacing={4}>
        {NAV_SECTIONS.map((section) => (
          <Stack key={section.id} spacing={2}>
            <Typography variant="subtitle1" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.18em" }}>
              {section.label}
            </Typography>
            <Grid container spacing={2} columns={{ xs: 1, sm: 6, md: 12 }}>
              {section.items.map((item) => {
                const anchorId = item.href.replace("#", "")
                const isSupported = supportedAnchors.has(anchorId)

                return (
                  <Grid item xs={1} sm={3} md={4} key={item.id}>
                    <Paper
                      id={anchorId}
                      variant="outlined"
                      sx={{
                        height: "100%",
                        borderRadius: 3,
                        p: 3,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        backgroundColor: "rgba(12, 18, 34, 0.75)",
                        borderColor: isSupported
                          ? "rgba(30, 155, 233, 0.35)"
                          : "rgba(30, 155, 233, 0.14)",
                        scrollMarginTop: 120,
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {item.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.description}
                        </Typography>
                      </Stack>
                      {isSupported ? (
                        <Button
                          variant="text"
                          color="primary"
                          endIcon={<ArrowCircleDownRoundedIcon fontSize="small" />}
                          onClick={() => handleJump(anchorId)}
                          sx={{ alignSelf: "flex-start" }}
                        >
                          Jump to live results
                        </Button>
                      ) : (
                        <Chip
                          icon={<UpcomingRoundedIcon />}
                          label="On the roadmap"
                          variant="outlined"
                          sx={{
                            alignSelf: "flex-start",
                            borderRadius: 2,
                            borderColor: "rgba(148, 163, 184, 0.35)",
                            color: "text.secondary",
                          }}
                        />
                      )}
                    </Paper>
                  </Grid>
                )
              })}
            </Grid>
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}

export default CategoryShowcase
