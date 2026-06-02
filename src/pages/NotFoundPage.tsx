import SentimentDissatisfiedRoundedIcon from "@mui/icons-material/SentimentDissatisfiedRounded";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const NotFoundPage = (): JSX.Element => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: { xs: "60vh", md: "70vh" },
    }}
  >
    <Paper
      variant="outlined"
      sx={{
        maxWidth: 520,
        width: "100%",
        p: { xs: 4, md: 6 },
        borderRadius: 4,
        textAlign: "center",
        backgroundColor: "rgba(12, 18, 34, 0.75)",
        borderColor: "rgba(30, 155, 233, 0.2)",
      }}
    >
      <Stack spacing={3} alignItems="center">
        <SentimentDissatisfiedRoundedIcon
          color="primary"
          sx={{ fontSize: 48 }}
        />
        <Stack spacing={1.5}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Page not found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The portal you were looking for doesn&apos;t exist (yet). Return to
            the home screen to continue your search through Azeroth&apos;s
            knowledge base.
          </Typography>
        </Stack>
        <Button
          component={RouterLink}
          to="/"
          variant="contained"
          color="primary"
          size="large"
        >
          Back to search
        </Button>
      </Stack>
    </Paper>
  </Box>
);

export default NotFoundPage;
