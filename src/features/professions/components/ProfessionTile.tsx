import { Card, CardActionArea, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import { professionIconQuery } from "@/features/professions/hooks/professionQueries";
import {
  formatSkillRange,
  pluralize,
} from "@/features/professions/services/professionService";
import type { Profession } from "@/features/professions/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

/** Every tile is this tall, so the loading grid can match it exactly. */
export const PROFESSION_TILE_HEIGHT = 148;

export type ProfessionTileProps = {
  profession: Profession;
  selected: boolean;
  /** An internal crafting line: no backdrop, its description as the caption. */
  muted?: boolean;
  onSelect: (professionId: number) => void;
};

/** "12 expansions", Archaeology's skill range, or an internal line's own blurb. */
const captionOf = (profession: Profession, muted: boolean): string | undefined => {
  if (profession.skillTiers.length > 0) {
    return pluralize(profession.skillTiers.length, "expansion", "expansions");
  }
  const range = formatSkillRange(profession.minimumSkill, profession.maximumSkill);
  if (range) {
    return range;
  }
  return muted ? profession.description : undefined;
};

/**
 * One profession: its icon over a blurred copy of itself, the name and a
 * one-line caption. A toggle button (aria-pressed) in a set of them: the
 * pressed tile is the profession shown below the gallery. The icon loads
 * once the tile nears the viewport.
 */
const ProfessionTile = ({
  profession,
  selected,
  muted = false,
  onSelect,
}: ProfessionTileProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({
    ...professionIconQuery(profession.id),
    enabled: near,
  });
  const icon = iconQuery.data ?? null;
  const caption = captionOf(profession, muted);
  const captionId = useId();

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx(selected)}>
      {/* The backdrop paints over the card's own box-shadow, so it stops
          1px short of the border to leave the selected ring's inset pixel
          clear. The action area's focus ring needs no help: ButtonBase is
          already position: relative and comes later, so it paints on top. */}
      {muted ? null : (
        <IconBackdrop
          src={icon}
          opacity={selected ? 0.55 : 0.4}
          sx={{ inset: "1px", borderRadius: "inherit" }}
        />
      )}
      <CardActionArea
        onClick={() => onSelect(profession.id)}
        aria-label={profession.name}
        aria-pressed={selected}
        aria-describedby={caption ? captionId : undefined}
        sx={{
          ...cardActionAreaSx,
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          minHeight: PROFESSION_TILE_HEIGHT,
          px: 1,
          py: 2,
          gap: 1,
        }}
      >
        <MediaTile
          size={56}
          src={icon}
          alt=""
          fallbackLabel={profession.name}
          loading={iconQuery.isPending}
          radius="md"
          sx={(theme) => ({
            position: "relative",
            boxShadow: theme.palette.glow.card,
          })}
        />
        {/* A heading may not sit inside the action area's <button>; its
            aria-label names the tile instead. Two columns at 320px leave
            ~100px, so "Leatherworking" hyphenates onto a second line rather
            than losing its end to an ellipsis. */}
        <Typography
          variant="subtitle2"
          component="span"
          sx={{
            ...mixins.lineClamp(2),
            hyphens: "auto",
            position: "relative",
            maxWidth: "100%",
            fontSize: { xs: "0.8125rem", sm: "0.875rem" },
            color: selected ? "primary.light" : "text.primary",
          }}
        >
          {profession.name}
        </Typography>
        {caption ? (
          <Typography
            id={captionId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{
              ...mixins.lineClamp(muted ? 2 : 1),
              position: "relative",
              maxWidth: "100%",
              marginTop: -0.5,
            }}
          >
            {caption}
          </Typography>
        ) : null}
      </CardActionArea>
    </Card>
  );
};

export default ProfessionTile;
