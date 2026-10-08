import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { Box, ButtonBase, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import FactionCrest from "@/features/reputations/components/FactionCrest";
import KindBadge from "@/features/reputations/components/KindBadge";
import LadderStrip from "@/features/reputations/components/LadderStrip";
import { factionQuery } from "@/features/reputations/hooks/reputationQueries";
import { useFactionVisual } from "@/features/reputations/hooks/useFactionVisual";
import type { AccentKey } from "@/features/reputations/services/reputationPalette";
import type { FactionRef } from "@/features/reputations/types";
import useNearViewport from "@/hooks/useNearViewport";
import { focusRing, truncate } from "@/theme";

const FactionLinkRow = ({
  faction,
  accent,
  onOpen,
}: {
  faction: FactionRef;
  accent: AccentKey;
  onOpen: (faction: FactionRef) => void;
}): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLLIElement>("200px 0px");
  const query = useQuery({ ...factionQuery(faction.id), enabled: near });
  const record = query.data;
  const visual = useFactionVisual(record, accent, near, query.isError);
  const name = record?.name ?? faction.name;

  return (
    <Box component="li" ref={nearRef} sx={{ minWidth: 0 }}>
      {/* No aria-label: the name, kind and summary inside are its accessible name. */}
      <ButtonBase
        onClick={() => onOpen({ id: faction.id, name })}
        sx={(theme) => ({
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 1.25,
          py: 1,
          textAlign: "left",
          borderRadius: `${theme.wc.radius.md}px`,
          border: `1px solid ${theme.palette.border.subtle}`,
          backgroundColor: theme.palette.surface.inset,
          transition: theme.transitions.create(["border-color", "background-color"], {
            duration: theme.wc.motion.fast,
          }),
          "@media (hover: hover)": {
            "&:hover": {
              borderColor: theme.palette.border.strong,
              backgroundColor: theme.palette.action.hover,
            },
          },
          "&.Mui-focusVisible": focusRing(theme),
        })}
      >
        <FactionCrest name={name} accent={accent} kind={record?.kind} size={36} />
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              component="span"
              sx={{ ...truncate, fontWeight: 600, flex: 1, minWidth: 0 }}
            >
              {name}
            </Typography>
            {record ? (
              <KindBadge kind={record.kind} />
            ) : query.isPending ? (
              <Skeleton variant="rounded" width={72} height={24} sx={{ borderRadius: 12 }} />
            ) : null}
          </Stack>
          <LadderStrip colors={visual.colors} height={4} />
          <Typography variant="caption" color="text.secondary" component="span" sx={truncate}>
            {record
              ? visual.summary
              : query.isError
                ? "Details unavailable"
                : record === null
                  ? "Not in Blizzard's game data"
                  : " "}
          </Typography>
        </Stack>
        <ChevronRightRoundedIcon aria-hidden="true" sx={{ color: "text.secondary", flexShrink: 0 }} />
      </ButtonBase>
    </Box>
  );
};

export type FactionLinkListProps = {
  label: string;
  factions: readonly FactionRef[];
  accent: AccentKey;
  onOpen: (faction: FactionRef) => void;
};

/**
 * A header's factions inside the dialog, each a button that shows it in
 * the dialog instead. Rows load their record as they scroll into view
 * (The Ember Court folds 16).
 */
const FactionLinkList = ({ label, factions, accent, onOpen }: FactionLinkListProps): JSX.Element => (
  <Box
    component="ul"
    role="list"
    aria-label={label}
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "grid",
      gap: 1,
      gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
    }}
  >
    {factions.map((faction, index) => (
      <FactionLinkRow
        key={`${faction.id}-${index}`}
        faction={faction}
        accent={accent}
        onOpen={onOpen}
      />
    ))}
  </Box>
);

export default FactionLinkList;
