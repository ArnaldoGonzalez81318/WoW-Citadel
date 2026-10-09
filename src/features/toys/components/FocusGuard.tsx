import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

export type FocusGuardProps = {
  /** Where focus goes when the wrapped block unmounts with focus inside. */
  fallbackRef: RefObject<HTMLElement>;
  sx?: SxProps<Theme>;
  children: ReactNode;
};

/**
 * Hands focus on when the block it wraps unmounts with focus inside (a
 * Resume or "check all" button whose job is done, a pager whose last page
 * turned out empty), instead of letting it drop to the top of the document.
 * The cleanup runs before React detaches the nodes, so focus is still where
 * the visitor left it.
 */
const FocusGuard = ({ fallbackRef, sx, children }: FocusGuardProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    return () => {
      if (node !== null && node.contains(document.activeElement)) {
        fallbackRef.current?.focus({ preventScroll: true });
      }
    };
  }, [fallbackRef]);
  return (
    <Box ref={ref} sx={sx}>
      {children}
    </Box>
  );
};

export default FocusGuard;
