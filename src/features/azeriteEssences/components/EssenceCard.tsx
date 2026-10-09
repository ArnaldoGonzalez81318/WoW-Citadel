import CircleRounded from "@mui/icons-material/CircleRounded";
import DiamondRounded from "@mui/icons-material/DiamondRounded";
import { Box, Card, CardActionArea, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import RoleTags from "@/features/azeriteEssences/components/RoleTags";
import {
  essenceIconQuery,
  essenceQuery,
} from "@/features/azeriteEssences/hooks/essenceQueries";
import {
  pluralize,
  powerNamesOf,
} from "@/features/azeriteEssences/services/azeriteEssenceService";
import type { EssenceSummary, RoleType } from "@/features/azeriteEssences/types";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, visuallyHidden } from "@/theme";

/**
 * The card's height with every line reserved (two name lines, both power
 * lines, the footer), so the grid skeleton is the same size and nothing
 * jumps when the records land.
 */
export const ESSENCE_CARD_HEIGHT = 214;
const NAME_LINES = 2;

export type EssenceCardProps = {
  essence: EssenceSummary;
  roles: readonly RoleType[];
  roleNames: Record<RoleType, string>;
  /** Classes among its specializations whose records loaded. */
  classCount: number;
  /** The spec records are still loading: roles and classes are not known yet. */
  rolesPending?: boolean;
  onSelect: (essence: EssenceSummary) => void;
};

type PowerLineProps = {
  kind: "major" | "minor";
  name: string | null;
  loading: boolean;
  /** What to say when there is no name to show. */
  missing: string;
};

/** "◆ Major  Concentrated Flame", one truncating line (the full name in a tooltip). */
const PowerLine = ({ kind, name, loading, missing }: PowerLineProps): JSX.Element => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "56px minmax(0, 1fr)",
      alignItems: "center",
      columnGap: 1,
      minHeight: 22,
    }}
  >
    <Typography
      component="span"
      variant="overline"
      color="text.secondary"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, lineHeight: 1 }}
    >
      {kind === "major" ? (
        <DiamondRounded
          aria-hidden="true"
          sx={(theme) => ({ fontSize: 12, color: theme.palette.secondary.main })}
        />
      ) : (
        <CircleRounded
          aria-hidden="true"
          sx={(theme) => ({ fontSize: 9, mx: "1.5px", color: theme.palette.primary.light })}
        />
      )}
      {kind === "major" ? "Major" : "Minor"}
    </Typography>
    {loading ? (
      <Skeleton variant="text" width="70%" sx={{ fontSize: "0.875rem" }} />
    ) : (
      <Typography
        component="span"
        variant="body2"
        title={name ?? undefined}
        color={name ? "text.primary" : "text.secondary"}
        sx={{ ...mixins.truncate, display: "block" }}
      >
        {name ?? missing}
      </Typography>
    )}
  </Box>
);

/**
 * One essence: its icon over a blurred wash of its own colours, the name,
 * the roles that can use it, its major and minor power, and how many
 * specializations and classes it is open to. Its record and icon load once
 * the card nears the viewport; the whole card opens the dialog.
 */
const EssenceCard = ({
  essence,
  roles,
  roleNames,
  classCount,
  rolesPending = false,
  onSelect,
}: EssenceCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const record = useQuery({ ...essenceQuery(essence.id), enabled: near });
  const icon = useQuery({ ...essenceIconQuery(essence.id), enabled: near });
  const { major, minor } = powerNamesOf(record.data);
  const detailsId = useId();

  let missing = "";
  if (record.data === null) {
    missing = "Not in Blizzard's game data";
  } else if (record.isError) {
    missing = "Powers unavailable";
  } else if (record.data) {
    missing = "None listed";
  }

  const specLine: ReactNode =
    classCount > 0 && !rolesPending
      ? `${pluralize(essence.specs.length, "specialization", "specializations")} · ${pluralize(classCount, "class", "classes")}`
      : pluralize(essence.specs.length, "specialization", "specializations");

  return (
    <Card
      ref={nearRef}
      variant="outlined"
      sx={[selectableCardSx(), { minHeight: ESSENCE_CARD_HEIGHT }]}
    >
      <CardActionArea
        onClick={() => onSelect(essence)}
        aria-label={`View ${essence.name} details`}
        aria-describedby={`${detailsId}-roles ${detailsId}-powers ${detailsId}-specs`}
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        <Box
          sx={(theme) => ({
            position: "relative",
            overflow: "hidden",
            px: 2,
            pt: 2,
            pb: 1.5,
            background: `radial-gradient(120% 140% at 0% 0%, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0)} 60%)`,
          })}
        >
          <IconBackdrop src={icon.data} opacity={0.45} />
          <Stack direction="row" spacing={1.5} sx={{ position: "relative", minWidth: 0 }}>
            <MediaTile
              src={icon.data}
              alt=""
              size={56}
              fallbackLabel={essence.name}
              loading={icon.isPending}
              radius="md"
              sx={(theme) => ({
                borderColor: theme.palette.border.gold,
                boxShadow: `0 0 0 3px ${alpha(theme.palette.secondary.main, 0.08)}, 0 6px 18px ${alpha(theme.palette.common.black, 0.4)}`,
              })}
            />
            <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
              {/* A heading may not sit inside the action area's <button>;
                  its aria-label names the card instead. */}
              <Typography
                component="span"
                variant="subtitle1"
                sx={(theme) => ({
                  ...mixins.lineClamp(NAME_LINES),
                  fontWeight: 600,
                  lineHeight: 1.35,
                  minHeight: `calc(${NAME_LINES} * 1.35 * ${String(theme.typography.subtitle1.fontSize)})`,
                })}
              >
                {essence.name}
              </Typography>
              {rolesPending ? (
                <Box component="span" id={`${detailsId}-roles`} sx={{ display: "block" }}>
                  <Skeleton variant="rounded" width={72} height={24} />
                  <Box component="span" sx={visuallyHidden}>
                    Roles loading
                  </Box>
                </Box>
              ) : (
                <RoleTags id={`${detailsId}-roles`} roles={roles} names={roleNames} />
              )}
            </Stack>
          </Stack>
        </Box>

        <Stack
          id={`${detailsId}-powers`}
          spacing={0.5}
          sx={(theme) => ({
            px: 2,
            py: 1.25,
            borderTop: `1px solid ${theme.palette.border.subtle}`,
          })}
        >
          <PowerLine kind="major" name={major} loading={record.isPending} missing={missing} />
          <PowerLine kind="minor" name={minor} loading={record.isPending} missing={missing} />
        </Stack>

        <Typography
          id={`${detailsId}-specs`}
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ ...mixins.truncate, display: "block", marginTop: "auto", px: 2, pb: 1.5 }}
        >
          {specLine}
        </Typography>
      </CardActionArea>
    </Card>
  );
};

export default EssenceCard;
