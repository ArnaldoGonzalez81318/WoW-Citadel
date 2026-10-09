import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { createContext, useContext, useEffect, useRef } from "react";
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { Link as RouterLink } from "react-router-dom";

import { ErrorState } from "@/components/common/StateBlocks";
import { isMouseLike } from "@/components/layout/navigation/navUtils";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import { preloadLink } from "@/features/home/config/homeLinks";
import { mixins } from "@/theme";

/** A Retry pressed in a strip card: which card, and the error it was pressed on. */
type FocusClaim = { id: string; error: unknown };

/**
 * The card whose Retry was pressed. When the retry succeeds, the error
 * variant (and its focused button) is replaced by the link variant, a
 * different element; the link takes focus over, instead of leaving it on
 * the page. One card at a time, so a single slot is enough. The slot
 * belongs to the strip (StripFocusScope) rather than the module, so a claim
 * never outlives the page it was made on, and a retry that fails drops it
 * (see StripCardError): neither a later success elsewhere nor a return
 * visit can pull focus to a card unprompted.
 */
const FocusClaimContext = createContext<MutableRefObject<FocusClaim | null> | null>(null);

/** Around the strip's cards: one focus claim, for as long as the strip is mounted. */
export const StripFocusScope = ({ children }: { children: ReactNode }): JSX.Element => {
  const claimRef = useRef<FocusClaim | null>(null);
  return <FocusClaimContext.Provider value={claimRef}>{children}</FocusClaimContext.Provider>;
};

/** `gold` for the token's value; `primary` for everything else. */
export type StripTone = "primary" | "gold";

/*
 * Every variant holds this height from sm up, so a card never resizes its
 * row as it loads. The tallest loaded card sets it: the token card, about
 * 232px at md+ (a 28px price, its chip row, the sparkline row and its
 * caption, all reserved whether or not they show) and 228px below md; the
 * Raids card is about 191px, Mythic+ 174px, PvP 158px and the skeleton
 * 197px. A few pixels spare cover font fallback. Phones stack the cards,
 * where an exact match matters less than a short strip, so they size to
 * their content.
 */
const MIN_HEIGHT = { xs: 0, sm: 236 } as const;

/**
 * The inner box every variant shares (the link's action area, or the
 * static frame's body), inside the same 1px card border, so the heights
 * above mean the same thing for each.
 */
const BODY_SX = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 1,
  p: 2,
  minWidth: 0,
  minHeight: MIN_HEIGHT,
} as const;

const iconTileSx = (tone: StripTone) => (theme: Theme) => ({
  width: 40,
  height: 40,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  borderRadius: `${theme.wc.radius.md}px`,
  bgcolor:
    tone === "gold"
      ? alpha(theme.palette.secondary.main, 0.14)
      : alpha(theme.palette.primary.main, 0.12),
  color: tone === "gold" ? theme.palette.secondary.main : theme.palette.primary.light,
  "& svg": { fontSize: 22 },
});

type HeadProps = {
  id?: string;
  icon: ReactNode;
  overline: string;
  tone: StripTone;
};

const CardHead = ({ id, icon, overline, tone }: HeadProps): JSX.Element => (
  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
    <Box aria-hidden="true" sx={iconTileSx(tone)}>
      {icon}
    </Box>
    <Typography
      id={id}
      variant="overline"
      component="span"
      color="text.secondary"
      sx={{ ...mixins.truncate, display: "block", minWidth: 0, lineHeight: 1.5 }}
    >
      {overline}
    </Typography>
  </Stack>
);

export type StripCardProps = {
  /** Prefix for the overline, title and details ids. */
  id: string;
  icon: ReactNode;
  overline: string;
  title: ReactNode;
  /** Body lines under the title; they describe the link. */
  details?: ReactNode;
  /** The visible destination hint ("This week's top runs"). */
  cue: string;
  to: string;
  tone?: StripTone;
  /** A value that must never be cut off (the token price) wraps instead of truncating. */
  wrapTitle?: boolean;
};

/**
 * One headline of "This week in Azeroth": a single link to the explorer
 * that goes deeper. Named by its overline and title, described by its
 * details. No headings inside it (a heading may not sit in a link), and
 * nothing interactive either, so any Retry lives in the error variant.
 */
