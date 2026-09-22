import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { memo } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  populationChipColor,
  populationHint,
  statusChipColor,
} from "@/features/connectedRealms/services/connectedRealmService";
import type { ConnectedRealmSnapshot } from "@/features/connectedRealms/types";
import { formatTimezone } from "@/lib/format";
import { truncate } from "@/theme";

const MEMBER_PREVIEW = 3;

export type ConnectedRealmCardProps = {
  snapshot: ConnectedRealmSnapshot;
  /** Current search text: the matching member becomes the card title. */
  highlightQuery?: string;
};

const memberSummary = (names: string[]): string => {
  if (names.length <= MEMBER_PREVIEW) {
    return names.join(", ");
  }
  return `${names.slice(0, MEMBER_PREVIEW).join(", ")}, +${
    names.length - MEMBER_PREVIEW
  } more`;
};

const ConnectedRealmCard = ({
  snapshot,
  highlightQuery,
}: ConnectedRealmCardProps): JSX.Element => {
  const {
    realmDetails,
    realmTypes,
    timezones,
    statusLabel,
    statusType,
    populationLabel,
    populationType,
    has_queue: hasQueue,
  } = snapshot;

  const needle = highlightQuery?.trim().toLowerCase() ?? "";
  const lead =
    (needle.length > 0
      ? realmDetails.find(
          (realm) =>
            realm.name.toLowerCase().includes(needle) ||
            realm.slug.toLowerCase().includes(needle),
        )
      : undefined) ?? realmDetails[0];
  const leadName = lead?.name ?? lead?.slug ?? snapshot.leadName;
  const memberNames = realmDetails.map((realm) => realm.name || realm.slug);
  const memberCount = realmDetails.length;

  const populationColor = populationChipColor(populationType);
  const caption = [
    realmTypes.join(" · "),
    timezones.map((zone) => formatTimezone(zone)).join(" · "),
  ]
    .filter((part) => part.length > 0)
    .join(" · ");

  return (
    <Card
      variant="outlined"
      sx={(theme: Theme) => ({
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // A static card (only the footer buttons are interactive): no lift or
        // glow, which DESIGN.md reserves for CardActionArea cards.
        transition: theme.transitions.create("border-color", {
          duration: theme.wc.motion.base,
          easing: theme.wc.motion.easing,
        }),
        "@media (hover: hover)": {
          "&:hover": { borderColor: theme.palette.border.strong },
        },
      })}
    >
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          minWidth: 0,
          paddingBottom: 0,
        }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              component="p"
              title={leadName}
              sx={{ ...truncate, minWidth: 0, flex: 1, margin: 0 }}
            >
              {leadName}
            </Typography>
            {memberCount > 1 ? (
              <Chip size="small" label={`${memberCount} realms`} />
            ) : null}
          </Stack>
          <Typography
            variant="caption"
            component="p"
            color="text.secondary"
            title={caption}
            sx={{ ...truncate, margin: 0 }}
          >
            {caption || "—"}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {statusLabel ? (
            <Chip
              size="small"
              label={statusLabel}
              color={statusChipColor(statusType)}
              icon={
                statusType === "DOWN" ? (
                  <CloudOffRoundedIcon fontSize="small" />
                ) : (
                  <SensorsRoundedIcon fontSize="small" />
                )
              }
            />
          ) : null}
          {populationLabel ? (
            <Tooltip title={populationHint} describeChild enterTouchDelay={0}>
              <Chip
                tabIndex={0}
                size="small"
                label={populationLabel}
                color={populationColor}
                variant={populationColor === "default" ? "outlined" : "filled"}
              />
            </Tooltip>
          ) : null}
          {hasQueue ? (
            <Chip size="small" label="Queue active" color="warning" />
          ) : null}
        </Stack>

        <Tooltip title={memberNames.join(", ")} describeChild enterTouchDelay={0}>
          <Typography
            variant="body2"
            component="p"
            color="text.secondary"
            tabIndex={0}
            sx={{ ...truncate, margin: 0 }}
          >
            {memberSummary(memberNames)}
          </Typography>
        </Tooltip>
      </CardContent>

      <CardActions sx={{ mt: "auto", px: 2, pb: 2, gap: 1 }}>
        {/*
          Every connected realm has an auctions endpoint keyed by id; the
          search payload carries no `auctions` link, so the button is never
          gated on it.
        */}
        <Button
          size="small"
          variant="contained"
          component={RouterLink}
          to={`/category/auction-house?view=realm&realm=${snapshot.id}`}
          startIcon={<GavelRoundedIcon />}
        >
          View auctions
        </Button>
        {leadName ? (
          <Button
            size="small"
            variant="text"
            component={RouterLink}
            to={`/category/realm?q=${encodeURIComponent(leadName)}`}
          >
            Browse realms
          </Button>
        ) : null}
      </CardActions>
    </Card>
  );
};

// `snapshot` comes from the query cache and `highlightQuery` is a string, so
// the shallow comparison skips every card the scroll range did not change.
export default memo(ConnectedRealmCard);
