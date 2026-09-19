import { useEffect } from "react";

export const APP_NAME = "WoW Citadel";

/** "Items · WoW Citadel", or just "WoW Citadel" when there is no page title. */
export const formatDocumentTitle = (title?: string | null): string => {
  const trimmed = title?.trim() ?? "";
  return trimmed.length > 0 ? `${trimmed} · ${APP_NAME}` : APP_NAME;
};

/**
 * Sets `document.title` for the current route and restores the previous
 * title when the component unmounts (or the title changes).
 *
 * PageHeader calls this for every route; other components should not.
 */
export const useDocumentTitle = (title?: string | null): void => {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const previous = document.title;
    document.title = formatDocumentTitle(title);

    return () => {
      document.title = previous;
    };
  }, [title]);
};

export default useDocumentTitle;
