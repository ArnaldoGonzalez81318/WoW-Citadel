import { Box, Container } from "@mui/material"
import { PropsWithChildren } from "react"
import PerformanceOverlay from "@/devtools/PerformanceOverlay"
import Footer from "@/components/layout/Footer"
import Header from "@/components/layout/Header"

const AppShell = ({ children }: PropsWithChildren): JSX.Element => (
  <Box
    sx={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      background: "radial-gradient(circle at 20% 20%, rgba(30,155,233,0.18), transparent 55%)",
      "&::before": {
        content: "''",
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 80% 0%, rgba(245,192,69,0.18), transparent 45%)",
        pointerEvents: "none",
        zIndex: 0,
      },
    }}
  >
    <Box sx={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
      <Header />
      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: { xs: 6, md: 10 } }}>
        {children}
      </Container>
      <Footer />
      <PerformanceOverlay />
    </Box>
  </Box>
)

export default AppShell
