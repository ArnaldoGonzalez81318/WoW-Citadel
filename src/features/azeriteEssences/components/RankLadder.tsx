import CircleRounded from "@mui/icons-material/CircleRounded";
import DiamondRounded from "@mui/icons-material/DiamondRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { Box, Button, Link, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";

import MediaTile from "@/components/common/MediaTile";
import { powerSpellQuery } from "@/features/azeriteEssences/hooks/essenceQueries";
import type { Essence, EssencePower, NamedRef } from "@/features/azeriteEssences/types";
import { getExternalLink } from "@/lib/externalLinks";
import { visuallyHidden } from "@/theme";

type PowerKind = "major" | "minor";

const KIND_LABEL: Record<PowerKind, string> = {
  major: "Major power",
  minor: "Minor power",
};

/** The spell's tooltip text: its own load, failure and Retry inside the cell. */
const SpellText = ({ spellId }: { spellId: number }): JSX.Element => {
  const query = useQuery(powerSpellQuery(spellId));
  // A Retry puts a record with no data back to pending and clears its error;
  // errorUpdateCount survives, so the message (and the focused button) stay.
  const failed = query.data === undefined && query.errorUpdateCount > 0;

  if (failed) {
    const retrying = query.fetchStatus !== "idle";
    return (
      <Stack spacing={0.75} alignItems="flex-start">
        <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
          This power&apos;s tooltip could not be loaded.
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<RefreshRounded />}
          onClick={() => {
            if (!retrying) {
              void query.refetch();
            }
          }}
        >
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      </Stack>
    );
  }
  if (query.isPending) {
    return (
      <Box role="status" aria-label="Loading the tooltip">
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
      </Box>
    );
  }
  if (!query.data) {
    return (
      <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
        Blizzard has no record of this spell.
      </Typography>
    );
  }
  if (query.data.paragraphs.length === 0) {
    return (
      <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
        Blizzard gives this spell no description.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.75}>
      {query.data.paragraphs.map((paragraph, index) => (
        <Typography
          key={index}
          component="p"
          variant="body2"
          color="text.secondary"
          sx={{ margin: 0 }}
        >
          {paragraph}
        </Typography>
      ))}
    </Stack>
  );
};

/** The spell's icon, from the same (shared) query as its text. */
const SpellIcon = ({ spell }: { spell: NamedRef }): JSX.Element => {
  const query = useQuery(powerSpellQuery(spell.id));
  return (
    <MediaTile
      src={query.data?.iconUrl}
      alt=""
      size={40}
      fallbackLabel={spell.name}
      loading={query.isPending}
    />
  );
};

type PowerCellProps = {
  kind: PowerKind;
  spell: NamedRef | null;
  /** The previous rank's spell is this same one: say so instead of repeating it. */
  sameAsRank: number | null;
};

/** One power at one rank: icon, name (to Wowhead) and tooltip. */
const PowerCell = ({ kind, spell, sameAsRank }: PowerCellProps): JSX.Element => {
  const link = spell ? getExternalLink("spell", spell.id, spell.name) : undefined;
  return (
    <Box
      sx={(theme) => ({
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr)",
        columnGap: 1.25,
        alignItems: "start",
        padding: 1.5,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.subtle}`,
        backgroundColor:
          kind === "major"
            ? alpha(theme.palette.secondary.main, 0.04)
            : alpha(theme.palette.primary.main, 0.04),
      })}
    >
      {spell ? (
        <SpellIcon spell={spell} />
      ) : (
        <Box aria-hidden="true" sx={{ width: 40, height: 40 }} />
      )}
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          variant="overline"
          color="text.secondary"
          sx={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 0.5, lineHeight: 1.4 }}
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
          {KIND_LABEL[kind]}
        </Typography>
        {spell ? (
          <>
            {link ? (
              <Link
                href={link.url}
                target="_blank"
                rel="noreferrer"
                underline="hover"
                variant="subtitle2"
                sx={{ overflowWrap: "anywhere", alignSelf: "flex-start" }}
              >
                {spell.name}
                <Box component="span" sx={visuallyHidden}>
                  {" (opens Wowhead in a new tab)"}
                </Box>
              </Link>
            ) : (
              <Typography component="p" variant="subtitle2" sx={{ margin: 0 }}>
                {spell.name}
              </Typography>
            )}
            {sameAsRank !== null ? (
              <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
                {`The same spell as rank ${sameAsRank}.`}
              </Typography>
            ) : (
              <SpellText spellId={spell.id} />
            )}
          </>
        ) : (
          <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
            {`No ${kind} power at this rank.`}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

/** ◆◆◇◇ for rank 2 of 4. Decorative: the heading says the rank. */
const RankPips = ({ rank, max }: { rank: number; max: number }): JSX.Element => (
  <Stack direction="row" spacing={0.25} aria-hidden="true">
    {Array.from({ length: max }, (_, index) => (
      <DiamondRounded
        key={index}
        sx={(theme) => ({
          fontSize: 12,
          color:
            index < rank ? theme.palette.secondary.main : alpha(theme.palette.text.secondary, 0.3),
        })}
      />
    ))}
  </Stack>
);

const sameSpell = (left: NamedRef | null | undefined, right: NamedRef | null): boolean =>
  Boolean(left && right && left.id === right.id);

/**
 * The rank ladder: each rank's major and minor power with icons and tooltips
 * (the spells load for the open essence only). A rank whose spells are
 * both the previous rank's says so in a line instead of repeating them:
 * Blizzard lists rank 4 with rank 3's spells for every essence.
 */
const RankLadder = ({ essence }: { essence: Essence }): JSX.Element => {
  if (essence.powers.length === 0) {
    return (
      <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
        Blizzard lists no ranks for this essence.
      </Typography>
    );
  }
  const maxRank = essence.powers.reduce((max, power) => Math.max(max, power.rank), 0);
  return (
    <Stack spacing={1.5}>
      <Typography component="p" variant="caption" color="text.secondary" sx={{ margin: 0 }}>
        Tooltip text comes from Blizzard&apos;s spell records as they stand today.
      </Typography>
      <Box
        component="ol"
        role="list"
        aria-label={`${essence.name} ranks`}
        sx={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}
      >
        {essence.powers.map((power: EssencePower, index) => {
          const previous = index > 0 ? essence.powers[index - 1] : undefined;
          const sameMajor = sameSpell(previous?.major, power.major);
          const sameMinor = sameSpell(previous?.minor, power.minor);
          return (
            <Box
              component="li"
              key={power.id}
              sx={(theme) => ({
                minWidth: 0,
                paddingLeft: 1.5,
                borderLeft: `2px solid ${alpha(theme.palette.secondary.main, 0.25 + (0.5 * power.rank) / Math.max(1, maxRank))}`,
              })}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography component="h4" variant="subtitle2" sx={{ margin: 0 }}>
                  {`Rank ${power.rank}`}
                </Typography>
                <RankPips rank={power.rank} max={maxRank} />
              </Stack>
              {previous && sameMajor && sameMinor ? (
                <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
                  {`Lists the same major and minor spells as rank ${previous.rank}.`}
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
                    gap: 1.25,
                  }}
                >
                  <PowerCell
                    kind="major"
                    spell={power.major}
                    sameAsRank={previous && sameMajor ? previous.rank : null}
                  />
                  <PowerCell
                    kind="minor"
                    spell={power.minor}
                    sameAsRank={previous && sameMinor ? previous.rank : null}
                  />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
};

export default RankLadder;
