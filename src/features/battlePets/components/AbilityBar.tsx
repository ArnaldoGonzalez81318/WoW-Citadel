import { Box, ButtonBase, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { FamilyIcon, familyColor } from "@/features/battlePets/components/FamilyBadge";
import { familyById } from "@/features/battlePets/config/petFamilies";
import { abilityQuery } from "@/features/battlePets/hooks/battlePetQueries";
import { useAbilityIcon } from "@/features/battlePets/hooks/useIcons";
import { abilityTiming } from "@/features/battlePets/services/battlePetService";
import type { PetAbilitySlotRef } from "@/features/battlePets/types";
import { focusRing, mixins } from "@/theme";

export type AbilityBarProps = {
  abilities: readonly PetAbilitySlotRef[];
  onOpenAbility: (ability: PetAbilitySlotRef) => void;
};

/** 12px padding, a 21px name and two 18px caption lines. */
const CELL_MIN_HEIGHT = 80;

const captionSx = {
  ...mixins.truncate,
  display: "block",
  lineHeight: "18px",
} as const;

/**
 * One ability in the bar: its icon (with its family's), name, the level it
 * unlocks at, its family and timing. A button: it opens the ability's own
 * dialog over the pet's.
 */
const AbilityCell = ({
  slotAbility,
  onOpen,
}: {
  slotAbility: PetAbilitySlotRef;
  onOpen: (ability: PetAbilitySlotRef) => void;
}): JSX.Element => {
  const query = useQuery(abilityQuery(slotAbility.id));
  const ability = query.data;
  const icon = useAbilityIcon(ability);
  const family = familyById(ability?.family?.id);

  let details: JSX.Element;
  if (query.isPending) {
    details = <Skeleton variant="text" width="70%" />;
  } else if (!ability) {
    details = (
      <Typography variant="caption" color="text.secondary" component="span" sx={captionSx}>
        {query.isError ? "Details unavailable" : "Not in Blizzard's ability data"}
      </Typography>
    );
  } else {
    details = (
      <Typography variant="caption" color="text.secondary" component="span" sx={captionSx}>
        {abilityTiming(ability)}
      </Typography>
    );
  }

  return (
    <ButtonBase
      onClick={() => onOpen(slotAbility)}
      sx={(theme) => ({
        width: "100%",
        minHeight: CELL_MIN_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 1.25,
        px: 1.25,
        py: 1.25,
        textAlign: "left",
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.default}`,
        backgroundColor: theme.palette.surface.inset,
        transition: theme.transitions.create(["border-color", "background-color"], {
          duration: theme.wc.motion.base,
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
      <Box sx={{ position: "relative", flexShrink: 0 }}>
        <MediaTile
          size={40}
          src={icon.src}
          alt=""
          fallbackLabel={slotAbility.name}
          loading={query.isPending || icon.pending}
        />
        {family && ability?.family ? (
          <Box sx={{ position: "absolute", right: -4, bottom: -4 }}>
            <FamilyIcon family={family} size={16} name={ability.family.name} />
          </Box>
        ) : null}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="subtitle2"
          component="span"
          title={slotAbility.name}
          sx={{ ...mixins.truncate, display: "block", fontWeight: 600 }}
        >
          {slotAbility.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="span" sx={captionSx}>
          {`Level ${slotAbility.requiredLevel}`}
          {ability?.family ? (
            <>
              {" · "}
              <Box
                component="span"
                sx={(theme) => ({ color: familyColor(theme, ability.family?.id), fontWeight: 600 })}
              >
                {ability.family.name}
              </Box>
            </>
          ) : null}
        </Typography>
        {details}
      </Box>
    </ButtonBase>
  );
};

/**
 * The pet's battle abilities as the game's bar draws them: three slots,
 * each with the abilities Blizzard lists for it and the level each unlocks
 * at. Slots stack below `md` (their two abilities side by side from `sm`,
 * one under the other on phones) and sit in three columns from `md` up,
 * where the dialog is wide enough for three.
 */
const AbilityBar = ({ abilities, onOpenAbility }: AbilityBarProps): JSX.Element => {
  const baseId = useId();
  const slots = Array.from(new Set(abilities.map((ability) => ability.slot))).sort(
    (left, right) => left - right,
  );

  return (
    <Box
      component="ul"
      role="list"
      aria-label="Ability slots"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: `repeat(${Math.max(slots.length, 1)}, minmax(0, 1fr))`,
        },
      }}
    >
      {slots.map((slot) => {
        const labelId = `${baseId}-slot-${slot}`;
        const inSlot = abilities.filter((ability) => ability.slot === slot);
        return (
          <Box component="li" key={slot} sx={{ minWidth: 0 }}>
            <Typography
              id={labelId}
              variant="caption"
              component="p"
              color="text.secondary"
              sx={{ m: 0, mb: 0.75, fontWeight: 600 }}
            >
              {`Slot ${slot + 1}`}
            </Typography>
            <Box
              component="ul"
              role="list"
              aria-labelledby={labelId}
              sx={{
                listStyle: "none",
                m: 0,
                p: 0,
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "minmax(0, 1fr)",
                },
              }}
            >
              {inSlot.map((ability) => (
                <Box
                  component="li"
                  key={`${ability.id}-${ability.requiredLevel}`}
                  sx={{ minWidth: 0 }}
                >
                  <AbilityCell slotAbility={ability} onOpen={onOpenAbility} />
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default AbilityBar;
