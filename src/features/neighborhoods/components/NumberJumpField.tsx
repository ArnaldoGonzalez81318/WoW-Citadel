import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";

/** Far beyond any region's numbers, but keeps a pasted string of digits sane. */
const MAX_NUMBER = 9_999_999;

const parseNumber = (value: string): number | null => {
  const digits = value.replace(/[\s,.]/gu, "");
  if (!/^\d+$/u.test(digits)) {
    return null;
  }
  const number = Number(digits);
  return number >= 1 && number <= MAX_NUMBER ? number : null;
};

export type NumberJumpFieldProps = {
  onJump: (number: number) => void;
  disabled?: boolean;
};

/**
 * "Go to No. ___": Blizzard can look a neighborhood up by number only, so
 * this is the register's search. Enter or the arrow opens the number's
 * page and the neighborhood itself; separators ("45,604") are allowed.
 */
const NumberJumpField = ({ onJump, disabled = false }: NumberJumpFieldProps): JSX.Element => {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const number = parseNumber(draft);
    if (number === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft("");
    onJump(number);
  };

  return (
    <Box
      component="form"
      role="search"
      aria-label="Find a neighborhood by number"
      onSubmit={handleSubmit}
      noValidate
      sx={{ flex: "1 1 220px", minWidth: 0, maxWidth: { sm: 300 } }}
    >
      <TextField
        size="small"
        fullWidth
        label="Go to number"
        placeholder="45604"
        value={draft}
        disabled={disabled}
        error={invalid}
        helperText={invalid ? "Enter a whole number, 1 or more." : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          if (invalid) {
            setInvalid(false);
          }
        }}
        slotProps={{
          htmlInput: {
            inputMode: "numeric",
            autoComplete: "off",
            enterKeyHint: "go",
          },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="submit"
                  edge="end"
                  size="small"
                  aria-label="Go to this number"
                  disabled={disabled}
                >
                  <ArrowForwardRoundedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
};

export default NumberJumpField;
