import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded"
import MonetizationOnRoundedIcon from "@mui/icons-material/MonetizationOnRounded"
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded"
import { Box, Button, CircularProgress, Paper, Stack, Tooltip, Typography } from "@mui/material"
import { useMemo } from "react"
import { useWowTokenPrice } from "@/features/search/hooks/useWowTokenPrice"
import { env } from "@/lib/env"

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const relativeTime = (now: Date, updatedAt: Date): string => {
  const diffMs = now.getTime() - updatedAt.getTime()
  if (Number.isNaN(diffMs)) {
    return "Unknown"
  }

  const diffMinutes = Math.round(diffMs / (1000 * 60))
  if (diffMinutes < 1) {
    return "just now"
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`
  }

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
}

const TokenTicker = (): JSX.Element => {
  const { data, isLoading, isError, error, refetch, isFetching } = useWowTokenPrice()

  const formattedPrice = useMemo(() => {
    if (!data) {
      return "--"
    }

    const totalCopper = data.price
    const gold = Math.floor(totalCopper / 10000)
    const silver = Math.floor((totalCopper % 10000) / 100)
    const copper = totalCopper % 100

    const paddedSilver = silver.toString().padStart(2, "0")
    const paddedCopper = copper.toString().padStart(2, "0")

    return `${formatter.format(gold)}g ${paddedSilver}s ${paddedCopper}c`
  }, [data])

  const lastUpdated = useMemo(() => {
    if (!data) {
      return ""
    }

    return relativeTime(new Date(), data.lastUpdated)
  }, [data])

  const friendlyError = useMemo(() => {
    if (!error) {
      return undefined
    }

    if (error.name === "BlizzardRequestError") {
      return "Unable to reach Blizzard’s token service. Confirm your Blizzard API credentials in the .env file and try again."
    }

    return error.message
  }, [error])

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 4,
        px: { xs: 3, md: 5 },
        py: { xs: 3, md: 4 },
        background:
          "linear-gradient(135deg, rgba(42, 182, 246, 0.12), rgba(245, 192, 69, 0.08))",
        borderColor: "rgba(30, 155, 233, 0.28)",
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="center">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, rgba(245, 192, 69, 0.2), rgba(52, 211, 153, 0.1))",
              border: "1px solid rgba(245, 192, 69, 0.45)",
            }}
          >
            <MonetizationOnRoundedIcon sx={{ fontSize: 32, color: "warning.light" }} />
          </Box>
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ letterSpacing: "0.18em", color: "secondary.light" }}>
              WoW Token Market Watch
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "warning.light",
                textShadow: "0 6px 18px rgba(245, 192, 69, 0.35)",
                whiteSpace: "nowrap",
              }}
            >
              {formattedPrice}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {data ? `Updated ${lastUpdated}` : "Awaiting latest trade"}
            </Typography>
          </Stack>
        </Stack>
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          {isError ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <WarningAmberRoundedIcon color="warning" fontSize="small" />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {friendlyError ?? "Unable to fetch the WoW Token just now. Try refreshing."}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Keep an eye on Azeroth&apos;s economy. Prices reflect region {env.region.toUpperCase()} with {" "}
              <Typography component="span" variant="body2" color="text.primary" fontWeight={600}>
                {data ? formatter.format(Math.floor(data.price / 10000)) : "--"}
              </Typography>{" "}
              gold per token. Perfect for comparing profession profits against subscription costs.
            </Typography>
          )}
          <Tooltip title="Refresh token price">
            <span>
              <Button
                variant="outlined"
                size="small"
                onClick={() => refetch()}
                disabled={isLoading || isFetching}
                startIcon={
                  isFetching ? <CircularProgress size={16} thickness={5} /> : <AutorenewRoundedIcon />
                }
                sx={{ alignSelf: { xs: "flex-start", md: "flex-end" } }}
              >
                {isFetching ? "Refreshing" : "Refresh price"}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  )
}

export default TokenTicker
