import { RouterProvider } from "react-router-dom";

import { router } from "@/app/routes";

/**
 * `v7_startTransition` stays off on purpose (explicitly, so react-router does
 * not log the deprecation): with it on, every `setSearchParams` call from
 * `useSearchParamState` becomes a transition, and a controlled input bound to
 * that URL value is reset to the old value after each keystroke until the
 * transition commits (caret jumps, dropped characters). The app has no
 * loaders, so the flag would buy nothing.
 */
const App = (): JSX.Element => (
  <RouterProvider router={router} future={{ v7_startTransition: false }} />
);

export default App;