const StripCard = ({
  id,
  icon,
  overline,
  title,
  details,
  cue,
  to,
  tone = "primary",
  wrapTitle = false,
}: StripCardProps): JSX.Element => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const claimRef = useContext(FocusClaimContext);
  useEffect(() => {
    if (claimRef === null || claimRef.current?.id !== id) {
      return;
    }
    claimRef.current = null;
    const active = document.activeElement;
    if (active === null || active === document.body) {
      linkRef.current?.focus({ preventScroll: true });
    }
  }, [claimRef, id]);

  return (
    <Card variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        ref={linkRef}
        component={RouterLink}
        to={to}
        aria-labelledby={`${id}-overline ${id}-title`}
        aria-describedby={details ? `${id}-details` : undefined}
        onPointerEnter={(event: ReactPointerEvent<HTMLAnchorElement>) => {
          if (isMouseLike(event)) {
            preloadLink(to);
          }
        }}
        onFocus={() => preloadLink(to)}
        sx={{ ...cardActionAreaSx, ...BODY_SX }}
      >
        <CardHead id={`${id}-overline`} icon={icon} overline={overline} tone={tone} />
        <Typography
          id={`${id}-title`}
          variant="h6"
          component="span"
          sx={{
            ...(wrapTitle ? { overflowWrap: "anywhere" } : mixins.truncate),
            display: "block",
            m: 0,
          }}
        >
          {title}
        </Typography>
        {details ? (
          <Box id={`${id}-details`} sx={{ minWidth: 0 }}>
            {details}
          </Box>
        ) : null}
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ mt: "auto", color: "text.secondary" }}
        >
          <Typography variant="caption" component="span">
            {cue}
          </Typography>
          <ArrowForwardRounded aria-hidden="true" sx={{ fontSize: 16 }} />
        </Stack>
      </CardActionArea>
    </Card>
  );
};

/** The frame the error and skeleton variants share: same border, padding and height, no hover. */
const StaticFrame = ({ children }: { children: ReactNode }): JSX.Element => (
  <Card variant="outlined" sx={{ height: "100%", display: "flex" }}>
    <Box sx={BODY_SX}>{children}</Box>
  </Card>
);

export type StripCardErrorProps = {
  /** The link variant's id, which takes focus if this card's Retry succeeds while focused. */
  id: string;
  icon: ReactNode;
  overline: string;
  tone?: StripTone;
  /** From useStickyError, so the alert and its focused Retry stay while the retry runs. */
  error: unknown;
  /** "the Mythic+ season" → "We couldn't load the Mythic+ season." */
  context: string;
  onRetry: () => void;
  /** The explorer stays one click away whatever failed. */
  linkLabel: string;
  to: string;
};

export const StripCardError = ({
  id,
  icon,
  overline,
  tone = "primary",
  error,
  context,
  onRetry,
  linkLabel,
  to,
}: StripCardErrorProps): JSX.Element => {
  const claimRef = useContext(FocusClaimContext);
  // useStickyError keeps the same error object while a retry runs and hands
  // back a new one only when it fails, so a new error here means this
  // card's retry failed: its claim is dropped.
  useEffect(() => {
    if (claimRef?.current?.id === id && claimRef.current.error !== error) {
      claimRef.current = null;
    }
  }, [claimRef, error, id]);

  return (
    <StaticFrame>
      <CardHead icon={icon} overline={overline} tone={tone} />
      <ErrorState
        compact
        error={error}
        context={context}
        onRetry={() => {
          if (claimRef !== null) {
            claimRef.current = { id, error };
          }
          onRetry();
        }}
        secondaryAction={
          <Button component={RouterLink} to={to} size="small" variant="text" color="inherit">
            {linkLabel}
          </Button>
        }
      />
    </StaticFrame>
  );
};

/**
 * The loaded card's shape: icon and overline, title, two detail lines and
 * the cue, pinned to the bottom as the loaded card's is (useFlexGap: the
 * Stack's sibling margins would override its marginTop auto).
 */
export const StripCardSkeleton = ({ label }: { label: string }): JSX.Element => (
  <StaticFrame>
    <Stack
      spacing={1}
      useFlexGap
      role="status"
      aria-busy="true"
      aria-label={label}
      sx={{ flex: 1 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Skeleton variant="rounded" width={40} height={40} />
        <Skeleton variant="text" width="40%" sx={{ fontSize: "0.75rem" }} />
      </Stack>
      <Skeleton variant="text" width="70%" sx={{ fontSize: "1.25rem" }} />
      <Skeleton variant="text" width="60%" sx={{ fontSize: "0.875rem" }} />
      <Skeleton variant="text" width="45%" sx={{ fontSize: "0.75rem" }} />
      <Skeleton variant="text" width="35%" sx={{ fontSize: "0.75rem", mt: "auto" }} />
    </Stack>
  </StaticFrame>
);

export default StripCard;
