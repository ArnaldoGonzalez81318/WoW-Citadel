import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded"
import { Box, Paper, Stack, Typography } from "@mui/material"
import { useLocation } from "react-router-dom"
import { usePerformanceOverlayEntries } from "@/devtools/PerformanceOverlayContext"

const PerformanceOverlay = (): JSX.Element | null => {
  const entries = usePerformanceOverlayEntries()
  const location = useLocation()

  if (!import.meta.env.DEV || entries.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 1600,
        width: 320,
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3,
          borderColor: "rgba(56, 189, 248, 0.28)",
          backgroundColor: "rgba(7, 12, 24, 0.92)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.34)",
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SpeedRoundedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Gallery Diagnostics
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {location.pathname}
          </Typography>
          {entries.map((entry) => (
            <Stack key={entry.id} spacing={0.35}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.light" }}>
                {entry.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Rendered {entry.renderedCount ?? 0} / {entry.totalCount ?? 0}
              </Typography>
              {typeof entry.enrichmentCount === "number" ? (
                <Typography variant="caption" color="text.secondary">
                  Enrichment window {entry.enrichmentCount}
                </Typography>
              ) : null}
              {entry.notes ? (
                <Typography variant="caption" color="text.secondary">
                  {entry.notes}
                </Typography>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Box>
  )
}

export default PerformanceOverlay