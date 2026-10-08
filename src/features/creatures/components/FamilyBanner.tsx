import { Avatar, Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Ref } from "react";

import MediaTile from "@/components/common/MediaTile";
import {
  creatureFamilyIconQuery,
  creatureFamilyQuery,
  petSpecializationQuery,
} from "@/features/creatures/hooks/creatureQueries";

export type FamilyBannerProps = {
  familyId: number;
  /** The family's name from the index, shown until its record loads. */
  fallbackName?: string;
  /** Focus target after a pick in the gallery. */
  headingRef?: Ref<HTMLHeadingElement>;
  onClear: () => void;
};

/**
 * The family the results are filtered to: icon, name, its hunter pet spec
 * with the spec's blurb, and a way back to every creature. Reads the cache
 * entries the gallery and its tiles filled, so it costs nothing after a pick
 * there; a shared link fetches the one family.
 */
const FamilyBanner = ({
  familyId,
  fallbackName,
  headingRef,
  onClear,
}: FamilyBannerProps): JSX.Element => {
  const familyQuery = useQuery(creatureFamilyQuery(familyId));
  const family = familyQuery.data;
  // Unknown until the record lands: ask anyway, a missing icon is a cached null.
  const iconQuery = useQuery({
    ...creatureFamilyIconQuery(familyId),
    enabled: family?.hasIcon !== false,
  });
  const spec = family?.specialization;
  const specQuery = useQuery({
    ...petSpecializationQuery(spec?.id ?? 0),
    enabled: spec !== undefined,
  });
  const name = family?.name ?? fallbackName ?? `Family #${familyId}`;
  // A refetch of a record with no data puts it back to pending, so only a
  // first load shows the skeleton: a Retry keeps the "unavailable" line and
  // its (focused) button on screen until the record lands or fails again.
  const firstLoad = familyQuery.isPending && familyQuery.errorUpdateCount === 0;
  const retrying = familyQuery.isFetching;

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 2,
        p: 2,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderRadius: `${theme.wc.radius.md}px`,
        backgroundColor: theme.palette.surface.inset,
      })}
    >
      <MediaTile
        size={56}
        src={iconQuery.data ?? null}
        alt=""
        fallbackLabel={name}
        loading={family?.hasIcon !== false && iconQuery.isPending}
        radius="md"
      />
      <Stack spacing={0.75} sx={{ flex: "1 1 220px", minWidth: 0 }}>
        <Typography
          ref={headingRef}
          variant="h6"
          component="h3"
          tabIndex={-1}
          // A script focus target only, never a Tab stop: no ring needed.
          sx={{ m: 0, overflowWrap: "anywhere", "&:focus": { outline: "none" } }}
        >
          {`${name} family`}
        </Typography>
        {firstLoad ? (
          <Skeleton variant="rounded" width={140} height={24} />
        ) : spec ? (
          <Box>
            <Chip
              size="small"
              variant="outlined"
              avatar={
                <Avatar alt="" src={specQuery.data?.iconUrl ?? undefined}>
                  {spec.name.charAt(0)}
                </Avatar>
              }
              label={`${spec.name} pets`}
            />
          </Box>
        ) : family ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            Not a hunter pet family
          </Typography>
        ) : (
          // The results below do not depend on the record; only its spec is missing.
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              Family details unavailable
            </Typography>
            {/* Never disabled while retrying: a disabled button drops its focus.
                A press meanwhile is ignored, since refetch() would cancel the
                attempt in flight and start it over. */}
            <Button
              size="small"
              onClick={() => {
                if (!retrying) {
                  void familyQuery.refetch();
                }
              }}
            >
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          </Stack>
        )}
        {specQuery.data?.description ? (
          <Typography
            variant="body2"
            color="text.secondary"
            component="p"
            sx={{ m: 0, maxWidth: "72ch" }}
          >
            {specQuery.data.description}
          </Typography>
        ) : null}
      </Stack>
      <Button size="small" variant="outlined" onClick={onClear} sx={{ flexShrink: 0 }}>
        Clear family
      </Button>
    </Box>
  );
};

export default FamilyBanner;
