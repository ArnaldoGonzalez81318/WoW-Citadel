import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { isChunkReloadPending, markChunkReload } from "@/app/chunkReload";
import AppProviders from "@/app/providers/AppProviders";
import App from "./App";

/**
 * After a deploy, an open tab still holds the old `index.html`, and its lazy
 * route imports 404. Vite reports those as `vite:preloadError`: reload once,
 * guarded by a session flag with a cooldown (see `app/chunkReload`), and when the
 * fresh bundle fails too let the error reach `RouteErrorBoundary`, which then
 * offers a hard "Go home".
 */
const installChunkReloadRecovery = (): void => {
  window.addEventListener("vite:preloadError", (event) => {
    if (isChunkReloadPending() || !markChunkReload()) {
      return;
    }

    event.preventDefault();
    window.location.reload();
  });
};

installChunkReloadRecovery();

const container = document.getElementById("root");

if (!container) {
  throw new Error('Root element "#root" is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
