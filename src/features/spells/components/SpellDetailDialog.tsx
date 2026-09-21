import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import type { SearchResult } from "@/features/search/types";
import {
  fetchSpellDetail,
  fetchSpellIcon,
  spellKeys,
} from "@/features/spells/services/spellService";
import { getExternalLink } from "@/lib/externalLinks";

export type SpellDetailDialogProps = {
  spell: SearchResult | null;
  open: boolean;
  onClose: () => void;
};

/**
 * Spell detail dialog on top of the shared `DetailDialog`. The icon query
 * shares the card's cache key, so an already-loaded icon shows instantly.
 */
const SpellDetailDialog = ({
  spell,
  open,
  onClose,
}: SpellDetailDialogProps): JSX.Element | null => {
  // Keep the last spell through the close transition so the title never blanks.
  const lastSpellRef = useRef<SearchResult | null>(null);
  if (spell) {
    lastSpellRef.current = spell;
  }
  const shown = spell ?? lastSpellRef.current;
  const spellId = shown?.id ?? 0;
  const isActive = open && spell !== null;

  const detailQuery = useQuery({
    queryKey: spellKeys.detail(spellId),
    queryFn: ({ signal }) => fetchSpellDetail(spellId, signal),
    enabled: isActive,
  });

  const iconQuery = useQuery({
    queryKey: spellKeys.icon(spellId),
    queryFn: ({ signal }) => fetchSpellIcon(spellId, signal),
    enabled: isActive && !shown?.mediaUrl,
  });

  if (!shown) {
    return null;
  }

  const detail = detailQuery.data;
  const description = detail?.description?.trim() ?? "";

  const rows: DetailDialogRow[] = [
    {
      label: "Spell ID",
      value: (
        <Box
          component="span"
          sx={(theme) => ({ fontFamily: theme.wc.fontMono })}
        >
          {shown.id}
        </Box>
      ),
    },
  ];

  const sections: DetailDialogSection[] = description
    ? [{ heading: "Description", content: description }]
    : detailQuery.isSuccess
      ? [
          {
            heading: "Description",
            content: (
              <Typography
                variant="body2"
                component="p"
                color="text.secondary"
                sx={{ margin: 0 }}
              >
                No description available.
              </Typography>
            ),
          },
        ]
      : [];

  const external =
    shown.externalUrl !== undefined
      ? { url: shown.externalUrl, label: shown.externalLabel ?? "View on Wowhead" }
      : getExternalLink("spell", shown.id, shown.name);

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={shown.name}
      media={{
        src: shown.mediaUrl ?? iconQuery.data,
        alt: shown.name,
        kind: "icon",
        loading: !shown.mediaUrl && iconQuery.isPending,
      }}
      loading={detailQuery.isPending}
      error={detailQuery.error ?? undefined}
      onRetry={() => {
        void detailQuery.refetch();
      }}
      errorContext="spell details"
      rows={rows}
      sections={sections}
      actions={
        external ? (
          <Button
            component="a"
            href={external.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            endIcon={<OpenInNewRoundedIcon />}
          >
            {external.label}
          </Button>
        ) : undefined
      }
      maxWidth="sm"
    />
  );
};

export default SpellDetailDialog;
