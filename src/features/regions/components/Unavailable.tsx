import { Box } from "@mui/material";

import { visuallyHidden } from "@/theme";

export type UnavailableProps = {
  /** What a screen reader hears instead of the dash. */
  label?: string;
};

/** An em dash for sight, a word for screen readers. */
const Unavailable = ({ label = "Unavailable" }: UnavailableProps): JSX.Element => (
  <>
    <Box component="span" aria-hidden="true" sx={{ color: "text.secondary" }}>
      —
    </Box>
    <Box component="span" sx={visuallyHidden}>
      {label}
    </Box>
  </>
);

export default Unavailable;
