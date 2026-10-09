import { Box, Button, ButtonBase, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import MediaTile from "@/components/common/MediaTile";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import AbilityBar from "@/features/battlePets/components/AbilityBar";
import {
  DialogActionsRow,
  DialogSection,
  FactList,
  Mono,
  workbenchUrl,
} from "@/features/battlePets/components/DialogParts";
import type { Fact } from "@/features/battlePets/components/DialogParts";
import FamilyBadge from "@/features/battlePets/components/FamilyBadge";
import FamilyMatchup, { MATCHUP_NOTE } from "@/features/battlePets/components/FamilyMatchup";
import {
  creatureDisplaysQuery,
  petQuery,
} from "@/features/battlePets/hooks/battlePetQueries";
import { usePetIcon } from "@/features/battlePets/hooks/useIcons";
import useStickyError from "@/features/battlePets/hooks/useStickyError";
import type { PetAbilitySlotRef } from "@/features/battlePets/types";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import { WOWHEAD_ORIGIN } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { focusRing } from "@/theme";

export type PetDialogProps = {
  /** Whether the dialog is showing; `petId` stays set through the close transition. */
  open: boolean;
  /** The pet to show (the last one opened). */
  petId: number | null;
  /** Its index name, shown until the record loads. */
  fallbackName?: string;
  /** Family id -> localized name, for the matchups. */
  familyNames: ReadonlyMap<number, string>;
  /** The family the pet list is filtered to, so the dialog does not offer it again. */
  activeFamilyId: number | null;
  onShowFamily: (familyId: number) => void;
  onOpenAbility: (ability: PetAbilitySlotRef) => void;
  onClose: () => void;
};

/** Thumbnails shown at most: a pet's creature rarely has more than a few looks. */
const DISPLAY_LIMIT = 12;

/** Wowhead keys battle pets by the same species id as Blizzard (it redirects to the pet's NPC page). */
const wowheadPetUrl = (petId: number): string => `${WOWHEAD_ORIGIN}/battle-pet/${petId}`;

const DisplayThumb = ({
  displayId,
  position,
  total,
  selected,
  name,
  onSelect,
}: {
  displayId: number;
  position: number;
  total: number;
  selected: boolean;
  name: string;
  onSelect: (displayId: number) => void;
}): JSX.Element => {
  const renderQuery = useQuery(creatureDisplayRenderQuery(displayId));
  return (
    <ButtonBase
      onClick={() => onSelect(displayId)}
      aria-pressed={selected}
      aria-label={`Display ${position} of ${total}`}
      sx={(theme) => ({
        width: 64,
        height: 64,
        borderRadius: `${theme.wc.radius.sm}px`,
        overflow: "hidden",
        // The pressed ring sits over the tile (an inset shadow on the button
        // would be painted over by the image), leaving the outline for focus.
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          boxShadow: selected ? `inset 0 0 0 2px ${theme.palette.primary.main}` : "none",
        },
        "&.Mui-focusVisible": focusRing(theme),
      })}
    >
      <MediaTile
        size="fill"
        aspect="1 / 1"
        src={renderQuery.data ?? null}
        alt=""
        fallbackLabel={name}
        loading={renderQuery.isPending}
        radius="sm"
      />
    </ButtonBase>
  );
};

/**
 * A pet in full: its model render (from the creature it summons) beside its
 * family, source and flags, Blizzard's description, every look its
 * creature has, the ability bar (each ability opens its own dialog) and
 * the family's pet battle matchups, labelled as game knowledge.
 */
