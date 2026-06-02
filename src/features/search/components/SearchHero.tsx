import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import CrisisAlertRoundedIcon from "@mui/icons-material/CrisisAlertRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

interface SearchHeroProps {
  onQuickSearch: (value: string) => void;
}

const SearchHero = ({ onQuickSearch }: SearchHeroProps): JSX.Element => (
  <Grid container spacing={6} alignItems="center">
    <Grid item xs={12} md={7}>
      <Stack spacing={3}>
        <Typography
          variant="overline"
          sx={{ letterSpacing: "0.2em", color: "secondary.light" }}
        >
          World of Warcraft Intelligence
        </Typography>
        <Typography variant="h2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
          Search Azeroth&apos;s knowledge base in seconds
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Tap into Blizzard&apos;s official World of Warcraft Game Data APIs to
          surface gear, spells, mounts, and creature intel. Built for
          theorycrafters, raid leaders, and auction aficionados alike.
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {[
            { label: "Legendary Gear", icon: StyleRoundedIcon },
            { label: "Talent Spells", icon: AutoGraphRoundedIcon },
            { label: "Raid Boss Intel", icon: MilitaryTechRoundedIcon },
            { label: "Mount Collection", icon: PetsRoundedIcon },
          ].map(({ label, icon: Icon }) => (
            <Paper
              key={label}
              variant="outlined"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 999,
                borderColor: "rgba(30, 155, 233, 0.24)",
                backgroundColor: "rgba(12, 18, 34, 0.75)",
              }}
            >
              <Icon fontSize="small" color="primary" />
              <Typography
                variant="body2"
                color="text.secondary"
                fontWeight={600}
              >
                {label}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Grid>
    <Grid item xs={12} md={5}>
      <Box
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          backgroundImage:
            "linear-gradient(135deg, rgba(30,155,233,0.16), rgba(245,192,69,0.12))",
          border: "1px solid rgba(30, 155, 233, 0.18)",
          boxShadow: "0 24px 54px rgba(4, 8, 19, 0.6)",
        }}
      >
        <Stack spacing={3}>
          <Typography variant="subtitle1" color="text.secondary">
            Try one of these spotlighted searches or use the header search to
            explore anything in Azeroth.
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            {[
              { label: "Fyr'alath, the Dream Render", query: "Fyr'alath" },
              { label: "Ashes of Al'ar", query: "Ashes of Al'ar" },
              { label: "Neltharion's Tear", query: "Neltharion" },
              {
                label: "Dragonflight Professions",
                query: "Dragonflight profession",
              },
            ].map(({ label, query: nextQuery }) => (
              <Chip
                key={label}
                label={label}
                onClick={() => onQuickSearch(nextQuery)}
                variant="outlined"
                color="primary"
                sx={{
                  borderRadius: 2,
                  borderColor: "rgba(30,155,233,0.4)",
                  backgroundColor: "rgba(12,18,34,0.65)",
                  backdropFilter: "blur(12px)",
                  fontWeight: 600,
                }}
              />
            ))}
          </Stack>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              borderRadius: 2,
              border: "1px solid rgba(245,192,69,0.35)",
              background:
                "linear-gradient(135deg, rgba(245,192,69,0.15), rgba(12,18,34,0.85))",
            }}
          >
            <Stack spacing={0.5}>
              <Typography
                variant="subtitle2"
                color="warning.light"
                fontWeight={700}
              >
                Curious what&apos;s trending?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Browse the curated sections below for legendary items, mounts,
                creatures, and more.
              </Typography>
            </Stack>
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<CrisisAlertRoundedIcon fontSize="small" />}
              onClick={() => onQuickSearch("legendary")}
            >
              Show me legendary gear
            </Button>
          </Box>
        </Stack>
      </Box>
    </Grid>
  </Grid>
);

export default SearchHero;
