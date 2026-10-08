import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { toSxArray } from "@/lib/sx";

export type QuestLookupProps = {
  onLookup: (questId: number) => void;
  sx?: SxProps<Theme>;
};

/** Quest ids run to six digits; anything longer is a typo, not a quest. */
const MAX_ID_LENGTH = 7;

const parseQuestId = (value: string): number | null => {
  const trimmed = value.trim().replace(/^#/u, "");
  if (!/^\d+$/u.test(trimmed) || trimmed.length > MAX_ID_LENGTH) {
    return null;
  }
  const id = Number(trimmed);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/**
 * Open any quest by its id: Blizzard's API has no quest search, and the id
 * is the number in a quest's Wowhead address (wowhead.com/quest=11). A
 * value that is not an id says so under the field instead of opening a
 * dialog that can only fail.
 */
const QuestLookup = ({ onLookup, sx }: QuestLookupProps): JSX.Element => {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  // TextField ties its helper text to the input by this id (aria-describedby).
  const inputId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const id = parseQuestId(value);
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
      aria-label="Look up a quest by id"
      onSubmit={handleSubmit}
      noValidate
      sx={[
        {
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "flex-start",
          minWidth: 0,
        },
        ...toSxArray(sx),
      ]}
    >
      <TextField
        size="small"
        label="Quest ID"
        placeholder="e.g. 11"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (invalid) {
            setInvalid(false);
          }
        }}
        error={invalid}
        helperText={invalid ? "Enter a quest id: a whole number such as 11." : undefined}
        slotProps={{
          htmlInput: {
            inputMode: "numeric",
            autoComplete: "off",
            spellCheck: false,
          },
        }}
        id={inputId}
        sx={{ flex: "1 1 140px", minWidth: 0, maxWidth: { sm: 200 } }}
      />
      <Button
        type="submit"
        variant="outlined"
        startIcon={<SearchRoundedIcon />}
        sx={{ minHeight: 40, flexShrink: 0 }}
      >
        Open quest
      </Button>
    </Box>
  );
};

export default QuestLookup;
