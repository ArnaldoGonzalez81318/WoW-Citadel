import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import { journalInstanceQuery } from "@/features/journal/hooks/journalQueries";
import {
  categoryLabel,
  hasKeystoneMode,
  pluralize,
} from "@/features/journal/services/journalService";
import type { JournalInstance, JournalRef } from "@/features/journal/types";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { mixins } from "@/theme";

/**
 * The text block under the 2:1 art: 16px padding, the name, the origin
 * line and the chip footer. The loading grid uses it to match the cards.
 */
export const INSTANCE_CARD_TEXT_HEIGHT = 120;

export type InstanceCardProps = {
  instance: JournalRef;
  /** The Current Season mixes expansions: name each card's own. */
  showExpansion: boolean;
  onSelect: (instance: JournalRef) => void;
};

/** "Battle for Azeroth · Zuldazar", or just the location within one expansion. */
const originLine = (
  instance: JournalInstance | undefined,
  showExpansion: boolean,
): string =>
  [showExpansion ? instance?.expansion?.name : undefined, instance?.location]
    .filter(Boolean)
    .join(" · ") ||
  categoryLabel(instance?.category) ||
  "";

/**
 * One dungeon or raid: its zone art as a 2:1 banner, name, location and a
 * footer with the boss count, minimum level and a Mythic+ badge. The record
 * and art only load once the card nears the viewport (Classic alone lists
 * 28 instances). The whole card opens the instance.
 */
const InstanceCard = ({
  instance: summary,
  showExpansion,
  onSelect,
}: InstanceCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...journalInstanceQuery(summary.id), enabled: near });
  const instance = query.data ?? undefined;
  const loading = query.isPending;
  const origin = originLine(instance, showExpansion);
  const bossCount = instance?.encounters.length ?? 0;
  const keystone = instance ? hasKeystoneMode(instance.modes) : false;
  const hasFooter = bossCount > 0 || instance?.minimumLevel !== undefined || keystone;
  // The button's aria-label replaces its content, so the visible details are
  // its description: the only way to tell same-name entries apart by ear
  // (Blackrock Depths is both a Classic dungeon and a Classic raid).
  const detailsId = useId();
  const describedBy = [
    origin ? `${detailsId}-origin` : undefined,
    hasFooter ? `${detailsId}-footer` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onSelect(summary)}
        aria-label={`Open ${summary.name}`}
        aria-describedby={describedBy || undefined}
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        {/* The tile fills its parent; this box gives it the art's 2:1 shape
            (600×300) instead of the card's full height. */}
        <Box sx={{ width: "100%", aspectRatio: "2 / 1", flexShrink: 0 }}>
          <MediaTile
            size="fill"
            aspect="2 / 1"
            src={instance?.imageUrl ?? undefined}
            alt=""
            fallbackLabel={summary.name}
            loading={loading}
          />
        </Box>
        {/* useFlexGap: Stack's sibling margins would override the footer's marginTop auto. */}
        <Stack
          spacing={1}
          useFlexGap
          sx={{ p: 2, flex: 1, width: "100%", minWidth: 0, minHeight: INSTANCE_CARD_TEXT_HEIGHT }}
        >
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="subtitle1"
            component="span"
            sx={{ ...mixins.truncate, display: "block", m: 0 }}
          >
            {summary.name}
          </Typography>

          {loading ? (
            <Skeleton variant="text" width="60%" sx={{ fontSize: "0.75rem" }} />
          ) : origin ? (
            <Typography
              id={`${detailsId}-origin`}
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ ...mixins.truncate, m: 0 }}
            >
              {origin}
            </Typography>
          ) : null}

          {query.isError && !instance ? (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              Details unavailable
            </Typography>
          ) : null}

          {loading ? (
            <Skeleton variant="rounded" width={88} height={24} sx={{ mt: "auto" }} />
          ) : null}

          {hasFooter ? (
            <Stack
              id={`${detailsId}-footer`}
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              alignItems="center"
              sx={{ mt: "auto", pt: 0.5 }}
            >
              {bossCount > 0 ? (
                <Chip size="small" label={pluralize(bossCount, "boss", "bosses")} />
              ) : null}
              {keystone ? <Chip size="small" variant="outlined" label="Mythic+" /> : null}
              {instance?.minimumLevel !== undefined ? (
                <Box component="span" sx={{ typography: "caption", color: "text.secondary" }}>
                  {`Level ${formatNumber(instance.minimumLevel)}+`}
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default InstanceCard;
