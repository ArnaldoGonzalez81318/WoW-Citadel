import { Typography } from "@mui/material"

const Logo = (): JSX.Element => (
  <Typography
    variant="h6"
    sx={{
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      background: "linear-gradient(120deg, #f5c045, #1e9be9)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    }}
  >
    WoW Citadel
  </Typography>
)

export default Logo
