import { lazy } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

import RootLayout from "@/app/RootLayout";
import RouteErrorBoundary from "@/components/common/RouteErrorBoundary";

const HomePage = lazy(() => import("@/pages/HomePage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const AchievementsPage = lazy(
  () => import("@/features/achievements/components/AchievementsPage"),
);
const ConnectedRealmsPage = lazy(
  () => import("@/features/connectedRealms/components/ConnectedRealmsPage"),
);
const ApiWorkbenchPage = lazy(() => import("@/pages/ApiWorkbenchPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

/**
 * Route table. Every page is lazy; `RootLayout` owns the Suspense boundary
 * and `RouteErrorBoundary` (the root `errorElement`) catches render and
 * chunk-load errors for the whole tree.
 */
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "search", element: <SearchPage /> },
      { path: "category/:slug", element: <CategoryPage /> },
      { path: "achievements", element: <AchievementsPage /> },
      { path: "connected-realms", element: <ConnectedRealmsPage /> },
      { path: "api-explorer/:family?", element: <ApiWorkbenchPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    // The remaining v7 flags only affect loaders, actions and fetchers, which
    // this app does not use; opting in now silences the deprecation warnings.
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

const App = (): JSX.Element => (
  <RouterProvider router={router} future={{ v7_startTransition: true }} />
);

export default App;
