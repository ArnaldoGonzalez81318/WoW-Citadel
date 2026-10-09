import { Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import DetailDialog from "@/components/common/DetailDialog";
import { EmptyState } from "@/components/common/StateBlocks";
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
import { abilityQuery } from "@/features/battlePets/hooks/battlePetQueries";
import { useAbilityIcon } from "@/features/battlePets/hooks/useIcons";
import useStickyError from "@/features/battlePets/hooks/useStickyError";
import { pluralize } from "@/features/battlePets/services/battlePetService";
import { WOWHEAD_ORIGIN } from "@/lib/externalLinks";

export type AbilityDialogProps = {
  /** Whether the dialog is showing; `abilityId` stays set through the close transition. */
  open: boolean;
  abilityId: number | null;
  /** Its name from the index or the pet that lists it, shown until the record loads. */
  fallbackName?: string;
  familyNames: ReadonlyMap<number, string>;
  /** The family the ability list is filtered to, so the dialog does not offer it again. */
  activeFamilyId: number | null;
  onShowFamily: (familyId: number) => void;
  onClose: () => void;
};

/** Wowhead keys pet abilities by Blizzard's ability id. */
const wowheadAbilityUrl = (abilityId: number): string =>
  `${WOWHEAD_ORIGIN}/pet-ability=${abilityId}`;

/**
 * One pet battle ability: its icon, family, Blizzard's rounds and cooldown,
 * and what its family's damage type hits hard and soft (game knowledge,
 * labelled as such). Opens over the pet dialog from its ability bar, or on
 * its own from the Abilities list.
 */
const AbilityDialog = ({
  open,
  abilityId,
  fallbackName,
  familyNames,
  activeFamilyId,
  onShowFamily,
  onClose,
}: AbilityDialogProps): JSX.Element => {
  const enabled = abilityId !== null;
  const query = useQuery({ ...abilityQuery(abilityId ?? 0), enabled });
  const ability = enabled ? query.data : undefined;
  const notFound = enabled && query.data === null;
  const failure = useStickyError(`ability-${abilityId ?? ""}`, query);
  const icon = useAbilityIcon(ability, enabled);
  const family = ability?.family;
  const title =
    ability?.name ?? fallbackName ?? (abilityId !== null ? `Ability #${abilityId}` : "");

  const rows: Fact[] = [];
  if (ability) {
    if (family) {
      rows.push({
        label: "Family",
        value: <FamilyBadge familyId={family.id} name={family.name} size="medium" />,
      });
    }
    rows.push({
      label: "Rounds",
      value: ability.rounds !== undefined ? pluralize(ability.rounds, "round", "rounds") : "Not listed",
    });
    rows.push({
      label: "Cooldown",
      value:
        ability.cooldown !== undefined ? pluralize(ability.cooldown, "round", "rounds") : "None",
    });
    rows.push({ label: "Ability ID", value: <Mono>{ability.id}</Mono> });
  }

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={family ? `${family.name} ability` : undefined}
      media={
        enabled && !notFound
          ? { kind: "icon", src: icon.src, alt: "", loading: query.isPending || icon.pending }
          : undefined
      }
      loading={enabled && query.isPending && failure.error === null}
      error={enabled ? (failure.error ?? undefined) : undefined}
      onRetry={failure.retry}
      errorContext="ability details"
      actions={
        abilityId !== null ? (
          <DialogActionsRow
            primary={
              family && family.id !== activeFamilyId ? (
                <Button size="small" variant="outlined" onClick={() => onShowFamily(family.id)}>
                  {`Show ${family.name} abilities`}
                </Button>
              ) : undefined
            }
            workbenchUrl={workbenchUrl("pet-ability", abilityId)}
            wowheadUrl={wowheadAbilityUrl(abilityId)}
            title={title}
          />
        ) : null
      }
    >
      {notFound ? (
        <EmptyState
          compact
          title="Ability not found"
          description={`Blizzard has no pet ability #${abilityId ?? ""} in its game data.`}
        />
      ) : ability ? (
        <Stack spacing={3}>
          <FactList facts={rows} />
          {family ? (
            <DialogSection title={`${family.name} damage`} note={MATCHUP_NOTE}>
              <FamilyMatchup familyId={family.id} names={familyNames} variant="attack" />
            </DialogSection>
          ) : null}
        </Stack>
      ) : null}
    </DetailDialog>
  );
};

export default AbilityDialog;
