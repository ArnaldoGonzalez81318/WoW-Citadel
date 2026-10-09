import { Box, Skeleton, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { toSxArray } from "@/lib/sx";

export type FactListProps = {
  columns: GridColumns;
  children: ReactNode;
  sx?: SxProps<Theme>;
};

/** A `dl` laid out as a grid of label-over-value facts. */
export const FactList = ({ columns, children, sx }: FactListProps): JSX.Element => (
  <Box
    component="dl"
    sx={[
      {
        m: 0,
        display: "grid",
        columnGap: 2,
        rowGap: 1.5,
        minWidth: 0,
        ...gridTemplateColumnsSx(columns),
      },
      ...toSxArray(sx),
    ]}
  >
    {children}
  </Box>
);

export type FactProps = {
  label: ReactNode;
  value: ReactNode;
  /** A caption under the value ("at 7:09 PM"). */
  note?: ReactNode;
  loading?: boolean;
};

export const Fact = ({ label, value, note, loading = false }: FactProps): JSX.Element => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      component="dt"
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", lineHeight: 1.4 }}
    >
      {label}
    </Typography>
    <Typography
      component="dd"
      variant="subtitle1"
      sx={{ m: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}
    >
      {loading ? <Skeleton width={96} /> : value}
    </Typography>
    {note && !loading ? (
      <Typography
        component="dd"
        variant="caption"
        color="text.secondary"
        sx={{ m: 0, display: "block", overflowWrap: "anywhere" }}
      >
        {note}
      </Typography>
    ) : null}
  </Box>
);