const PetDialog = ({
  open,
  petId,
  fallbackName,
  familyNames,
  activeFamilyId,
  onShowFamily,
  onOpenAbility,
  onClose,
}: PetDialogProps): JSX.Element => {
  const enabled = petId !== null;
  const query = useQuery({ ...petQuery(petId ?? 0), enabled });
  const pet = enabled ? query.data : undefined;
  const notFound = enabled && query.data === null;
  const failure = useStickyError(`pet-${petId ?? ""}`, query);
  const icon = usePetIcon(pet);

  const creatureId = pet?.creature?.id;
  const displaysQuery = useQuery({
    ...creatureDisplaysQuery(creatureId ?? 0),
    enabled: creatureId !== undefined,
  });
  const displayIds = displaysQuery.data ?? [];
  // The picked look belongs to one pet: another pet starts on its first.
  const [picked, setPicked] = useState<{ petId: number; displayId: number } | null>(null);
  const activeDisplay =
    picked && picked.petId === petId && displayIds.includes(picked.displayId)
      ? picked.displayId
      : displayIds[0];
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(activeDisplay ?? 0),
    enabled: activeDisplay !== undefined,
  });
  const renderPending =
    (creatureId !== undefined && displaysQuery.isPending) ||
    (activeDisplay !== undefined && renderQuery.isPending);
  // A failed lookup would leave the letter tile, which reads as "no model":
  // say so under it, with a Retry that stays put while it runs.
  const displaysFailure = useStickyError(`displays-${creatureId ?? ""}`, displaysQuery);
  const renderFailure = useStickyError(`render-${activeDisplay ?? ""}`, renderQuery);
  const artFailure =
    displaysFailure.error !== null
      ? displaysFailure
      : renderFailure.error !== null
        ? renderFailure
        : null;

  const title = pet?.name ?? fallbackName ?? (petId !== null ? `Pet #${petId}` : "");
  const family = pet?.family;
  const subtitle = pet
    ? [family?.name, pet.source?.name].filter(Boolean).join(" · ")
    : undefined;

  const facts: Fact[] = [];
  if (pet) {
    if (family) {
      facts.push({
        label: "Family",
        value: <FamilyBadge familyId={family.id} name={family.name} size="medium" />,
      });
    }
    facts.push({ label: "Source", value: pet.source?.name ?? "Not listed" });
    facts.push({
      label: "Pet battles",
      value: pet.isBattlePet ? "Battle pet" : "Not a battle pet",
    });
    facts.push({
      label: "Capture",
      value: pet.isCapturable ? "Capturable in the wild" : "Not capturable",
    });
    facts.push({ label: "Trading", value: pet.isTradable ? "Tradable" : "Not tradable" });
    facts.push({
      label: "Faction",
      value: pet.faction ? (
        <Box component="span" sx={{ display: "inline-flex", gap: 0.5 }}>
          <FactionTag faction={pet.faction} />
          <span>only</span>
        </Box>
      ) : (
        "Both factions"
      ),
    });
    if (pet.hiddenUntilCollected) {
      facts.push({ label: "Pet journal", value: "Hidden until collected" });
    }
    if (pet.isRandomDisplay) {
      facts.push({ label: "Look", value: "Random display" });
    }
    facts.push({ label: "Pet ID", value: <Mono>{pet.id}</Mono> });
    if (pet.creature) {
      facts.push({ label: "Creature ID", value: <Mono>{pet.creature.id}</Mono> });
    }
  }

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Pet not found"
          description={`Blizzard has no pet #${petId ?? ""} in its pet journal data.`}
        />
      );
    }
    if (!pet) {
      return null;
    }
    const shownDisplays = displayIds.slice(0, DISPLAY_LIMIT);
    return (
      <Stack spacing={3}>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 5fr) minmax(0, 6fr)" },
            alignItems: "start",
          }}
        >
          <Stack
            spacing={1.5}
            sx={{ width: "100%", maxWidth: { xs: 320, sm: "none" }, justifySelf: "center" }}
          >
            {/* Square, like the render itself: nothing of the model is cropped. */}
            <Box sx={{ width: "100%", aspectRatio: "1 / 1" }}>
              <MediaTile
                size="fill"
                aspect="1 / 1"
                src={renderQuery.data ?? null}
                alt=""
                fallbackLabel={pet.name}
                loading={renderPending}
                radius="md"
              />
            </Box>
            {artFailure?.error ? (
              <ErrorState
                compact
                error={artFailure.error}
                context="the pet's model render"
                onRetry={artFailure.retry}
                retryLabel={artFailure.retrying ? "Retrying…" : "Retry"}
              />
            ) : null}
          </Stack>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            {pet.description ? (
              <Typography
                variant="body2"
                component="p"
                sx={(theme) => ({
                  m: 0,
                  pl: 1.5,
                  borderLeft: `2px solid ${theme.palette.border.gold}`,
                  color: "text.secondary",
                  fontStyle: "italic",
                })}
              >
                {pet.description}
              </Typography>
            ) : null}
            <FactList facts={facts} />
          </Stack>
        </Box>

        {shownDisplays.length > 1 ? (
          <DialogSection title={`Displays (${formatNumber(displayIds.length)})`}>
            <Box
              component="ul"
              role="list"
              aria-label={`${pet.name} displays`}
              sx={{ listStyle: "none", m: 0, p: 0.5, display: "flex", flexWrap: "wrap", gap: 1.5 }}
            >
              {shownDisplays.map((displayId, index) => (
                <Box component="li" key={displayId}>
                  <DisplayThumb
                    displayId={displayId}
                    position={index + 1}
                    total={displayIds.length}
                    selected={displayId === activeDisplay}
                    name={pet.name}
                    onSelect={(next) => setPicked({ petId: pet.id, displayId: next })}
                  />
                </Box>
              ))}
            </Box>
          </DialogSection>
        ) : null}

        <DialogSection
          title={
            pet.abilities.length > 0
              ? `Abilities (${formatNumber(pet.abilities.length)})`
              : "Abilities"
          }
          note={
            pet.abilities.length > 0
              ? "The level each one unlocks at, its family and timing. Pick one for its details."
              : undefined
          }
        >
          {pet.abilities.length > 0 ? (
            <AbilityBar abilities={pet.abilities} onOpenAbility={onOpenAbility} />
          ) : (
            <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
              {pet.isBattlePet
                ? "Blizzard lists no abilities for this pet."
                : "Blizzard does not flag this companion as a battle pet, and lists no abilities for it."}
            </Typography>
          )}
        </DialogSection>

        {family ? (
          <DialogSection title={`${family.name} matchups`} note={MATCHUP_NOTE}>
            <FamilyMatchup familyId={family.id} names={familyNames} variant="full" />
          </DialogSection>
        ) : null}
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={subtitle || undefined}
      media={
        enabled && !notFound
          ? { kind: "icon", src: icon.src, alt: "", loading: query.isPending || icon.pending }
          : undefined
      }
      maxWidth="md"
      loading={enabled && query.isPending && failure.error === null}
      error={enabled ? (failure.error ?? undefined) : undefined}
      onRetry={failure.retry}
      errorContext="pet details"
      actions={
        petId !== null ? (
          <DialogActionsRow
            primary={
              family && family.id !== activeFamilyId ? (
                <Button size="small" variant="outlined" onClick={() => onShowFamily(family.id)}>
                  {`Show ${family.name} pets`}
                </Button>
              ) : undefined
            }
            workbenchUrl={workbenchUrl("pet", petId)}
            wowheadUrl={wowheadPetUrl(petId)}
            title={title}
          />
        ) : null
      }
    >
      {renderBody()}
    </DetailDialog>
  );
};

export default PetDialog;
