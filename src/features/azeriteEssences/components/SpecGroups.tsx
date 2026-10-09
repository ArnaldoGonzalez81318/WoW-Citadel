import { Avatar, Box, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { RoleIcon, roleColor } from "@/features/azeriteEssences/components/RoleTags";
import { specIconQuery } from "@/features/azeriteEssences/hooks/essenceQueries";
import { ROLE_ORDER } from "@/features/azeriteEssences/services/azeriteEssenceService";
import type {
  NamedRef,
  RoleType,
  Specialization,
} from "@/features/azeriteEssences/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, visuallyHidden } from "@/theme";

type SpecEntry = { ref: NamedRef; spec: Specialization | undefined };

type ClassGroup = {
  key: string;
  /** Null for specializations whose records did not load. */
  playableClass: NamedRef | null;
  entries: SpecEntry[];
};

const roleRank = (entry: SpecEntry): number =>
  entry.spec?.role ? ROLE_ORDER.indexOf(entry.spec.role) : ROLE_ORDER.length;

/** By class name, then each class's specs Tank, Healer, Damage and by name. */
const groupByClass = (
  refs: readonly NamedRef[],
  catalog: ReadonlyMap<number, Specialization>,
): ClassGroup[] => {
  const groups = new Map<string, ClassGroup>();
  refs.forEach((ref) => {
    const spec = catalog.get(ref.id);
    const playableClass = spec?.playableClass ?? null;
    const key = playableClass ? String(playableClass.id) : "other";
    const group = groups.get(key) ?? { key, playableClass, entries: [] };
    group.entries.push({ ref, spec });
    groups.set(key, group);
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort(
        (left, right) =>
          roleRank(left) - roleRank(right) ||
          (left.spec?.name ?? left.ref.name).localeCompare(right.spec?.name ?? right.ref.name),
      ),
    }))
    .sort((left, right) => {
      if (!left.playableClass || !right.playableClass) {
        return left.playableClass ? -1 : right.playableClass ? 1 : 0;
      }
      return left.playableClass.name.localeCompare(right.playableClass.name);
    });
};

/** A spec's 56px icon at 28px, its initial while it loads or when there is none. */
const SpecAvatar = ({
  specId,
  name,
  load,
}: {
  specId: number;
  name: string;
  load: boolean;
}): JSX.Element => {
  const query = useQuery({ ...specIconQuery(specId), enabled: load });
  // A query not yet enabled is pending too: the block is off screen then.
  if (query.isPending) {
    return <Skeleton variant="rounded" width={28} height={28} sx={{ flexShrink: 0 }} />;
  }
  return (
    <Avatar
      variant="rounded"
      src={query.data ?? undefined}
      alt=""
      sx={(theme) => ({
        width: 28,
        height: 28,
        flexShrink: 0,
        fontSize: "0.8125rem",
        fontWeight: 700,
        color: theme.palette.text.secondary,
        backgroundColor: theme.palette.surface.sunken,
        border: `1px solid ${theme.palette.border.subtle}`,
      })}
    >
      <span aria-hidden="true">{name.charAt(0).toLocaleUpperCase()}</span>
    </Avatar>
  );
};

/** One class and its allowed specs; their icons load once it scrolls near. */
const ClassBlock = ({
  group,
  roleNames,
}: {
  group: ClassGroup;
  roleNames: Record<RoleType, string>;
}): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLLIElement>("120px 0px");
  const title = group.playableClass?.name || "Other specializations";
  return (
    <Box
      component="li"
      ref={nearRef}
      sx={(theme) => ({
        minWidth: 0,
        padding: 1.5,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.subtle}`,
        backgroundColor: theme.palette.surface.inset,
      })}
    >
      <Typography component="h4" variant="subtitle2" sx={{ margin: 0, marginBottom: 1 }}>
        {title}
      </Typography>
      <Box
        component="ul"
        role="list"
        aria-label={`${title} specializations`}
        sx={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0.75 }}
      >
        {group.entries.map(({ ref, spec }) => {
          const name = spec?.name ?? ref.name;
          const role = spec?.role ?? null;
          return (
            <Stack
              component="li"
              key={ref.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <SpecAvatar specId={ref.id} name={name} load={near} />
              <Typography component="span" variant="body2" sx={{ ...mixins.truncate, minWidth: 0 }}>
                {name}
                {role ? (
                  <Box component="span" sx={visuallyHidden}>
                    {`, ${roleNames[role]}`}
                  </Box>
                ) : null}
              </Typography>
              {role ? (
                <RoleIcon
                  role={role}
                  sx={(theme) => ({ fontSize: 16, flexShrink: 0, color: roleColor(theme, role) })}
                />
              ) : null}
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
};

export type SpecGroupsProps = {
  /** The essence's allowed specializations. */
  specs: readonly NamedRef[];
  catalog: ReadonlyMap<number, Specialization>;
  roleNames: Record<RoleType, string>;
};

/**
 * Who could slot the essence: its specializations grouped by class, each
 * with its icon and role. Blizzard names the specs without their class, so
 * the grouping reads the spec records the page already loaded.
 */
const SpecGroups = ({ specs, catalog, roleNames }: SpecGroupsProps): JSX.Element => {
  if (specs.length === 0) {
    return (
      <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
        Blizzard lists no specializations for this essence.
      </Typography>
    );
  }
  const groups = groupByClass(specs, catalog);
  return (
    <Box
      component="ul"
      role="list"
      aria-label="Specializations by class"
      sx={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
        },
      }}
    >
      {groups.map((group) => (
        <ClassBlock key={group.key} group={group} roleNames={roleNames} />
      ))}
    </Box>
  );
};

export default SpecGroups;
