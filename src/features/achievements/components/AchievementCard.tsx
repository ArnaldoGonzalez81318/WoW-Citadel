import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded"
import StarsRoundedIcon from "@mui/icons-material/StarsRounded"
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded"
import { Card, CardContent, Chip, Stack, Typography } from "@mui/material"
import type { Achievement } from "@/features/achievements/types"

interface AchievementCardProps {
  achievement: Achievement
}

const AchievementCard = ({ achievement }: AchievementCardProps): JSX.Element => {
  const { name, description, points, reward, is_account_wide: isAccountWide } = achievement

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        backgroundColor: "rgba(12, 18, 34, 0.8)",
        borderColor: "rgba(30, 155, 233, 0.18)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EmojiEventsRoundedIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {name}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Chip
            icon={<StarsRoundedIcon fontSize="small" />}
            label={`${points ?? 0} pts`}
            size="small"
            sx={{
              borderRadius: 2,
              backgroundColor: "rgba(30, 155, 233, 0.15)",
              color: "primary.light",
              fontWeight: 600,
            }}
          />
          {isAccountWide ? (
            <Chip
              icon={<WorkspacePremiumRoundedIcon fontSize="small" />}
              label="Account-wide"
              size="small"
              sx={{
                borderRadius: 2,
                backgroundColor: "rgba(134, 239, 172, 0.12)",
                color: "success.light",
                fontWeight: 600,
              }}
            />
          ) : null}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {description || "No description provided for this achievement."}
        </Typography>
        {reward ? (
          <Typography variant="body2" color="warning.light" sx={{ mt: "auto" }}>
            Reward: {reward}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default AchievementCard
