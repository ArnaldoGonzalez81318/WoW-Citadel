import CloudQueueRoundedIcon from "@mui/icons-material/CloudQueueRounded"
import PublicRoundedIcon from "@mui/icons-material/PublicRounded"
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded"
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded"
import { Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material"
import type { ConnectedRealmSnapshot } from "@/features/connectedRealms/services/connectedRealmService"

interface ConnectedRealmCardProps {
  snapshot: ConnectedRealmSnapshot
}

const ConnectedRealmCard = ({ snapshot }: ConnectedRealmCardProps): JSX.Element => {
  const {
    displayName,
    realmSlugs,
    realmTypes,
    timezones,
    statusLabel,
    populationLabel,
    has_queue: hasQueue,
  } = snapshot

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "rgba(30, 155, 233, 0.16)",
        background: "linear-gradient(160deg, rgba(12,18,34,0.78) 0%, rgba(12,18,34,0.92) 35%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {displayName || realmSlugs.join(", ")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Slugs: {realmSlugs.join(", ")}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {realmTypes.map((type) => (
            <Chip
              key={`type-${type}`}
              icon={<PublicRoundedIcon fontSize="small" />}
              label={type}
              size="small"
              sx={{ borderRadius: 2 }}
            />
          ))}
          {timezones.map((timezone) => (
            <Chip
              key={`timezone-${timezone}`}
              icon={<ScheduleRoundedIcon fontSize="small" />}
              label={timezone}
              size="small"
              sx={{ borderRadius: 2 }}
            />
          ))}
          {statusLabel ? (
            <Chip
              icon={<SensorsRoundedIcon fontSize="small" />}
              label={statusLabel}
              size="small"
              color="success"
              sx={{ borderRadius: 2 }}
            />
          ) : null}
          {populationLabel ? (
            <Chip
              icon={<CloudQueueRoundedIcon fontSize="small" />}
              label={`Population: ${populationLabel}`}
              size="small"
              sx={{ borderRadius: 2 }}
            />
          ) : null}
          <Chip
            label={hasQueue ? "Queue Active" : "No Queue"}
            size="small"
            color={hasQueue ? "warning" : "primary"}
            sx={{ borderRadius: 2 }}
          />
        </Stack>

        <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.1)" }} />

        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            Member Realms
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {snapshot.realmDetails.map((realm) => realm.name || realm.slug).join(", ")}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default ConnectedRealmCard
