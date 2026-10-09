import { Box, Button } from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

type PanelActionProps = {
  to: string;
  children: ReactNode;
};

/*
 * SectionCard sets its actions beside the title column, which also holds
 * the description: on a phone a button there leaves both about 100px to
 * wrap in. So a panel's one link sits in its header from sm up, and at the
 * foot of the panel below that; only one of the two is ever displayed.
 */

export const PanelHeaderAction = ({ to, children }: PanelActionProps): JSX.Element => (
  <Button
    component={RouterLink}
    to={to}
    size="small"
    variant="text"
    sx={{ display: { xs: "none", sm: "inline-flex" }, whiteSpace: "nowrap" }}
  >
    {children}
  </Button>
);

export const PanelFooterAction = ({ to, children }: PanelActionProps): JSX.Element => (
  <Box sx={{ display: { xs: "block", sm: "none" }, mt: 2 }}>
    <Button component={RouterLink} to={to} size="small" variant="outlined" fullWidth>
      {children}
    </Button>
  </Box>
);
