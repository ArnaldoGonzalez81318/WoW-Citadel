import GavelRoundedIcon from "@mui/icons-material/GavelRounded"
import PaidRoundedIcon from "@mui/icons-material/PaidRounded"
import PublicRoundedIcon from "@mui/icons-material/PublicRounded"
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded"
import {
  Alert,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ResultCard from "@/components/common/ResultCard"
import { fetchConnectedRealmSnapshots } from "@/features/connectedRealms/services/connectedRealmService"
import {
  fetchCommoditySnapshots,
  fetchConnectedRealmAuctionSnapshots,
} from "@/features/auctionHouse/services/auctionHouseService"
import { env } from "@/lib/env"
import { BlizzardRequestError } from "@/lib/blizzardClient"

const REALM_SAMPLE_SIZE = 10
const VIEW_OPTIONS = {
  commodities: "commodities",
  realm: "realm",
} as const

type ViewMode = (typeof VIEW_OPTIONS)[keyof typeof VIEW_OPTIONS]

const AuctionHousePage = (): JSX.Element => {
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_OPTIONS.commodities)
  const [selectedRealmId, setSelectedRealmId] = useState<number | "">("")

  const realmsQuery = useQuery({
    queryKey: ["auction-connected-realms", env.region],
    queryFn: () => fetchConnectedRealmSnapshots(REALM_SAMPLE_SIZE),
  })

  const realms = useMemo(() => realmsQuery.data ?? [], [realmsQuery.data])

  useEffect(() => {
    if (selectedRealmId === "" && realms.length > 0) {
      setSelectedRealmId(realms[0].id)
    }
  }, [realms, selectedRealmId])

  const commoditiesQuery = useQuery({
    queryKey: ["auction-commodities", env.region],
    queryFn: () => fetchCommoditySnapshots(),
    enabled: viewMode === VIEW_OPTIONS.commodities,
  })

  const realmAuctionsQuery = useQuery({
    queryKey: ["auction-realm-listings", selectedRealmId, env.region],
    queryFn: () => fetchConnectedRealmAuctionSnapshots(Number(selectedRealmId)),
    enabled: viewMode === VIEW_OPTIONS.realm && selectedRealmId !== "",
  })

  const activeQuery = viewMode === VIEW_OPTIONS.commodities ? commoditiesQuery : realmAuctionsQuery
  const activeItems = activeQuery.data ?? []
  const selectedRealm = realms.find((realm) => realm.id === selectedRealmId)

  const friendlyError = useMemo(() => {
    const error = realmsQuery.error ?? commoditiesQuery.error ?? realmAuctionsQuery.error
    if (!error) {
      return undefined
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Auction House API. Update your Blizzard credentials in the .env file and refresh."
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again."
      }
    }

    return error instanceof Error ? error.message : "Unable to load auction house data right now."
  }, [commoditiesQuery.error, realmAuctionsQuery.error, realmsQuery.error])

  const handleViewMode = (_event: React.MouseEvent<HTMLElement>, value: ViewMode | null) => {
    if (value) {
      setViewMode(value)
    }
  }

  const handleRealmChange = (event: SelectChangeEvent<number | "">) => {
    const value = event.target.value
    setSelectedRealmId(typeof value === "string" ? Number(value) : value)
  }

  const isLoading = activeQuery.isLoading || (viewMode === VIEW_OPTIONS.realm && realmsQuery.isLoading)

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <GavelRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Auction House Ledger
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Track live commodities or inspect high-value connected realm listings pulled directly from Blizzard&apos;s Auction House API.
        </Typography>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          borderColor: "rgba(30, 155, 233, 0.22)",
          backgroundColor: "rgba(12, 18, 34, 0.72)",
        }}
      >
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PaidRoundedIcon color="primary" />
              <Typography variant="subtitle1" color="text.secondary">
                Market view
              </Typography>
            </Stack>
            <ToggleButtonGroup value={viewMode} exclusive size="small" onChange={handleViewMode} color="primary">
              <ToggleButton value={VIEW_OPTIONS.commodities} sx={{ borderRadius: 999 }}>
                Commodities
              </ToggleButton>
              <ToggleButton value={VIEW_OPTIONS.realm} sx={{ borderRadius: 999 }}>
                Connected realm
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {viewMode === VIEW_OPTIONS.realm ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PublicRoundedIcon color="primary" />
                <Typography variant="subtitle1" color="text.secondary">
                  Connected realm
                </Typography>
              </Stack>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 360 } }}>
                <InputLabel id="auction-realm-select-label">Connected realm</InputLabel>
                <Select
                  labelId="auction-realm-select-label"
                  value={selectedRealmId}
                  label="Connected realm"
                  onChange={handleRealmChange}
                >
                  {realms.map((realm) => (
                    <MenuItem key={realm.id} value={realm.id}>
                      {realm.displayName || `Connected Realm ${realm.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {friendlyError ? (
        <Alert severity="error" icon={<ReportProblemRoundedIcon fontSize="small" />} sx={{ borderRadius: 3 }}>
          {friendlyError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Grid container spacing={2} columns={{ xs: 1, sm: 2, md: 3 }}>
          {Array.from({ length: 9 }).map((_, index) => (
            <Grid item xs={1} key={index}>
              <Skeleton
                variant="rounded"
                sx={{
                  height: 220,
                  borderRadius: 3,
                  backgroundColor: "rgba(12, 18, 34, 0.45)",
                }}
              />
            </Grid>
          ))}
        </Grid>
      ) : null}

      {!isLoading && !friendlyError ? (
        <Stack spacing={3}>
          <Stack spacing={0.75}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {viewMode === VIEW_OPTIONS.commodities
                ? "Commodity market snapshot"
                : selectedRealm?.displayName || "Connected realm listings"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {viewMode === VIEW_OPTIONS.commodities
                ? `Showing ${activeItems.length} high-value commodity samples aggregated from the region-wide market.`
                : `Showing ${activeItems.length} premium buyout listings from the selected connected realm.`}
            </Typography>
          </Stack>

          {activeItems.length > 0 ? (
            <Grid container spacing={3}>
              {activeItems.map((listing) => (
                <Grid item xs={12} md={6} lg={4} key={listing.id}>
                  <ResultCard result={listing} accentColor="#f5c045" />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nothing is available for this market view right now. Try the other mode or another connected realm.
            </Typography>
          )}
        </Stack>
      ) : null}
    </Stack>
  )
}

export default AuctionHousePage