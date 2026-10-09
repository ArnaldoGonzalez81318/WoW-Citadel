import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId } from "react";
import type { ReactNode } from "react";

import { focusRing, mixins } from "@/theme";

export type LinkRowProps = {
  icon: ReactNode;
  primary: string;
  secondary?: string | null;
  /** Right-aligned detail ("In 22 slot types"). */
  trailing?: string | null;
  /** The button's accessible name, when `primary` alone is ambiguous. */
  label?: string;
  onClick: () => void;
};

/**
 * A row in a dialog list that shows another slot type or category in the
 * same dialog: icon, name, id line and an optional count, all one button.
 */
const LinkRow = ({ icon, primary, secondary, trailing, label, onClick }: LinkRowProps): JSX.Element => {
  const detailsId = useId();
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      // Without a label the details are already part of the name.
      aria-describedby={label && (secondary || trailing) ? detailsId : undefined}
      sx={(theme) => ({
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1,
        textAlign: "left",
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.subtle}`,
        backgroundColor: theme.palette.surface.inset,
        "@media (hover: hover)": {
          "&:hover": {
            borderColor: theme.palette.border.strong,
            backgroundColor: alpha(theme.palette.primary.main, 0.06),
          },
        },
        "&.Mui-focusVisible": focusRing(theme),
      })}
    >
      {icon}
      <Box component="span" sx={{ display: "block", minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          component="span"
          title={primary}
          sx={{ ...mixins.truncate, display: "block", fontWeight: 600 }}
        >
          {primary}
        </Typography>
        {secondary || trailing ? (
          <Typography
            id={detailsId}
            variant="caption"
            component="span"
            color="text.secondary"
            sx={{ display: "block", overflowWrap: "anywhere" }}
          >
            {[secondary, trailing].filter(Boolean).join(" · ")}
          </Typography>
        ) : null}
      </Box>
      <ChevronRightRoundedIcon aria-hidden="true" sx={{ color: "text.secondary", flexShrink: 0 }} />
    </ButtonBase>
  );
};

export default LinkRow;
