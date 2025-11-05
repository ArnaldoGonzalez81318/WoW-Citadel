import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded"
import {
  Card,
  CardContent,
  CardHeader,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material"
import { SearchResult } from "@/features/search/types"

interface ResultCardProps {
  result: SearchResult
  accentColor?: string
}

const ResultCard = ({ result, accentColor = "#1e9be9" }: ResultCardProps): JSX.Element => (
  <Card
    variant="outlined"
    sx={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      borderColor: `${accentColor}33`,
    }}
  >
    <CardHeader
      title={
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {result.name}
          </Typography>
          {result.tag ? (
            <Chip
              label={result.tag}
              size="small"
              sx={{
                borderRadius: 2,
                backgroundColor: `${accentColor}22`,
                color: `${accentColor}cc`,
                fontWeight: 600,
              }}
            />
          ) : null}
        </Stack>
      }
      subheader={result.summary}
      sx={{
        pb: result.details ? 0 : 2,
        "& .MuiCardHeader-subheader": {
          color: "text.secondary",
          fontWeight: 500,
        },
      }}
    />
    <CardContent sx={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
      {result.details ? (
        <Typography variant="body2" color="text.secondary">
          {result.details}
        </Typography>
      ) : null}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mt="auto">
        <Typography variant="caption" color="text.secondary">
          {result.typeLabel}
        </Typography>
        <Link
          href={result.href}
          target="_blank"
          rel="noreferrer"
          color="primary"
          underline="hover"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          View on Blizzard
          <LaunchRoundedIcon fontSize="inherit" />
        </Link>
      </Stack>
    </CardContent>
  </Card>
)

export default ResultCard
