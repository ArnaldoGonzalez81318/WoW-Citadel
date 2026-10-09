import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { toSxArray } from "@/lib/sx";

export type AppearanceLookupProps = {
  onLookup: (appearanceId: number) => void;
  sx?: SxProps<Theme>;
};

/** Appearance ids run to six digits; anything much longer is a typo. */
const MAX_ID_LENGTH = 7;

const parseAppearanceId = (value: string): number | null => {
  const trimmed = value.trim().replace(/^#/u, "");
  if (!/^\d+$/u.test(trimmed) || trimmed.length > MAX_ID_LENGTH) {
    return null;
  }
  const id = Number(trimmed);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/**
 * Open any appearance by its id: Blizzard's search counts 1,000 matches at
 * most, so this page's search pages reach a slot's newest and oldest
 * thousand only, and an id is what other tools quote. A value
 * that is not an id says so under the field instead of opening a dialog
 * that can only fail.
 */
const AppearanceLookup = ({ onLookup, sx }: AppearanceLookupProps): JSX.Element => {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  // TextField ties its helper text to the input by this id (aria-describedby).
  const inputId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const id = parseAppearanceId(value);
    if (id === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onLookup(id);
  };

  return (
    <Box
      component="form"
      role="search"
      aria-label="Open an appearance by id"
      onSubmit={handleSubmit}
      noValidate
      sx={[
        { display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start", minWidth: 0 },
        ...toSxArray(sx),
      ]}
    >
      <TextField
        id={inputId}
        size="small"
        label="Appearance ID"
        placeholder="e.g. 12345"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (invalid) {
            setInvalid(false);
          }
        }}
        error={invalid}
        helperText={invalid ? "Enter an appearance id: a whole number such as 12345." : undefined}
        slotProps={{
          htmlInput: { inputMode: "numeric", autoComplete: "off", spellCheck: false },
        }}
        sx={{ flex: "1 1 140px", minWidth: 0, maxWidth: { sm: 180 } }}
      />
      <Button
        type="submit"
        variant="outlined"
        startIcon={<SearchRoundedIcon />}
        sx={{ minHeight: 40, flexShrink: 0 }}
      >
        Open appearance
      </Button>
    </Box>
  );
};

export default AppearanceLookup;
