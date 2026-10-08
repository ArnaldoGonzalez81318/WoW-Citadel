import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { SearchField } from "@/components/common/ExplorerFilterBar";

export type LadderSearchProps = {
  /** The committed (URL) query. */
  q: string;
  onQueryChange: (text: string) => void;
  /** The input; "Clear search" hands focus to it before it unmounts. */
  inputRef?: RefObject<HTMLInputElement>;
  disabled?: boolean;
};

/**
 * Finds a player on the loaded board by character or realm name. Owns the
 * draft so keystrokes re-render only this field, never the ladder; the draft
 * resyncs from `q` only when the URL changed somewhere else (Back button,
 * "Clear search"), never on the echo of its own commit.
 */
const LadderSearch = memo(
  ({ q, onQueryChange, inputRef, disabled = false }: LadderSearchProps): JSX.Element => {
    const [draft, setDraft] = useState(q);
    const committedRef = useRef(q);

    const commit = useCallback(
      (text: string): void => {
        committedRef.current = text.trim();
        onQueryChange(text.trim());
      },
      [onQueryChange],
    );

    useEffect(() => {
      if (q !== committedRef.current) {
        committedRef.current = q;
        setDraft(q);
      }
    }, [q]);

    const clear = useCallback((): void => {
      setDraft("");
      commit("");
    }, [commit]);

    return (
      <SearchField
        label="Find a player by character or realm name"
        placeholder="Find a player or realm…"
        value={draft}
        onChange={setDraft}
        onDebouncedChange={commit}
        onSubmit={commit}
        onClear={clear}
        debounceMs={300}
        minLength={2}
        size="small"
        inputRef={inputRef}
        disabled={disabled}
        sx={{ flex: "1 1 240px", minWidth: 0, maxWidth: { sm: 360 } }}
      />
    );
  },
);

LadderSearch.displayName = "LadderSearch";

export default LadderSearch;
