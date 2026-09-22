import CloseRounded from "@mui/icons-material/CloseRounded";
import { Box, Chip, IconButton, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { To } from "react-router-dom";

export interface RecentSearchChipsProps {
  terms: string[];
  /** Where a term links to (defaults to `/search?q=`; a category page stays in place). */
  buildTo: (term: string) => To;
  /** When given, each term gets a sibling "Remove {term}" button (never nested in the link). */
  onRemove?: (term: string) => void;
  /** Accessible name of the list. */
  label?: string;
}

/**
 * A wrapping row of term chips. Each term is a plain link Chip; the delete
 * affordance is a separate, focusable IconButton beside it so the link's
 * accessible name stays the term itself and no control nests inside an `<a>`.
 */
const RecentSearchChips = ({
  terms,
  buildTo,
  onRemove,
  label,
}: RecentSearchChipsProps): JSX.Element => (
  <Stack
    component="ul"
    aria-label={label}
    direction="row"
    spacing={1}
    useFlexGap
    flexWrap="wrap"
    alignItems="center"
    sx={{ listStyle: "none", m: 0, p: 0 }}
  >
    {terms.map((term) => (
      <Box
        key={term}
        component="li"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
      >
        <Chip component={RouterLink} to={buildTo(term)} label={term} clickable />
        {onRemove ? (
          <IconButton
            size="small"
            aria-label={`Remove ${term}`}
            onClick={() => onRemove(term)}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
    ))}
  </Stack>
);

export default RecentSearchChips;
