import { Box, Stack, Typography } from "@mui/material"
import { Link as RouterLink } from "react-router-dom"

const Logo = (): JSX.Element => (
  <Box
    component={RouterLink}
    to="/"
    aria-label="Go to homepage"
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 1.5,
      minWidth: 0,
      textDecoration: "none",
      borderRadius: 3,
      outline: "none",
      transition: "transform 0.18s ease, opacity 0.18s ease",
      "&:hover": {
        transform: "translateY(-1px)",
      },
      "&:focus-visible": {
        boxShadow: "0 0 0 3px rgba(30, 155, 233, 0.22)",
      },
    }}
  >
    <Box
      sx={{
        position: "relative",
        width: 40,
        height: 40,
        borderRadius: "14px",
        flexShrink: 0,
        background: "linear-gradient(135deg, rgba(245,192,69,0.95), rgba(30,155,233,0.92))",
        boxShadow: "0 16px 28px rgba(8, 16, 34, 0.34)",
        "&::before": {
          content: "''",
          position: "absolute",
          inset: 2,
          borderRadius: "12px",
          background: "linear-gradient(180deg, rgba(5, 8, 19, 0.86), rgba(10, 16, 32, 0.42))",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        },
        "&::after": {
          content: "''",
          position: "absolute",
          inset: 11,
          borderRadius: "8px",
          border: "2px solid rgba(255, 255, 255, 0.78)",
          transform: "rotate(45deg)",
        },
      }}
    />
    <Stack spacing={0.15} sx={{ minWidth: 0 }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          letterSpacing: "0.04em",
          lineHeight: 1.05,
          color: "text.primary",
        }}
      >
        WoW Citadel
      </Typography>
      <Typography
        variant="caption"
        sx={{
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(156, 167, 199, 0.82)",
        }}
      >
        Live Warcraft Atlas
      </Typography>
    </Stack>
  </Box>
)

export default Logo
