import CasinoRounded from "@mui/icons-material/CasinoRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SegmentedControl } from "@/components/common/ExplorerFilterBar";
import { LiveStatus } from "@/components/common/StateBlocks";
import GuildCrest from "@/features/guildCrests/components/GuildCrest";
import type { CrestArt } from "@/features/guildCrests/hooks/useCrestArt";
import type { CrestColor, CrestDesign, CrestRing } from "@/features/guildCrests/types";

const RING_OPTIONS: ReadonlyArray<{ value: CrestRing; label: string }> = [
  { value: "none", label: "None" },
  { value: "alliance", label: "Alliance" },
  { value: "horde", label: "Horde" },
];

const RING_LABEL: Record<CrestRing, string> = {
  none: "",
  alliance: "Alliance",
  horde: "Horde",
};

/** The preview's largest size: the art is 216 px wide, so ~1.6× at most. */
export const PREVIEW_MAX_WIDTH = 340;
const COPY_STATUS_MS = 2500;

/** The crest's accessible name, built from the same facts the list shows. */
export const describeCrest = (design: CrestDesign): string => {
  const parts = [
    design.emblem
      ? `emblem ${design.emblem.id}${design.emblemColor ? ` in ${design.emblemColor.name.toLowerCase()}` : ""}`
      : undefined,
    design.border
      ? `border ${design.border.id}${design.borderColor ? ` in ${design.borderColor.name.toLowerCase()}` : ""}`
      : undefined,
    design.backgroundColor
      ? `on a ${design.backgroundColor.name.toLowerCase()} background`
      : undefined,
    design.ring !== "none" ? `in the ${RING_LABEL[design.ring]} ring` : undefined,
  ].filter(Boolean);
  return `Guild crest: ${parts.join(", ")}`;
};

const Swatch = ({ color }: { color: CrestColor }): JSX.Element => (
  <Box
    component="span"
    aria-hidden="true"
    sx={(theme) => ({
      display: "inline-block",
      flexShrink: 0,
      width: 16,
      height: 16,
      borderRadius: `${theme.wc.radius.sm / 2}px`,
      backgroundColor: color.hex,
      border: `1px solid ${alpha("#ffffff", 0.2)}`,
    })}
  />
);

const ColorValue = ({ color }: { color?: CrestColor }): JSX.Element =>
  color ? (
    <Stack component="span" direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <Swatch color={color} />
      <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
        {color.name}{" "}
        <Box
          component="span"
          sx={(theme) => ({ color: "text.secondary", fontFamily: theme.wc.fontMono, fontSize: "0.8125rem" })}
        >
          {color.hex}
        </Box>
      </Box>
    </Stack>
  ) : (
    <Box component="span" sx={{ color: "text.secondary" }}>
      None listed
    </Box>
  );

const Fact = ({ label, children }: { label: string; children: ReactNode }): JSX.Element => (
  <>
    <Typography component="dt" variant="caption" color="text.secondary" sx={{ lineHeight: "24px" }}>
      {label}
    </Typography>
    <Typography component="dd" variant="body2" sx={{ m: 0, minWidth: 0, lineHeight: "24px" }}>
      {children}
    </Typography>
  </>
);

const Notice = ({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}): JSX.Element => (
  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
    <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
      {children}
    </Typography>
    {onRetry ? (
      <Button size="small" startIcon={<RefreshRounded />} onClick={onRetry}>
        Retry
      </Button>
    ) : null}
  </Stack>
);

type ArtNoticeProps = {
  kind: "emblem" | "border";
  id: number;
  art: CrestArt;
  onRetry: () => void;
};

/** A part whose art failed both ways: say so, with a retry, under the crest. */
const ArtNotice = ({ kind, id, art, onRetry }: ArtNoticeProps): JSX.Element | null => {
  if (art.loading) {
    return <Notice>{`Loading the art for ${kind} ${id}…`}</Notice>;
  }
  return art.missing ? (
    <Notice onRetry={onRetry}>{`The art for ${kind} ${id} did not load.`}</Notice>
  ) : null;
};

export type CrestPreviewProps = {
  design: CrestDesign;
  emblemArt: CrestArt;
  borderArt: CrestArt;
  /** The cloth image failed; the crest is drawn with a flat cloth. */
  clothFailed: boolean;
  /** Bumped by a retry: remounts the crest, so a failed cloth loads again. */
  clothAttempt: number;
  onClothError: () => void;
  /** Retries every layer that failed (emblem, border, cloth). */
  onRetryArt: () => void;
  onRingChange: (ring: CrestRing) => void;
  onRandom: () => void;
  onReset: () => void;
};

