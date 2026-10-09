import { Button, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useId, useRef } from "react";
import type { RefObject } from "react";

export type ActiveFilter = {
  key: string;
  label: string;
  onRemove: () => void;
};

export type ActiveFilterChipsProps = {
  filters: readonly ActiveFilter[];
  onClearAll: () => void;
  /** Where focus goes once the last chip (or Clear all) is gone. */
  fallbackFocusRef: RefObject<HTMLElement>;
};

/**
 * The filters in force, each a chip that removes itself (click, Delete or
 * Backspace), and "Clear all". A removed chip hands focus to the chip that
 * takes its place, so a keyboard user can clear several in a row; the last
 * one hands it to the search field. Renders nothing (but stays mounted, so
 * that hand-off still runs) when no filter is set.
 */
const ActiveFilterChips = ({
  filters,
  onClearAll,
  fallbackFocusRef,
}: ActiveFilterChipsProps): JSX.Element | null => {
  const labelId = useId();
  const chipRefs = useRef(new Map<string, HTMLDivElement>());
  // Index of the removed chip, until the list without it has rendered.
  const pendingFocusRef = useRef<number | null>(null);

  useEffect(() => {
    const index = pendingFocusRef.current;
    if (index === null) {
      return;
    }
    pendingFocusRef.current = null;
    const next = filters[Math.min(index, filters.length - 1)];
    const target = next ? chipRefs.current.get(next.key) : undefined;
    (target ?? fallbackFocusRef.current)?.focus();
  }, [filters, fallbackFocusRef]);

  if (filters.length === 0) {
    return null;
  }

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      gap={1}
      alignItems="center"
      sx={{ flex: "1 1 100%", minWidth: 0 }}
    >
      <Typography id={labelId} variant="caption" color="text.secondary" component="span">
        Filtering by
      </Typography>
      <Stack
        role="group"
        aria-labelledby={labelId}
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        sx={{ minWidth: 0 }}
      >
        {filters.map((filter, index) => {
          const remove = (): void => {
            pendingFocusRef.current = index;
            filter.onRemove();
          };
          return (
            <Chip
              key={filter.key}
              ref={(node: HTMLDivElement | null) => {
                if (node) {
                  chipRefs.current.set(filter.key, node);
                } else {
                  chipRefs.current.delete(filter.key);
                }
              }}
              size="small"
              label={filter.label}
              onClick={remove}
              onDelete={remove}
              aria-label={`Remove filter: ${filter.label}`}
              sx={{ maxWidth: "100%" }}
            />
          );
        })}
      </Stack>
      <Button
        size="small"
        onClick={() => {
          pendingFocusRef.current = 0;
          onClearAll();
        }}
      >
        Clear all
      </Button>
    </Stack>
  );
};

export default ActiveFilterChips;
