import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded"
import { Box, Card, CardActionArea, CardContent, Chip, Grid, Stack, Typography } from "@mui/material"

const LEGENDARIES = [
  {
    id: "fyralath",
    name: "Fyr'alath, the Dream Render",
    tagline: "Empower your swings with draconic shadowflame.",
    image: "https://render.worldofwarcraft.com/us/icons/128/inv_axe_2h_drakonorlegendary_d_01.jpg",
    accent: "rgba(239, 68, 68, 0.3)",
    query: "Fyr'alath",
  },
  {
    id: "warglaives",
    name: "Warglaives of Azzinoth",
    tagline: "Illidan's iconic blades—a rite of passage for demon hunters.",
    image: "https://render.worldofwarcraft.com/us/icons/128/inv_weapon_glaves_01.jpg",
    accent: "rgba(59, 130, 246, 0.28)",
    query: "Warglaive of Azzinoth",
  },
  {
    id: "shadowmourne",
    name: "Shadowmourne",
    tagline: "Harvest the souls of Northrend with this runeblade.",
    image: "https://render.worldofwarcraft.com/us/icons/128/inv_axe_113.jpg",
    accent: "rgba(96, 165, 250, 0.32)",
    query: "Shadowmourne",
  },
  {
    id: "thunderfury",
    name: "Thunderfury, Blessed Blade of the Windseeker",
    tagline: "A storm's fury trapped in a legendary sword.",
    image: "https://render.worldofwarcraft.com/us/icons/128/inv_sword_39.jpg",
    accent: "rgba(16, 185, 129, 0.28)",
    query: "Thunderfury",
  },
]

interface LegendaryShowcaseProps {
  onSelect: (query: string) => void
}

const LegendaryShowcase = ({ onSelect }: LegendaryShowcaseProps): JSX.Element => (
  <Stack spacing={4} id="category-legendary">
    <Stack spacing={1.5}>
      <Chip
        label="Legendary Arsenal"
        color="primary"
        sx={{
          alignSelf: "flex-start",
          backgroundColor: "rgba(30, 155, 233, 0.22)",
          borderRadius: 999,
          px: 2,
        }}
      />
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Iconic armaments that shaped Azeroth
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Dive into the story, source, and modern relevance of Warcraft&apos;s most coveted legendary items. Tap a card to prime the search with its name.
      </Typography>
    </Stack>
    <Grid container spacing={3}>
      {LEGENDARIES.map((legendary) => (
        <Grid item xs={12} sm={6} md={3} key={legendary.id}>
          <Card
            sx={{
              position: "relative",
              borderRadius: 3,
              overflow: "hidden",
              background:
                "linear-gradient(160deg, rgba(12,18,34,0.82) 0%, rgba(12,18,34,0.92) 40%, rgba(12,18,34,0.98) 100%)",
              border: "1px solid rgba(30, 155, 233, 0.18)",
            }}
          >
            <CardActionArea onClick={() => onSelect(legendary.query)} sx={{ height: "100%" }}>
              <Box
                sx={{
                  position: "absolute",
                  top: -24,
                  right: -24,
                  width: 120,
                  height: 120,
                  bgcolor: legendary.accent,
                  filter: "blur(52px)",
                }}
              />
              <CardContent sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box
                  component="img"
                  src={legendary.image}
                  alt={legendary.name}
                  loading="lazy"
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 2,
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,0.22)",
                    boxShadow: "0 12px 24px rgba(2, 6, 14, 0.75)",
                  }}
                />
                <Stack spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {legendary.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {legendary.tagline}
                  </Typography>
                </Stack>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: "auto" }}>
                  <Typography variant="button" color="primary.light" sx={{ letterSpacing: "0.08em" }}>
                    Queue search
                  </Typography>
                  <LaunchRoundedIcon fontSize="small" color="primary" />
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  </Stack>
)

export default LegendaryShowcase
