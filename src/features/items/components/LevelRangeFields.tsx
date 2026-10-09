import { Stack, TextField, Typography } from "@mui/material";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  MAX_ITEM_LEVEL,
  formatLevelParam,
} from "@/features/items/services/itemCatalog";
import type { ItemLevelRange } from "@/features/items/types";

export type LevelRangeFieldsProps = {
  /** The committed range (from the URL). */
  value: ItemLevelRange;
  onChange: (range: ItemLevelRange) => void;
};

/** A pause this long after typing applies the range (as do Enter and leaving the field). */
const COMMIT_DELAY_MS = 800;

const digitsOnly = (raw: string): string => raw.replace(/\D/g, "").slice(0, 4);

const toLevel = (raw: string): number | null => {
  if (raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isInteger(value) ? Math.min(value, MAX_ITEM_LEVEL) : null;
};

const toText = (value: number | null): string => (value === null ? "" : String(value));

/**
 * Minimum and maximum item level. Keystrokes stay local; the range is
 * applied after a pause, on Enter or when focus leaves, and never while the
 * minimum is above the maximum (that is flagged instead of searched).
 */
const LevelRangeFields = ({ value, onChange }: LevelRangeFieldsProps): JSX.Element => {
  const errorId = useId();
  const [min, setMin] = useState(toText(value.min));
  const [max, setMax] = useState(toText(value.max));
  // A reversed range is flagged only when it would be applied, not mid-typing:
  // typing 300 after a minimum of 200 passes through "3" on the way.
  const [flagged, setFlagged] = useState(false);
  const committedRef = useRef(formatLevelParam(value));

  // The URL changed somewhere else (a chip, Clear all, Back): adopt it.
  const { min: valueMin, max: valueMax } = value;
  useEffect(() => {
    const param = formatLevelParam({ min: valueMin, max: valueMax });
    if (param !== committedRef.current) {
      committedRef.current = param;
      setMin(toText(valueMin));
      setMax(toText(valueMax));
      setFlagged(false);
    }
  }, [valueMin, valueMax]);

  const minLevel = toLevel(min);
  const maxLevel = toLevel(max);
  const reversed = minLevel !== null && maxLevel !== null && minLevel > maxLevel;
  const showReversed = reversed && flagged;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const commitRef = useRef<() => void>(() => undefined);
  commitRef.current = (): void => {
    setFlagged(reversed);
    if (reversed) {
      return;
    }
    const range = { min: minLevel, max: maxLevel };
    const param = formatLevelParam(range);
    if (param !== committedRef.current) {
      committedRef.current = param;
      onChangeRef.current(range);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => commitRef.current(), COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [min, max]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRef.current();
    }
  };

  const fieldProps = {
    size: "small" as const,
    onBlur: () => commitRef.current(),
    onKeyDown: handleKeyDown,
    error: showReversed,
    // Always floated, like the selects beside it ("Any quality"), so the
    // whole label fits at any field width instead of ellipsing inside it.
    placeholder: "Any",
    sx: { flex: "1 1 0", minWidth: 0 },
    slotProps: {
      inputLabel: { shrink: true },
      htmlInput: {
        inputMode: "numeric" as const,
        pattern: "[0-9]*",
        autoComplete: "off",
        "aria-describedby": showReversed ? errorId : undefined,
        "aria-invalid": showReversed || undefined,
      },
    },
  };

  return (
    <Stack spacing={0.5} sx={{ flex: "1 1 220px", minWidth: 0, maxWidth: { sm: 260 } }}>
      <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
        <TextField
          {...fieldProps}
          label="Min item level"
          value={min}
          onChange={(event) => {
            setMin(digitsOnly(event.target.value));
            setFlagged(false);
          }}
        />
        <TextField
          {...fieldProps}
          label="Max item level"
          value={max}
          onChange={(event) => {
            setMax(digitsOnly(event.target.value));
            setFlagged(false);
          }}
        />
      </Stack>
      {showReversed ? (
        <Typography id={errorId} variant="caption" color="error.light" role="alert">
          The minimum is above the maximum.
        </Typography>
      ) : null}
    </Stack>
  );
};

export default LevelRangeFields;
