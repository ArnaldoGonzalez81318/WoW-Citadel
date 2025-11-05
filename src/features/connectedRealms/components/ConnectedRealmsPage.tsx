import PublicRoundedIcon from "@mui/icons-material/PublicRounded"
import TravelExploreRoundedIcon from "@mui/icons-material/TravelExploreRounded"
import { Alert, Grid, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material"
import { SyntheticEvent, useMemo, useState } from "react"
import ConnectedRealmCard from "@/features/connectedRealms/components/ConnectedRealmCard"
import { useConnectedRealmSnapshots } from "@/features/connectedRealms/hooks/useConnectedRealmSnapshots"

const SAMPLE_SIZES = [6, 12, 18]

const ConnectedRealmsPage = (): JSX.Element => {
  const [limit, setLimit] = useState<number>(SAMPLE_SIZES[1])
  const { data, isLoading, isError, error } = useConnectedRealmSnapshots(limit)

  const snapshots = useMemo(() => data ?? [], [data])
  const errorMessage = error instanceof Error ? error.message : undefined

  const handleLimitChange = (_event: SyntheticEvent, value: number | null) => {
    if (value) {
      setLimit(value)
    }
  }

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PublicRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Connected Realm Observatory
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Inspect live connected realm clusters for your region. Each card aggregates the member realms, queue state, population, and realm types straight from Blizzard&apos;s game data APIs.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center">
          <TravelExploreRoundedIcon color="primary" />
          <Typography variant="subtitle1" color="text.secondary">
            Sample size
          </Typography>
        </Stack>
        <ToggleButtonGroup value={limit} exclusive size="small" onChange={handleLimitChange} color="primary">
          {SAMPLE_SIZES.map((size) => (
            <ToggleButton key={size} value={size} sx={{ borderRadius: 999 }}>
              {size}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {isError ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {errorMessage ?? "Unable to load connected realm data. Ensure your Blizzard credentials are valid and try again."}
        </Alert>
      ) : null}

      {isLoading ? (
        <Grid container spacing={2} columns={{ xs: 1, sm: 2, md: 3 }}>
          {Array.from({ length: limit }).map((_, index) => (
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
      ) : (
        <Grid container spacing={2} columns={{ xs: 1, sm: 2, md: 3 }}>
          {snapshots.map((snapshot) => (
            <Grid item xs={1} key={snapshot.id}>
              <ConnectedRealmCard snapshot={snapshot} />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  )
}

export default ConnectedRealmsPage
