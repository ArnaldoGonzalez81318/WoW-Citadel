import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";

import MediaTile from "@/components/common/MediaTile";
import type {
  CovenantCardData,
  CovenantSummary,
} from "@/features/covenants/types";
import { mixins } from "@/theme";

export type CovenantCardProps = {
  summary: CovenantSummary;
  data?: CovenantCardData;
  loading?: boolean;
  failed?: boolean;
  onSelect: () => void;
};

const CARD_MIN_HEIGHT = 232;

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT =
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

const maxRenownLevel = (data: CovenantCardData | undefined): number =>
  data
    ? data.detail.renownRewards.reduce(
        (max, reward) => Math.max(max, reward.level),
        0,
      )
    : 0;

const cardSx = (theme: Theme) => ({
  height: "100%",
  minHeight: CARD_MIN_HEIGHT,
  display: "flex",
  transition: theme.transitions.create(
    ["border-color", "box-shadow", "transform"],
    {
      duration: theme.wc.motion.base,
      easing: theme.wc.motion.easing,
    },
  ),
  [MOTION_HOVER]: {
    "&:hover": {
      borderColor: theme.palette.border.strong,
      boxShadow: theme.palette.glow.card,
    },
  },
  [MOTION_HOVER_LIFT]: {
    "&:hover": {
      transform: "translateY(-2px)",
    },
  },
});

/**
 * One covenant in the grid: icon, name, signature ability, a three-line
 * description and fact chips. The whole card opens the dialog.
 */
const CovenantCard = ({
  summary,
  data,
  loading = false,
  failed = false,
  onSelect,
}: CovenantCardProps): JSX.Element => {
  const detail = data?.detail;
  const signatureName = detail?.signatureAbility?.spellTooltip?.spell?.name;
  const renownMax = maxRenownLevel(data);

  return (
    <Card variant="outlined" sx={cardSx}>
      <CardActionArea
        onClick={onSelect}
        aria-label={`View ${summary.name} details`}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          textAlign: "left",
          p: 2.5,
          minHeight: CARD_MIN_HEIGHT,
          "& .MuiCardActionArea-focusHighlight": { display: "none" },
        }}
      >
        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <MediaTile
              src={data?.iconUrl ?? undefined}
              alt=""
              size={56}
              fallbackLabel={summary.name}
              loading={loading}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {/* A heading may not sit inside the action area's <button>;
                  the button's aria-label names the card instead. */}
              <Typography
                variant="h5"
                component="span"
                sx={{ ...mixins.truncate, display: "block", margin: 0 }}
              >
                {summary.name}
              </Typography>
              {signatureName ? (
                <Typography
                  variant="caption"
                  component="p"
                  sx={{ ...mixins.truncate, margin: 0 }}
                >
                  Signature: {signatureName}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          {loading ? (
            <Stack spacing={1} aria-hidden="true">
              <Skeleton variant="text" sx={{ fontSize: "0.875rem" }} />
              <Skeleton variant="text" sx={{ fontSize: "0.875rem" }} />
              <Skeleton
                variant="text"
                sx={{ fontSize: "0.875rem", width: "60%" }}
              />
            </Stack>
          ) : failed || !detail ? (
            <Typography variant="caption" color="text.secondary" component="p">
              Details unavailable
            </Typography>
          ) : (
            <>
              {detail.description ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="p"
                  sx={{ ...mixins.lineClamp(3), margin: 0 }}
                >
                  {detail.description}
                </Typography>
              ) : null}
              <Stack
                direction="row"
                flexWrap="wrap"
                useFlexGap
                gap={1}
                sx={{ marginTop: "auto" }}
              >
                {detail.classAbilities.length > 0 ? (
                  <Chip
                    size="small"
                    label={`${detail.classAbilities.length} class abilities`}
                  />
                ) : null}
                {renownMax > 0 ? (
                  <Chip size="small" label={`Renown ${renownMax}`} />
                ) : null}
              </Stack>
            </>
          )}
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default CovenantCard;
