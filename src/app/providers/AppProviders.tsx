import { PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CssBaseline } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import { PerformanceOverlayProvider } from "@/devtools/PerformanceOverlayContext"
import theme from "@/theme"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const AppProviders = ({ children }: PropsWithChildren): JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <PerformanceOverlayProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </PerformanceOverlayProvider>
  </QueryClientProvider>
)

export default AppProviders
