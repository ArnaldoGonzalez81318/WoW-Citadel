import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { SearchResult } from "@/features/search/types";

interface ResultCardProps {
  result: SearchResult;
  accentColor?: string;
  compact?: boolean;
  onClick?: () => void;
  mediaMode?: "fill" | "framed";
  mediaHeight?: number;
  width?: number | string;
}

const ResultCard = ({
  result,
  accentColor = "#1e9be9",
  compact = false,
  onClick,
  mediaMode = "fill",
  mediaHeight,
  width,
}: ResultCardProps): JSX.Element => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [result.mediaUrl]);

  const effectiveMediaUrl = imgFailed ? undefined : result.mediaUrl;
  const isSmallIconAsset = Boolean(
    effectiveMediaUrl && /\/icons\/56\//.test(effectiveMediaUrl),
  );
  const smallIconSize = 56;
  const resolvedMediaHeight = mediaHeight ?? (compact ? 104 : 180);
  const cardInteractionSx = {
    transition:
      "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
    "@media (hover: hover)": {
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: `0 18px 36px ${accentColor}22`,
        borderColor: `${accentColor}66`,
      },
      "&:hover .result-card-media": {
        transform: "scale(1.04)",
      },
    },
    "&:focus-visible": {
      outline: `2px solid ${accentColor}`,
      outlineOffset: 2,
    },
    "& .result-card-media": {
      transition: "transform 180ms ease",
    },
  };
  const interactiveProps = onClick
    ? {
        onClick: (event: React.MouseEvent<HTMLDivElement>) => {
          (event.currentTarget as HTMLElement).blur();
          onClick();
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            (event.currentTarget as HTMLElement).blur();
            onClick();
          }
        },
        role: "button" as const,
        tabIndex: 0,
        sx: { cursor: "pointer" },
      }
    : undefined;

  if (compact) {
    return (
      <Card
        variant="outlined"
        {...interactiveProps}
        sx={{
          width: width ?? "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderColor: `${accentColor}33`,
          cursor: onClick ? "pointer" : "default",
          ...cardInteractionSx,
        }}
      >
        {effectiveMediaUrl ? (
          <Box
            sx={{
              width: "100%",
              height: isSmallIconAsset
                ? smallIconSize + 16
                : resolvedMediaHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: `1px solid ${accentColor}22`,
              backgroundColor: "rgba(7, 12, 24, 0.72)",
              overflow: "hidden",
              alignSelf: "stretch",
              p: isSmallIconAsset ? 1 : 0,
            }}
          >
            <Box
              component="img"
              src={effectiveMediaUrl}
              alt={result.name}
              className="result-card-media"
              onError={() => setImgFailed(true)}
              sx={{
                width: isSmallIconAsset ? smallIconSize : "100%",
                height: isSmallIconAsset ? smallIconSize : "100%",
                maxWidth: isSmallIconAsset ? smallIconSize : "100%",
                maxHeight: isSmallIconAsset ? smallIconSize : "100%",
                objectFit: isSmallIconAsset ? "contain" : "cover",
                borderRadius: isSmallIconAsset ? 1 : 0,
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: "100%",
              height: resolvedMediaHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: `1px solid ${accentColor}22`,
              background: `linear-gradient(145deg, ${accentColor}18, rgba(7, 12, 24, 0.92))`,
              color: "text.primary",
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.08em",
            }}
          >
            {result.name.slice(0, 1)}
          </Box>
        )}

        <Stack spacing={1} sx={{ p: 1.5, flex: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {result.name}
          </Typography>

          {result.summary ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {result.summary}
            </Typography>
          ) : null}

          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            mt="auto"
          >
            {result.tag ? (
              <Chip
                label={result.tag}
                size="small"
                sx={{
                  borderRadius: 2,
                  backgroundColor: `${accentColor}22`,
                  color: `${accentColor}cc`,
                  fontWeight: 600,
                  maxWidth: "100%",
                }}
              />
            ) : null}
            {result.typeLabel ? (
              <Typography variant="caption" color="text.secondary">
                {result.typeLabel}
              </Typography>
            ) : null}
          </Stack>

          <Link
            href={result.href}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            color="primary"
            underline="hover"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: "0.72rem",
            }}
          >
            View on Blizzard
            <LaunchRoundedIcon fontSize="inherit" />
          </Link>
        </Stack>
      </Card>
    );
  }

  // Horizontal icon card — used when the media is a 56×56 WoW icon or there is no large artwork
  if (isSmallIconAsset || (!effectiveMediaUrl && !mediaMode)) {
    return (
      <Card
        variant="outlined"
        {...interactiveProps}
        sx={{
          width: width ?? "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          borderColor: `${accentColor}33`,
          cursor: onClick ? "pointer" : "default",
          ...cardInteractionSx,
        }}
      >
        {/* Icon / placeholder column */}
        <Box
          sx={{
            flexShrink: 0,
            width: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: `1px solid ${accentColor}22`,
            background: effectiveMediaUrl
              ? "rgba(7, 12, 24, 0.72)"
              : `linear-gradient(145deg, ${accentColor}18, rgba(7, 12, 24, 0.92))`,
          }}
        >
          {effectiveMediaUrl ? (
            <Box
              component="img"
              src={effectiveMediaUrl}
              alt={result.name}
              className="result-card-media"
              onError={() => setImgFailed(true)}
              sx={{
                width: smallIconSize,
                height: smallIconSize,
                borderRadius: 1.5,
                objectFit: "contain",
                imageRendering: "pixelated",
              }}
            />
          ) : (
            <Typography
              sx={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: `${accentColor}cc`,
              }}
            >
              {result.name.slice(0, 1)}
            </Typography>
          )}
        </Box>

        {/* Content column */}
        <Stack
          spacing={0.5}
          sx={{ p: 1.5, flex: 1, minWidth: 0, justifyContent: "center" }}
        >
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                lineHeight: 1.3,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {result.name}
            </Typography>
            {result.tag ? (
              <Chip
                label={result.tag}
                size="small"
                sx={{
                  borderRadius: 1.5,
                  height: 18,
                  fontSize: "0.65rem",
                  backgroundColor: `${accentColor}22`,
                  color: `${accentColor}cc`,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              />
            ) : null}
          </Stack>

          {result.summary ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {result.summary}
            </Typography>
          ) : null}

          {result.details ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                opacity: 0.7,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {result.details}
            </Typography>
          ) : null}

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
            pt={0.25}
          >
            {result.typeLabel ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ opacity: 0.6 }}
              >
                {result.typeLabel}
              </Typography>
            ) : null}
            <Link
              href={result.href}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              color="primary"
              underline="hover"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "0.7rem",
                ml: "auto",
              }}
            >
              View on Blizzard
              <LaunchRoundedIcon fontSize="inherit" />
            </Link>
          </Stack>
        </Stack>
      </Card>
    );
  }

  // Vertical card — used for large artwork (creature displays, framed media, etc.)
  return (
    <Card
      variant="outlined"
      {...interactiveProps}
      sx={{
        width: width ?? "100%",
        height: "100%",
        minHeight: 300,
        display: "flex",
        flexDirection: "column",
        borderColor: `${accentColor}33`,
        cursor: onClick ? "pointer" : "default",
        ...cardInteractionSx,
      }}
    >
      {effectiveMediaUrl ? (
        <Box
          sx={{
            width: "100%",
            height: resolvedMediaHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: `1px solid ${accentColor}22`,
            backgroundColor: "rgba(7, 12, 24, 0.72)",
            overflow: "hidden",
          }}
        >
          <Box
            component="img"
            src={effectiveMediaUrl}
            alt={result.name}
            className="result-card-media"
            onError={() => setImgFailed(true)}
            sx={{
              width: mediaMode === "framed" ? "auto" : "100%",
              height: mediaMode === "framed" ? "auto" : "100%",
              maxWidth:
                mediaMode === "framed"
                  ? `min(100%, ${resolvedMediaHeight - 16}px)`
                  : "100%",
              maxHeight:
                mediaMode === "framed" ? resolvedMediaHeight - 16 : "100%",
              objectFit: mediaMode === "framed" ? "contain" : "cover",
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            width: "100%",
            height: resolvedMediaHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: `1px solid ${accentColor}22`,
            background: `linear-gradient(145deg, ${accentColor}18, rgba(7, 12, 24, 0.92))`,
            color: "text.primary",
            fontSize: "3rem",
            fontWeight: 700,
            letterSpacing: "-0.08em",
          }}
        >
          {result.name.slice(0, 1)}
        </Box>
      )}
      <CardHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {result.name}
            </Typography>
            {result.tag ? (
              <Chip
                label={result.tag}
                size="small"
                sx={{
                  borderRadius: 2,
                  backgroundColor: `${accentColor}22`,
                  color: `${accentColor}cc`,
                  fontWeight: 600,
                }}
              />
            ) : null}
          </Stack>
        }
        subheader={result.summary}
        sx={{
          pb: result.details ? 0 : 2,
          px: 2,
          pt: 2,
          "& .MuiCardHeader-title": {
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          },
          "& .MuiCardHeader-subheader": {
            color: "text.secondary",
            fontWeight: 500,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          },
        }}
      />
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          flex: 1,
          px: 2,
          py: 2,
        }}
      >
        {result.details ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {result.details}
          </Typography>
        ) : null}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mt="auto"
        >
          <Typography variant="caption" color="text.secondary">
            {result.typeLabel}
          </Typography>
          <Link
            href={result.href}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            color="primary"
            underline="hover"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
          >
            View on Blizzard
            <LaunchRoundedIcon fontSize="inherit" />
          </Link>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ResultCard;
