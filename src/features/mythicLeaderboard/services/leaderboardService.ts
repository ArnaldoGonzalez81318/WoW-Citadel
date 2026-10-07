import { blizzardClient } from "@/lib/blizzardClient";
import {
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import type {
  KeystoneLeaderboard,
  KeystonePeriod,
  LeaderboardMember,
  LeaderboardRun,
  Specialization,
} from "@/features/mythicLeaderboard/types";

/*
 * Blizzard publishes keystone leaderboards per connected realm, dungeon and
 * weekly period only (no region-wide ranking): up to 500 completed runs,
 * ranked by key level then time and including runs finished over the timer, each
 * with its five players' name, realm slug, faction and specialization id.
 * Spec and affix icons are separate media lookups, cached for a long time
 * because they almost never change.
 */

type Reference = { id: number; name?: LocalizedString };

type RawMember = {
  profile?: { name?: string; realm?: { slug?: string } };
  faction?: { type?: string };
  specialization?: { id?: number };
};

type RawGroup = {
  ranking?: number;
  keystone_level?: number;
  duration?: number;
  completed_timestamp?: number;
  members?: RawMember[];
  mythic_rating?: {
    rating?: number;
    color?: { r?: number; g?: number; b?: number; a?: number };
  };
};

type LeaderboardResponse = {
  name?: LocalizedString;
  map?: Reference;
  period_start_timestamp?: number;
  period_end_timestamp?: number;
  keystone_affixes?: Array<{ keystone_affix?: Reference }>;
  leading_groups?: RawGroup[];
};

type PeriodResponse = {
  id: number;
  start_timestamp?: number;
  end_timestamp?: number;
};

type SpecializationResponse = {
  id: number;
  name?: LocalizedString;
  playable_class?: Reference;
  role?: { type?: string };
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

const toCssColor = (
  color: NonNullable<NonNullable<RawGroup["mythic_rating"]>["color"]> | undefined,
): string | undefined => {
  if (!color || typeof color.r !== "number" || typeof color.g !== "number" || typeof color.b !== "number") {
    return undefined;
  }
  const alpha = typeof color.a === "number" ? color.a : 1;
  // A 0 rating comes with rgba(255, 255, 255, 0): fall back to the theme's text colour.
  if (alpha <= 0) {
    return undefined;
  }
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
};

const toMember = (raw: RawMember): LeaderboardMember | undefined => {
  const name = raw.profile?.name?.trim();
  if (!name) {
    return undefined;
  }
  const faction = raw.faction?.type;
  return {
    name,
    realmSlug: raw.profile?.realm?.slug ?? "",
    specId: raw.specialization?.id,
    faction: faction === "ALLIANCE" || faction === "HORDE" ? faction : undefined,
  };
};

const toRun = (raw: RawGroup, index: number): LeaderboardRun | undefined => {
  if (typeof raw.keystone_level !== "number" || typeof raw.duration !== "number") {
    return undefined;
  }
  const rating = raw.mythic_rating?.rating;
  return {
    ranking: typeof raw.ranking === "number" ? raw.ranking : index + 1,
    keystoneLevel: raw.keystone_level,
    durationMs: raw.duration,
    completedTimestamp: raw.completed_timestamp,
    // A run over the timer can carry a 0 rating: shown as no rating.
    rating:
      typeof rating === "number" && rating > 0
        ? { value: rating, color: toCssColor(raw.mythic_rating?.color) }
        : undefined,
    members: (raw.members ?? [])
      .map(toMember)
      .filter((member): member is LeaderboardMember => member !== undefined),
  };
};

/**
 * One board. A realm with no runs for that dungeon and week answers
 * 404, which resolves to an empty board rather than an error.
 */
export const fetchKeystoneLeaderboard = async (
  connectedRealmId: number,
  dungeonId: number,
  periodId: number,
  signal?: AbortSignal,
): Promise<KeystoneLeaderboard> => {
  const response = await optional404(() =>
    blizzardClient.get<LeaderboardResponse>(
      `/data/wow/connected-realm/${connectedRealmId}/mythic-leaderboard/${dungeonId}/period/${periodId}`,
      { namespace: namespace("dynamic") },
      { signal },
    ),
  );

  return {
    connectedRealmId,
    dungeonId,
    periodId,
    name: localized(response?.map?.name) || localized(response?.name),
    periodStart: response?.period_start_timestamp,
    periodEnd: response?.period_end_timestamp,
    affixes: (response?.keystone_affixes ?? [])
      .map((entry) => entry.keystone_affix)
      .filter((affix): affix is Reference => typeof affix?.id === "number")
      .map((affix) => ({ id: affix.id, name: localized(affix.name) })),
    runs: (response?.leading_groups ?? [])
      .map(toRun)
      .filter((run): run is LeaderboardRun => run !== undefined)
      .sort((left, right) => left.ranking - right.ranking),
  };
};

/** One weekly period's dates. */
export const fetchKeystonePeriod = async (
  periodId: number,
  signal?: AbortSignal,
): Promise<KeystonePeriod> => {
  const response = await blizzardClient.get<PeriodResponse>(
    `/data/wow/mythic-keystone/period/${periodId}`,
    { namespace: namespace("dynamic") },
    { signal },
  );
  return {
    id: response.id,
    start: response.start_timestamp ?? 0,
    end: response.end_timestamp ?? 0,
  };
};

const iconOf = (media: MediaResponse | undefined): string | null =>
  media?.assets?.find((asset) => asset.key === "icon")?.value ??
  media?.assets?.[0]?.value ??
  null;

/** Name, class, role and icon of a specialization (two static lookups). */
export const fetchSpecialization = async (
  specId: number,
  signal?: AbortSignal,
): Promise<Specialization> => {
  const [detail, media] = await Promise.all([
    blizzardClient.get<SpecializationResponse>(
      `/data/wow/playable-specialization/${specId}`,
      { namespace: namespace("static") },
      { signal },
    ),
    optional404(() =>
      blizzardClient.get<MediaResponse>(
        `/data/wow/media/playable-specialization/${specId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  ]);
  const role = detail.role?.type;
  return {
    id: detail.id,
    name: localized(detail.name) || `Spec #${specId}`,
    className: localized(detail.playable_class?.name) || undefined,
    role: role === "TANK" || role === "HEALER" || role === "DAMAGE" ? role : undefined,
    iconUrl: iconOf(media),
  };
};

/** A keystone affix's icon, or null when Blizzard has none. */
export const fetchAffixIcon = async (
  affixId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/keystone-affix/${affixId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return iconOf(media);
};

/** "area-52" -> "Area 52", for realms the catalog does not name. */
export const titleFromSlug = (slug: string): string =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
