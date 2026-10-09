import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { HousingParams } from "@/features/housingDecor/types";
import type {
  SearchParamsPatch,
  SearchParamsRecordSetter,
} from "@/hooks/useSearchParamState";

type DialogKey = "decor" | "fixture" | "room";

export const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export type DialogParam = {
  /** The id in the URL: the dialog is open. */
  id: number | null;
  /** The last id opened, kept while the dialog animates closed. */
  shownId: number | null;
  /**
   * Opens it from this page (a history entry Back can step over); `extra`
   * goes into the same entry (a search still waiting on its debounce).
   */
  open: (id: number, extra?: SearchParamsPatch<HousingParams>) => void;
  /** Moves the open dialog to another id in place (no new history entry). */
  replace: (id: number) => void;
  close: () => void;
};

/**
 * One dialog's id in the URL. The id outlives the param so the dialog never
 * blanks while closing; a malformed one is dropped; and closing a dialog
 * this page opened steps back over its history entry, so Back after closing
 * leaves the page instead of reopening it (a shared link just drops the param).
 */
const useDialogParam = (
  key: DialogKey,
  value: string,
  setParams: SearchParamsRecordSetter<HousingParams>,
): DialogParam => {
  const navigate = useNavigate();
  const id = parseId(value);
  const [shownId, setShownId] = useState<number | null>(id);
  if (id !== null && id !== shownId) {
    setShownId(id);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (id === null) {
      openedHereRef.current = false;
    }
    if (value !== "" && id === null) {
      setParams({ [key]: null } as SearchParamsPatch<HousingParams>, { replace: true });
    }
  }, [id, value, key, setParams]);

  const open = useCallback(
    (next: number, extra?: SearchParamsPatch<HousingParams>): void => {
      openedHereRef.current = true;
      setParams({ ...extra, [key]: String(next) } as SearchParamsPatch<HousingParams>);
    },
    [key, setParams],
  );
  const replace = useCallback(
    (next: number): void => {
      setParams({ [key]: String(next) } as SearchParamsPatch<HousingParams>, { replace: true });
    },
    [key, setParams],
  );
  const close = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ [key]: null } as SearchParamsPatch<HousingParams>, { replace: true });
  }, [key, navigate, setParams]);

  return { id, shownId, open, replace, close };
};

export default useDialogParam;
