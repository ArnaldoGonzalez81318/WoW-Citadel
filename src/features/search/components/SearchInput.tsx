import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  IconButton,
  InputAdornment,
  TextField,
  TextFieldProps,
} from "@mui/material";
import type { ChangeEvent } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  textFieldProps?: Partial<TextFieldProps>;
}

const SearchInput = ({
  value,
  onChange,
  onClear,
  placeholder = "Search items, spells, mounts, creatures...",
  autoFocus = true,
  textFieldProps,
}: SearchInputProps): JSX.Element => (
  <TextField
    fullWidth
    value={value}
    autoFocus={autoFocus}
    placeholder={placeholder}
    onChange={(event: ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value)
    }
    variant="outlined"
    id="search-input"
    name="search"
    label="Search"
    slotProps={{ inputLabel: { shrink: true, sx: { display: "none" } } }}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchRoundedIcon color="primary" />
        </InputAdornment>
      ),
      endAdornment: value ? (
        <InputAdornment position="end">
          <IconButton
            aria-label="Clear search"
            edge="end"
            onClick={() => onClear?.()}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <ClearRoundedIcon fontSize="small" />
          </IconButton>
        </InputAdornment>
      ) : undefined,
    }}
    sx={{
      backgroundColor: "rgba(12, 18, 34, 0.9)",
      borderRadius: 3,
      "& fieldset": {
        borderColor: "rgba(30, 155, 233, 0.25)",
      },
    }}
    {...textFieldProps}
  />
);

export default SearchInput;
