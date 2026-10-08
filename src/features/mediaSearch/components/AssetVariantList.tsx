import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { useState } from "react";

import type { ClipboardStatus } from "@/features/mediaSearch/hooks/useClipboardCopy";
import { assetVariants } from "@/features/mediaSearch/services/mediaSearchService";
import type { AssetVariant, MediaAsset } from "@/features/mediaSearch/types";
import { visuallyHidden } from "@/theme";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; width: number; height: number }
  | { status: "failed" };

export type CopyButtonProps = {
  value: string;
  /** Visually hidden suffix that tells same-named buttons apart ("for the 56 px icon"). */
  context: string;
  status: ClipboardStatus | null;
  onCopy: (value: string, key: string) => void;
  label?: string;
};

/** A copy button that reads "Copied" or "Copy failed" for two seconds after a click. */
export const CopyButton = ({
  value,
  context,
  status,
  onCopy,
  label = "Copy URL",
}: CopyButtonProps): JSX.Element => {
  const result = status?.key === value ? status : null;
  return (
    <Button
      size="small"
      color={result && !result.ok ? "warning" : "primary"}
      startIcon={result?.ok ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
      onClick={() => onCopy(value, value)}
    >
      {result ? (result.ok ? "Copied" : "Copy failed") : label}
      <Box component="span" sx={visuallyHidden}>
        {` ${context}`}
      </Box>
    </Button>
  );
};

type VariantCardProps = {
  variant: AssetVariant;
  copyStatus: ClipboardStatus | null;
  onCopy: (value: string, key: string) => void;
};

/**
 * One size: a preview (at its natural size for icons, fitted for art), the
 * measured pixel size, the URL as selectable text, and copy / open buttons.
 * Derived sizes that the CDN does not serve say so instead of offering a
 * dead link.
 */
const VariantCard = ({ variant, copyStatus, onCopy }: VariantCardProps): JSX.Element => {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const missing = load.status === "failed";
  const measured =
    load.status === "loaded" ? `${load.width} × ${load.height}` : variant.nominalSize;

  return (
    <Box
      component="figure"
      sx={(theme) => ({
        margin: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        padding: 1.5,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.subtle}`,
        backgroundColor: theme.palette.surface.inset,
      })}
    >
      <Box
        sx={(theme) => ({
          position: "relative",
          minHeight: variant.natural ? 72 : 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: `${theme.wc.radius.sm}px`,
          backgroundColor: theme.palette.surface.sunken,
        })}
      >
        {missing ? (
          <Typography
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{ px: 1, textAlign: "center" }}
          >
            {variant.original ? "The image did not load" : "Not served at this size"}
          </Typography>
        ) : (
          <Box
            component="img"
            src={variant.url}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              const image = event.currentTarget as HTMLImageElement;
              setLoad({
                status: "loaded",
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
            }}
            onError={() => setLoad({ status: "failed" })}
            sx={{
              display: "block",
              maxWidth: "100%",
              height: "auto",
              maxHeight: variant.natural ? undefined : 320,
              objectFit: "contain",
              // Hidden until it lands so the skeleton is not drawn over a half-decoded image.
              visibility: load.status === "loaded" ? "visible" : "hidden",
            }}
          />
        )}
        {load.status === "loading" ? (
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{ position: "absolute", inset: 0, height: "auto" }}
          />
        ) : null}
      </Box>

      <Box component="figcaption" sx={{ minWidth: 0 }}>
        <Typography variant="body2" component="p" sx={{ margin: 0, fontWeight: 600 }}>
          {variant.label}
          {measured ? (
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 400, fontVariantNumeric: "tabular-nums" }}
            >
              {` · ${measured}`}
            </Typography>
          ) : null}
          {variant.original ? (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
              {" · as listed"}
            </Typography>
          ) : null}
        </Typography>
        {missing && !variant.original ? null : (
          <Typography
            variant="caption"
            component="p"
            color="text.secondary"
            sx={(theme) => ({
              margin: 0,
              marginTop: 0.5,
              fontFamily: theme.wc.fontMono,
              wordBreak: "break-all",
            })}
          >
            {variant.url}
          </Typography>
        )}
      </Box>

      {missing && !variant.original ? null : (
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5} sx={{ marginTop: "auto" }}>
          <CopyButton
            value={variant.url}
            context={`of the ${variant.label} image`}
            status={copyStatus}
            onCopy={onCopy}
          />
          <Button
            size="small"
            href={variant.url}
            target="_blank"
            rel="noreferrer"
            endIcon={<OpenInNewRoundedIcon />}
          >
            Open
            <Box component="span" sx={visuallyHidden}>
              {` the ${variant.label} image in a new tab`}
            </Box>
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export type AssetVariantListProps = {
  asset: MediaAsset;
  copyStatus: ClipboardStatus | null;
  onCopy: (value: string, key: string) => void;
};

/** Every size of one asset side by side (icons: 56, 36 and 18 px; zone tiles: large and small). */
const AssetVariantList = ({
  asset,
  copyStatus,
  onCopy,
}: AssetVariantListProps): JSX.Element => {
  const variants = assetVariants(asset);
  const allNatural = variants.every((variant) => variant.natural);
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: allNatural
          ? { xs: "minmax(0, 1fr)", sm: `repeat(${Math.min(variants.length, 3)}, minmax(0, 1fr))` }
          : { xs: "minmax(0, 1fr)", sm: `repeat(${Math.min(variants.length, 2)}, minmax(0, 1fr))` },
      }}
    >
      {variants.map((variant) => (
        // Keyed by URL so a new record starts each preview over.
        <VariantCard
          key={variant.url}
          variant={variant}
          copyStatus={copyStatus}
          onCopy={onCopy}
        />
      ))}
    </Box>
  );
};

export default AssetVariantList;
