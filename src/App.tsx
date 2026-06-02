import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import AppShell from "@/components/layout/AppShell";
import { SearchProvider } from "@/features/search/context/SearchContext";

const HomePage = lazy(() => import("@/pages/HomePage"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const AchievementsPage = lazy(
  () => import("@/features/achievements/components/AchievementsPage"),
);
const ConnectedRealmsPage = lazy(
  () => import("@/features/connectedRealms/components/ConnectedRealmsPage"),
);
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const RouteLoadingFallback = (): JSX.Element => (
  <Box
    sx={{
      minHeight: "50vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <CircularProgress color="primary" />
  </Box>
);

const App = (): JSX.Element => (
  <SearchProvider>
    <AppShell>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/connected-realms" element={<ConnectedRealmsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  </SearchProvider>
);

export default App;
