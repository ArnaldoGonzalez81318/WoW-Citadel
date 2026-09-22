import type { SxProps, Theme } from "@mui/material/styles";

export type SxArrayEntry = Extract<SxProps<Theme>, readonly unknown[]>[number];

/** Normalises an optional `sx` prop so it can be spread into an sx array. */
export const toSxArray = (
  sx: SxProps<Theme> | undefined,
): readonly SxArrayEntry[] =>
  sx === undefined
    ? []
    : Array.isArray(sx)
      ? (sx as readonly SxArrayEntry[])
      : [sx as SxArrayEntry];
