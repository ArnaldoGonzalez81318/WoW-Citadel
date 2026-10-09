import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { memo, useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { MountFactionTag, SourceIcon } from "@/features/mounts/components/MountMeta";
import { mountRenderQuery } from "@/features/mounts/hooks/mountQueries";
import { pluralize } from "@/features/mounts/services/mountService";
import type { MountSummary } from "@/features/mounts/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, visuallyHidden } from "@/theme";

/**
 * The text block under the 4:3 render: 12px padding, two lines of name
 * (reserved, so every card in a row is the same height), the 20px source
 * line and the gap between them. The loading grid uses it to match the cards.
 */
export const MOUNT_CARD_TEXT_HEIGHT = 92;

/** Renders are dark grey; a translucent page tone keeps a badge legible on the model without hiding it. */
const badgeSx = (theme: Theme) => ({
  position: "absolute" as const,
  maxWidth: "calc(100% - 16px)",
  backgroundColor: alpha(theme.palette.background.default, 0.72),
  backdropFilter: "blur(4px)",
  border: `1px solid ${theme.palette.border.default}`,
});

export type MountCardProps = {
  mount: MountSummary;
  onSelect: (mount: MountSummary) => void;
};

/**
 * One mount: its model render (Blizzard's 600×600 zoom portrait, cropped to
 * 4:3 around the model), the faction for faction-only mounts, how many
 * display variants it has, the name and where it comes from. The render
 * only loads once the card nears the viewport; the whole card opens the
 * detail dialog. Memoised: a page change re-renders only the cards it swaps.
 */
const MountCard = ({ mount, onSelect }: MountCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const [displayId] = mount.displayIds;
  const renderQuery = useQuery({
    ...mountRenderQuery(displayId ?? 0),
    enabled: near && displayId !== undefined,
  });
  // The button's aria-label replaces its content, so the visible details are
  // its description: the only way to tell namesakes ("Whelpling" ×2) apart by ear.
  const detailsId = useId();
  const variants = mount.displayIds.length;
  const describedBy = [
    `${detailsId}-source`,
    mount.faction ? `${detailsId}-faction` : null,
    variants > 1 ? `${detailsId}-variants` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onSelect(mount)}
        aria-label={`View ${mount.name} details`}
        aria-describedby={describedBy}
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        {/* The tile fills its parent; this box gives it the 4:3 shape. */}
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "4 / 3", flexShrink: 0 }}>
          <MediaTile
            size="fill"
            aspect="4 / 3"
            src={renderQuery.data ?? null}
            alt=""
            fallbackLabel={mount.name}
            loading={displayId !== undefined && renderQuery.isPending}
          />
          {mount.faction ? (
            <Chip
              size="small"
              label={<MountFactionTag faction={mount.faction} id={`${detailsId}-faction`} />}
              sx={(theme) => ({ ...badgeSx(theme), top: 8, left: 8 })}
            />
          ) : null}
          {variants > 1 ? (
            <Chip
              id={`${detailsId}-variants`}
              size="small"
              icon={<PaletteRoundedIcon />}
              label={pluralize(variants, "variant", "variants")}
              sx={(theme) => ({ ...badgeSx(theme), bottom: 8, right: 8 })}
            />
          ) : null}
        </Box>
        <Stack
          spacing={0.75}
          useFlexGap
          sx={{ p: 1.5, width: "100%", minWidth: 0, minHeight: MOUNT_CARD_TEXT_HEIGHT }}
        >
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="subtitle2"
            component="span"
            sx={{ ...mixins.lineClamp(2), minHeight: "3em", hyphens: "auto" }}
          >
            {mount.name}
          </Typography>
          <Stack
            id={`${detailsId}-source`}
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ minWidth: 0, height: 20, color: "text.secondary" }}
          >
            <SourceIcon type={mount.source?.type} sx={{ fontSize: 16 }} />
            <Typography
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ ...mixins.truncate, minWidth: 0 }}
            >
              {mount.source?.name ?? "Source not listed"}
              <Box component="span" sx={visuallyHidden}>
                {`, mount ${mount.id}`}
              </Box>
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default memo(MountCard);
