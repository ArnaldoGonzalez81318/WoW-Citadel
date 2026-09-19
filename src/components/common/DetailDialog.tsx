import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import type { DialogProps } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useId } from "react";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import { ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import { qualityColor } from "@/theme";

export type DetailDialogMedia = {
  src?: string | null;
  alt: string;
  /** icon → 56px tile beside the title; artwork → 16:9 banner under it. */
  kind: "icon" | "artwork";
  loading?: boolean;
};

export type DetailDialogRow = {
  label: string;
  value: ReactNode;
};

export type DetailDialogSection = {
  heading: string;
  content: ReactNode;
};

export type DetailDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  media?: DetailDialogMedia;
  /** WoW item quality: colours the title. */
  quality?: string | null;
  /** Label/value facts rendered as a definition list. */
  rows?: DetailDialogRow[];
  /** Longer content blocks, each under an h3. */
  sections?: DetailDialogSection[];
  /** Footer buttons / links. */
  actions?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** What the dialog loads, for the error copy ("item details"). */
  errorContext?: string;
  maxWidth?: DialogProps["maxWidth"];
  children?: ReactNode;
};

/**
 * Entity detail dialog: h2 title (aria-labelledby), close button outside the
 * heading, full-screen below `sm`, focus restored to the opener on close.
 */
const DetailDialog = ({
  open,
  onClose,
  title,
  subtitle,
  media,
  quality,
  rows,
  sections,
  actions,
  loading = false,
  error,
  onRetry,
  errorContext,
  maxWidth = "sm",
  children,
}: DetailDialogProps): JSX.Element => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const generatedId = useId();
  const titleId = `detail-dialog-${generatedId}-title`;

  const hasRows = Boolean(rows && rows.length > 0);
  const hasSections = Boolean(sections && sections.length > 0);
  const hasBody =
    loading ||
    error !== undefined ||
    hasRows ||
    hasSections ||
    (children !== undefined && children !== null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      fullScreen={fullScreen}
      fullWidth
      maxWidth={maxWidth}
      scroll="paper"
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          padding: "20px 20px 0 24px",
        }}
      >
        {media && media.kind === "icon" ? (
          <MediaTile
            src={media.src}
            alt={media.alt}
            size={56}
            fallbackLabel={title}
            quality={quality}
            loading={media.loading}
          />
        ) : null}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <DialogTitle
            id={titleId}
            component="h2"
            sx={{
              padding: 0,
              ...theme.typography.h4,
              color: quality ? qualityColor(theme, quality) : "inherit",
              wordBreak: "break-word",
            }}
          >
            {title}
          </DialogTitle>
          {subtitle ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ marginTop: 0.5 }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="medium"
          sx={{ flexShrink: 0, marginTop: -0.5, marginRight: -1 }}
        >
          <CloseRounded />
        </IconButton>
      </Box>

      {media && media.kind === "artwork" ? (
        <Box sx={{ padding: "16px 24px 0" }}>
          <MediaTile
            src={media.src}
            alt={media.alt}
            size="fill"
            aspect="16/9"
            fallbackLabel={title}
            quality={quality}
            loading={media.loading}
            radius="md"
          />
        </Box>
      ) : null}

      {hasBody ? (
        <DialogContent sx={{ padding: "16px 24px 24px" }}>
          {loading ? (
            <LoadingSkeleton variant="block" height={200} label="Loading details" />
          ) : error !== undefined && error !== null ? (
            <ErrorState
              error={error}
              context={errorContext}
              onRetry={onRetry}
              compact
            />
          ) : (
            <Stack spacing={2.5}>
              {hasRows ? (
                <Box
                  component="dl"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "minmax(120px, max-content) 1fr",
                    },
                    columnGap: 2,
                    rowGap: { xs: 1.5, sm: 1 },
                    margin: 0,
                  }}
                >
                  {rows?.map((row, index) => (
                    <Box key={`${row.label}-${index}`} sx={{ display: "contents" }}>
                      <Typography
                        component="dt"
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 500,
                          alignSelf: "baseline",
                        }}
                      >
                        {row.label}
                      </Typography>
                      <Typography
                        component="dd"
                        variant="body2"
                        sx={{
                          margin: 0,
                          minWidth: 0,
                          wordBreak: "break-word",
                          alignSelf: "baseline",
                          marginBottom: { xs: 0.5, sm: 0 },
                        }}
                      >
                        {row.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : null}

              {sections?.map((section, index) => (
                <Box component="section" key={`${section.heading}-${index}`}>
                  <Typography
                    variant="overline"
                    component="h3"
                    sx={{ margin: 0, marginBottom: 0.75 }}
                  >
                    {section.heading}
                  </Typography>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ maxWidth: "72ch" }}
                  >
                    {section.content}
                  </Typography>
                </Box>
              ))}

              {children}
            </Stack>
          )}
        </DialogContent>
      ) : null}

      {actions ? (
        <DialogActions sx={{ padding: "0 24px 20px", gap: 1 }}>
          {actions}
        </DialogActions>
      ) : null}
    </Dialog>
  );
};

export default DetailDialog;
