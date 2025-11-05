import { Box, Divider, Link, Stack, Typography } from "@mui/material"

const Footer = (): JSX.Element => (
  <Box component="footer" sx={{ py: 6, px: { xs: 2, md: 0 } }}>
    <Divider
      sx={{
        mb: 3,
        borderColor: "rgba(30, 155, 233, 0.12)",
      }}
    />
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
    >
      <Typography variant="body2" color="text.secondary">
        Data powered by Blizzard Entertainment ®. World of Warcraft is a trademark of Blizzard Entertainment, Inc.
      </Typography>
      <Stack direction="row" spacing={3}>
        <Link
          href="https://github.com/ArnaldoGonzalez81318/WoW-Citadel"
          target="_blank"
          rel="noreferrer"
          color="text.secondary"
          underline="hover"
        >
          GitHub
        </Link>
        <Link
          href="https://develop.battle.net/"
          target="_blank"
          rel="noreferrer"
          color="text.secondary"
          underline="hover"
        >
          Blizzard API
        </Link>
      </Stack>
    </Stack>
  </Box>
)

export default Footer
