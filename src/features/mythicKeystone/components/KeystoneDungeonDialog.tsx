import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type { DetailDialogRow } from "@/components/common/DetailDialog";
import { keystoneDungeonQuery } from "@/features/mythicKeystone/hooks/keystoneQueries";
import { formatTimer } from "@/features/mythicKeystone/services/mythicKeystoneService";
import type { KeystoneDungeonSummary } from "@/features/mythicKeystone/types";
import { WOWHEAD_LABEL, wowheadSearchUrl } from "@/lib/externalLinks";

export type KeystoneDungeonDialogProps = {
  /** Whether the dialog is showing; `dungeon` stays set through the close transition. */
  open: boolean;
  /** The dungeon to show (the last one opened). */
  dungeon: KeystoneDungeonSummary | null;
  /** This season's rotation, as reported by the leaderboard index. */
  inSeason: boolean;
  onClose: () => void;
};

/** The raw records behind the card, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (dungeonId: number): string =>
  `/api-explorer/mythic-keystone-dungeon?${new URLSearchParams({
    endpoint: "mythic-keystone-dungeon",
    dungeonId: String(dungeonId),
  }).toString()}`;

/**
 * A keystone dungeon in full: art, expansion and location, every upgrade
 * timer, the bosses and the Encounter Journal description. Reads the same
 * cache entry as the card, so opening it costs nothing once the card loaded.
 */
const KeystoneDungeonDialog = ({
  open,
  dungeon,
  inSeason,
  onClose,
}: KeystoneDungeonDialogProps): JSX.Element => {
  const query = useQuery({
    ...keystoneDungeonQuery(dungeon?.id ?? 0),
    enabled: dungeon !== null,
  });
  const data = dungeon ? query.data : undefined;
  const title = data?.name ?? dungeon?.name ?? "";
  const subtitle = [data?.expansion, data?.location].filter(Boolean).join(" · ");

  // A wing of a split dungeon shares its journal entry: say whose bosses these are.
  const bossesLabel =
    data?.instanceName && data.instanceName !== data.name
      ? `Bosses in ${data.instanceName}`
      : "Bosses";

  const rows: DetailDialogRow[] = [];
  if (data) {
    const [timer, ...upgrades] = data.timers;
    if (timer) {
      rows.push({ label: "Keystone timer", value: formatTimer(timer.durationMs) });
    }
    upgrades.forEach((upgrade) => {
      rows.push({
        label: `+${upgrade.level} upgrade`,
        value: `Under ${formatTimer(upgrade.durationMs)}`,
      });
    });
    // The record's own flag backs up the leaderboard pool when that is unavailable.
    rows.push({
      label: "This season",
      value: inSeason || data.isTracked ? "In rotation" : "Not in rotation",
    });
    if (data.bosses.length > 0) {
      rows.push({ label: bossesLabel, value: String(data.bosses.length) });
    }
  }

  const sections = data
    ? [
        ...(data.description
          ? [
              {
                heading: "About",
                content: (
                  <Typography variant="body2" color="text.secondary" component="p" sx={{ margin: 0 }}>
                    {data.description}
                  </Typography>
                ),
              },
            ]
          : []),
        ...(data.bosses.length > 0
          ? [
              {
                heading: bossesLabel,
                content: (
                  <Box component="ol" sx={{ m: 0, pl: 2.5, typography: "body2" }}>
                    {data.bosses.map((boss) => (
                      <li key={boss}>{boss}</li>
                    ))}
                  </Box>
                ),
              },
            ]
          : []),
      ]
    : undefined;

  const wowhead = title ? wowheadSearchUrl(title) : undefined;

  return (
    <DetailDialog
      open={open && dungeon !== null}
      onClose={onClose}
      title={title}
      subtitle={subtitle || undefined}
      media={{
        src: data?.imageUrl ?? undefined,
        alt: "",
        kind: "artwork",
        loading: query.isPending,
      }}
      rows={rows}
      sections={sections}
      loading={query.isPending}
      error={query.isError && !data ? query.error : undefined}
      onRetry={() => void query.refetch()}
      errorContext="dungeon details"
      actions={
        dungeon ? (
          <>
            <Button component={RouterLink} to={workbenchUrl(dungeon.id)} size="small">
              Open in API workbench
            </Button>
            {wowhead ? (
              <Button
                href={wowhead}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {WOWHEAD_LABEL}
              </Button>
            ) : null}
          </>
        ) : null
      }
    />
  );
};

export default KeystoneDungeonDialog;
