/**
 * Top padding of the main landmark in spacing units (24px xs / 32px md+).
 * AppShell applies it; RootLayout adds it to the header height for the
 * skip-link target's scroll margin, so skipping lands exactly where a fresh
 * page load starts. Kept outside the component module so Fast Refresh stays
 * enabled for AppShell.
 */
export const MAIN_PADDING_TOP = { xs: 3, md: 4 } as const;
