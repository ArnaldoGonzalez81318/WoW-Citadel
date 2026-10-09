import CastleRounded from "@mui/icons-material/CastleRounded";
import { Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import StripCard, {
  StripCardError,
  StripCardSkeleton,
} from "@/features/home/components/StripCard";
import { HOME_PATHS, journalSeason } from "@/features/home/config/homeLinks";
import { journalTierQuery } from "@/features/journal/hooks/journalQueries";
import {
  CURRENT_SEASON_TIER_ID,
  pluralize,
} from "@/features/journal/services/journalService";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import { mixins } from "@/theme";

const ID = "home-week-raids";
const OVERLINE = "Raids";

/**
 * The raids the Encounter Journal files under its Current Season tier,
 * counted and named as Blizzard lists them (one request, about 2.5 KB, a
 * day fresh, shared with the hero art and the Raids panel). Blizzard's list
 * includes "Midnight", an entry with no location and only a Normal mode;
 * it is counted like the others, and the copy only ever says "in the
 * Encounter Journal" so it claims nothing more about it.
 */
const RaidsCard = (): JSX.Element => {
  const tierQuery = useQuery(journalTierQuery(CURRENT_SEASON_TIER_ID));
  const tierError = useStickyError(tierQuery);
  const tier = tierQuery.data;

  if (tier === undefined) {
    if (tierError) {
      return (
        <StripCardError
          id={ID}
          icon={<CastleRounded />}
          overline={OVERLINE}
          error={tierError}
          context="this season's raids"
          onRetry={() => void tierQuery.refetch()}
          linkLabel="Open the Journal"
          to={HOME_PATHS.journal}
        />
      );
    }
    return <StripCardSkeleton label="Loading this season's raids" />;
  }

  if (tier === null || tier.raids.length === 0) {
    return (
      <StripCard
        id={ID}
        icon={<CastleRounded />}
        overline={OVERLINE}
        title="No raids listed this season"
        details={
          <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
            The Encounter Journal lists none right now
          </Typography>
        }
        cue="Bosses and loot"
        to={HOME_PATHS.journal}
      />
    );
  }

  return (
    <StripCard
      id={ID}
      icon={<CastleRounded />}
      overline={OVERLINE}
      title={pluralize(tier.raids.length, "raid", "raids")}
      details={
        <>
          <Typography
            variant="body2"
            color="text.secondary"
            component="span"
            sx={{ ...mixins.truncate, display: "block" }}
          >
            {`In the Encounter Journal's ${tier.name} tier`}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="span"
            sx={mixins.lineClamp(2)}
          >
            {tier.raids.map((raid) => raid.name).join(", ")}
          </Typography>
        </>
      }
      cue="Bosses and loot"
      to={journalSeason()}
    />
  );
};

export default RaidsCard;