/**
 * The crest as designed, large, with what it is made of and the ways to
 * share or start over. The address bar always names the crest on screen,
 * so "Copy link" copies it as is.
 */
const CrestPreview = ({
  design,
  emblemArt,
  borderArt,
  clothFailed,
  clothAttempt,
  onClothError,
  onRetryArt,
  onRingChange,
  onRandom,
  onReset,
}: CrestPreviewProps): JSX.Element => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const showStatus = useCallback((status: "copied" | "failed") => {
    setCopyStatus(status);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setCopyStatus("idle");
    }, COPY_STATUS_MS);
  }, []);

  const copyLink = (): void => {
    const href = window.location.href;
    // No Clipboard API outside a secure context, or a refused write: say so
    // (the address bar holds the same link).
    if (!navigator.clipboard?.writeText) {
      showStatus("failed");
      return;
    }
    navigator.clipboard.writeText(href).then(
      () => showStatus("copied"),
      () => showStatus("failed"),
    );
  };

  const background = design.backgroundColor?.hex;

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Box
        sx={(theme) => ({
          width: "100%",
          maxWidth: PREVIEW_MAX_WIDTH,
          mx: "auto",
          p: { xs: 1.5, sm: 2 },
          borderRadius: `${theme.wc.radius.lg}px`,
          border: `1px solid ${theme.palette.border.subtle}`,
          // A faint wash of the background colour behind the crest, as if lit by it.
          background: `radial-gradient(circle at 50% 42%, ${alpha(background ?? theme.palette.primary.main, 0.24)} 0%, ${theme.palette.surface.sunken} 68%)`,
          transition: theme.transitions.create("background", { duration: theme.wc.motion.slow }),
        })}
      >
        <GuildCrest
          key={clothAttempt}
          emblemSrc={emblemArt.src}
          borderSrc={borderArt.src}
          emblemColor={design.emblemColor}
          borderColor={design.borderColor}
          backgroundColor={design.backgroundColor}
          ring={design.ring}
          title={describeCrest(design)}
          onEmblemError={emblemArt.onError}
          onBorderError={borderArt.onError}
          onClothError={onClothError}
        />
      </Box>

      {clothFailed ? (
        <Notice onRetry={onRetryArt}>The cloth art did not load; the crest is drawn flat.</Notice>
      ) : null}
      {design.emblem ? (
        <ArtNotice kind="emblem" id={design.emblem.id} art={emblemArt} onRetry={onRetryArt} />
      ) : null}
      {design.border ? (
        <ArtNotice kind="border" id={design.border.id} art={borderArt} onRetry={onRetryArt} />
      ) : null}

      <Stack spacing={0.75}>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          Faction ring
        </Typography>
        <SegmentedControl
          label="Faction ring"
          size="small"
          options={RING_OPTIONS}
          value={design.ring}
          onChange={onRingChange}
          sx={{ alignSelf: "flex-start", maxWidth: "100%" }}
        />
      </Stack>

      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr)",
          columnGap: 2,
          rowGap: 0.75,
          alignItems: "start",
        }}
      >
        <Fact label="Emblem">{design.emblem ? `No. ${design.emblem.id}` : "None listed"}</Fact>
        <Fact label="Emblem colour">
          <ColorValue color={design.emblemColor} />
        </Fact>
        <Fact label="Border">{design.border ? `No. ${design.border.id}` : "None listed"}</Fact>
        <Fact label="Border colour">
          <ColorValue color={design.borderColor} />
        </Fact>
        <Fact label="Background">
          <ColorValue color={design.backgroundColor} />
        </Fact>
      </Box>

      <Stack spacing={1}>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
          <Button
            variant="contained"
            size="small"
            startIcon={copyStatus === "copied" ? <CheckRounded /> : <LinkRounded />}
            onClick={copyLink}
          >
            {copyStatus === "copied" ? "Link copied" : "Copy link"}
          </Button>
          <Button variant="outlined" size="small" startIcon={<CasinoRounded />} onClick={onRandom}>
            Random crest
          </Button>
          <Button variant="text" size="small" startIcon={<RestartAltRounded />} onClick={onReset}>
            Reset
          </Button>
        </Stack>
        {/* Always mounted, so the result is announced when it changes. */}
        <LiveStatus sx={{ minHeight: "1.5em", fontSize: "0.75rem" }}>
          {copyStatus === "copied" ? "Link to this crest copied to the clipboard." : null}
          {copyStatus === "failed"
            ? "Could not copy the link; the address bar holds the same link."
            : null}
        </LiveStatus>
      </Stack>
    </Stack>
  );
};

export default CrestPreview;
