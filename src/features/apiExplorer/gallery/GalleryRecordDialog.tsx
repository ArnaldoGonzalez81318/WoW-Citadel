import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import { Button, Typography } from "@mui/material";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import type { GalleryCard } from "@/features/apiExplorer/gallery/normalizeRecords";
import { WOWHEAD_LABEL } from "@/lib/externalLinks";

export type GalleryRecordDialogProps = {
  /** The live card from the sections (re-renders as enrichment lands); null closes. */
  card: GalleryCard | null;
  /** The card's media/detail enrichment is still in flight. */
  enriching: boolean;
  /** The enrichment failed (rate limit, network); rendered as an ErrorState. */
  error?: unknown;
  onClose: () => void;
  onRetry?: () => void;
};

const ICON_URL_PATTERN = /\/icons\/56\//u;

const NO_METADATA_HINT =
  "Blizzard provides no additional metadata for this record.";

/**
 * Record details on top of DetailDialog: h2 title with the close button
 * outside the heading, focus restored to the card on close. The API `href`
 * is never shown; the only link is the public (Wowhead) page when known.
 */
const GalleryRecordDialog = ({
  card,
  enriching,
  error,
  onClose,
  onRetry,
}: GalleryRecordDialogProps): JSX.Element => {
  const name = card?.name ?? "Record details";
  const mediaUrl = card?.mediaUrl;

  const rows: DetailDialogRow[] = card
    ? [
        ...(card.tag ? [{ label: "Tag", value: card.tag }] : []),
        ...(card.meta ?? []),
      ]
    : [];

  const sections: DetailDialogSection[] = card?.summary
    ? [{ heading: "Summary", content: card.summary }]
    : [];

  const hasContent = rows.length > 0 || sections.length > 0;
  const settledWithoutMetadata =
    card !== null && !enriching && error === undefined && !hasContent;

  return (
    <DetailDialog
      open={card !== null}
      onClose={onClose}
      title={name}
      subtitle={card?.typeLabel}
      media={{
        src: mediaUrl,
        alt: name,
        kind: !mediaUrl || ICON_URL_PATTERN.test(mediaUrl) ? "icon" : "artwork",
        loading: enriching && !mediaUrl,
      }}
      rows={rows}
      sections={sections}
      // Facts known from the index stay visible while the detail hop runs;
      // the skeleton only replaces an otherwise empty body.
      loading={enriching && !hasContent}
      error={error}
      onRetry={onRetry}
      errorContext="record details"
      actions={
        card?.externalUrl ? (
          <Button
            component="a"
            href={card.externalUrl}
            target="_blank"
            rel="noreferrer"
            endIcon={<LaunchRoundedIcon />}
          >
            {card.externalLabel ?? WOWHEAD_LABEL}
          </Button>
        ) : undefined
      }
    >
      {settledWithoutMetadata ? (
        <Typography variant="body2" color="text.secondary">
          {NO_METADATA_HINT}
        </Typography>
      ) : undefined}
    </DetailDialog>
  );
};

export default GalleryRecordDialog;
