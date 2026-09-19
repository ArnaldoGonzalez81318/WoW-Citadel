/**
 * @deprecated The dev-only "Gallery Diagnostics" overlay was removed (it
 * shipped in the production bundle and covered the grid on phones). This
 * module keeps the entry type and a no-op hook so the explorer pages compile
 * until the feature packages delete their calls; there is no provider.
 */
export type PerformanceOverlayEntry = {
  id: string;
  label: string;
  renderedCount?: number;
  totalCount?: number;
  enrichmentCount?: number;
  notes?: string;
};

/**
 * @deprecated No-op: the overlay was removed. Delete the call site (and the
 * `renderedCount` bookkeeping that only fed it).
 */
export const usePerformanceOverlayEntry = (
  _entry: PerformanceOverlayEntry | null,
): void => {
  // Intentionally empty.
};
