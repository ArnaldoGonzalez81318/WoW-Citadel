/**
 * Blizzard's search endpoints only match whole, correctly spelled words, so
 * suggestions for half-typed or misspelled text have to be ranked locally
 * against catalogues already in memory (mounts, toys, pets and the famous
 * items — around 6,500 names). That ranking runs on every keystroke, so the
 * tiers below are tested cheapest first and the expensive ones (word
 * assignment, edit distance) only run once the plain string tests have
 * failed. Nothing here allocates a regular expression per candidate.
 */

/**
 * One or two letters prefix-match far too much of any catalogue to be worth
 * offering, so `rankByName` stays quiet until the query reaches this length.
 */
export const MIN_FUZZY_QUERY_LENGTH = 2;

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Apostrophes and punctuation become separators rather than disappearing:
 * "Al'ar" has to split into "al" and "ar" so that typing either word finds
 * it. Letters and digits of any script survive, so non-English locales keep
 * working.
 */
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/** Lowercased, de-accented, punctuation-separated, single-spaced text. */
export const normalizeForSearch = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(NON_ALPHANUMERIC, " ")
    .trim();

/** Ranking tiers, lowest first. */
const TIER_CONTAINS = 100;
const TIER_TYPO = 200;
const TIER_ANY_ORDER = 300;
const TIER_SEQUENCE = 400;
const TIER_WORD_PREFIX = 500;
const TIER_NAME_PREFIX = 600;
const TIER_EXACT = 700;

/**
 * Tiers sit 100 apart and these two tie-breakers can never add more than 99
 * together, so a short name matched near its start outranks a long one inside
 * its own tier without ever jumping the tier above it.
 */
const MAX_LENGTH_BONUS = 60;
const MAX_POSITION_BONUS = 39;

const tieBreak = (name: string, position: number): number =>
  Math.max(0, MAX_LENGTH_BONUS - name.length) +
  Math.max(0, MAX_POSITION_BONUS - position);

/** A longer word has room for a second slip without becoming ambiguous. */
const TYPO_LONG_WORD_LENGTH = 7;

const typoAllowance = (word: string): number =>
  word.length >= TYPO_LONG_WORD_LENGTH ? 2 : 1;

/** Everything about a query that would otherwise be recomputed per candidate. */
type FuzzyQuery = {
  readonly text: string;
  readonly words: readonly string[];
  /** `text` behind a space, to spot a name word that starts with it. */
  readonly spaced: string;
  /** Edit-distance allowance per word of `words`. */
  readonly allowances: readonly number[];
};

const toFuzzyQuery = (query: string): FuzzyQuery => {
  const text = normalizeForSearch(query);
  const words = text.length === 0 ? [] : text.split(" ");

  return {
    text,
    words,
    spaced: ` ${text}`,
    allowances: words.map(typoAllowance),
  };
};

/**
 * Longest word a catalogue name can hold before edit distance gives up. The
 * scratch row below is sized to it so no buffer is allocated per comparison;
 * real names are nowhere near, and anything longer is reported as no match
 * instead of growing the buffer mid-keystroke.
 */
const MAX_EDIT_WORD_LENGTH = 64;
const editRow = new Int32Array(MAX_EDIT_WORD_LENGTH + 2);

/**
 * Levenshtein distance only matters here as a yes/no answer, so the row is
 * walked inside a band of `max` cells either side of the diagonal and the
 * comparison is abandoned as soon as every cell in that band exceeds the
 * allowance — a full matrix per candidate word would be far too slow.
 */
const withinEditDistance = (
  query: string,
  candidate: string,
  max: number,
): boolean => {
  if (max <= 0) {
    return query === candidate;
  }

  const lenQuery = query.length;
  const lenCandidate = candidate.length;

  if (Math.abs(lenQuery - lenCandidate) > max) {
    return false;
  }
  if (lenCandidate > MAX_EDIT_WORD_LENGTH) {
    return false;
  }
  if (lenQuery === 0) {
    return lenCandidate <= max;
  }

  // Any value past the allowance is as good as infinite; it only ever loses a
  // `Math.min`, which lets the cells outside the band share one sentinel.
  const unreachable = max + 1;
  for (let j = 0; j <= lenCandidate; j += 1) {
    editRow[j] = j;
  }

  for (let i = 1; i <= lenQuery; i += 1) {
    const from = i > max ? i - max : 1;
    const to = lenCandidate < i + max ? lenCandidate : i + max;
    const code = query.charCodeAt(i - 1);
    let diagonal = from === 1 ? i - 1 : editRow[from - 1];
    let best = unreachable;

    // The cell left of the band belongs to this row now: it is either the
    // "delete the whole prefix" column or out of reach.
    editRow[from - 1] = from === 1 ? i : unreachable;

    for (let j = from; j <= to; j += 1) {
      const above = editRow[j];
      let value = diagonal + (code === candidate.charCodeAt(j - 1) ? 0 : 1);
      const deletion = above + 1;
      if (deletion < value) {
        value = deletion;
      }
      const insertion = editRow[j - 1] + 1;
      if (insertion < value) {
        value = insertion;
      }

      diagonal = above;
      editRow[j] = value;
      if (value < best) {
        best = value;
      }
    }

    // The next row reaches one cell further right; it has no value of its own
    // yet, so stop it carrying this row's stale neighbour forward.
    if (to < lenCandidate) {
      editRow[to + 1] = unreachable;
    }

    // Row minima never fall, so once the band is over budget it stays over.
    if (best > max) {
      return false;
    }
  }

  return editRow[lenCandidate] <= max;
};

type WordMatcher = (
  queryWord: string,
  nameWord: string,
  allowance: number,
) => boolean;

const matchesPrefix: WordMatcher = (queryWord, nameWord) =>
  nameWord.startsWith(queryWord);

const matchesPrefixOrTypo: WordMatcher = (queryWord, nameWord, allowance) =>
  nameWord.startsWith(queryWord) ||
  withinEditDistance(queryWord, nameWord, allowance);

const matchesInside: WordMatcher = (queryWord, nameWord) =>
  nameWord.includes(queryWord);

/** Offset of `words[index]` in the normalized name (single spaces join them). */
const wordStart = (words: readonly string[], index: number): number => {
  let start = 0;
  for (let i = 0; i < index; i += 1) {
    start += words[i].length + 1;
  }
  return start;
};

const NO_MATCH = -1;

/**
 * Index of the first name word consumed when every query word prefix-matches
 * a distinct later word, in the order they were typed; `NO_MATCH` otherwise.
 * Taking the earliest candidate each time is enough — it never rules out a
 * match that a later one would have allowed.
 */
const matchInOrder = (
  words: readonly string[],
  queryWords: readonly string[],
): number => {
  let cursor = 0;
  let first = NO_MATCH;

  for (const queryWord of queryWords) {
    while (cursor < words.length && !words[cursor].startsWith(queryWord)) {
      cursor += 1;
    }
    if (cursor >= words.length) {
      return NO_MATCH;
    }
    if (first === NO_MATCH) {
      first = cursor;
    }
    cursor += 1;
  }

  return first;
};

/**
 * Words past this one are matched without claiming a slot: the used-word set
 * is a bitmask to keep the hot loop allocation-free, and no catalogue name
 * comes anywhere near that many words.
 */
const MAX_TRACKED_WORDS = 31;

/**
 * Index of the earliest name word consumed when every query word matches a
 * distinct name word in any order, else `NO_MATCH`. Distinctness is what stops
 * a repeated query word from matching one name word twice.
 */
const matchAnyOrder = (
  words: readonly string[],
  query: FuzzyQuery,
  matches: WordMatcher,
): number => {
  let used = 0;
  let earliest = NO_MATCH;

  for (let q = 0; q < query.words.length; q += 1) {
    const queryWord = query.words[q];
    const allowance = query.allowances[q];
    let found = NO_MATCH;

    for (let w = 0; w < words.length; w += 1) {
      const slot = w < MAX_TRACKED_WORDS ? 1 << w : 0;
      if ((used & slot) !== 0) {
        continue;
      }
      if (matches(queryWord, words[w], allowance)) {
        found = w;
        used |= slot;
        break;
      }
    }

    if (found === NO_MATCH) {
      return NO_MATCH;
    }
    if (earliest === NO_MATCH || found < earliest) {
      earliest = found;
    }
  }

  return earliest;
};

/**
 * The scorer proper, against a name that has already been normalized — the
 * caller normalizes 6,500 of them per keystroke and must not pay for it twice.
 */
const scoreNormalizedName = (name: string, query: FuzzyQuery): number => {
  if (name.length === 0 || query.text.length === 0) {
    return 0;
  }

  if (name === query.text) {
    return TIER_EXACT + tieBreak(name, 0);
  }
  if (name.startsWith(query.text)) {
    return TIER_NAME_PREFIX + tieBreak(name, 0);
  }

  // Everything typed so far, landing on a word boundary ("glaive of azz"
  // inside "Warglaive of Azzinoth" does not, "azzinoth" does).
  const spacedAt = name.indexOf(query.spaced);
  if (spacedAt >= 0) {
    return TIER_WORD_PREFIX + tieBreak(name, spacedAt + 1);
  }

  const words = name.split(" ");

  // For a single-word query both of these tiers say exactly what the two
  // prefix tests above already ruled out, so they are skipped.
  if (query.words.length > 1) {
    const ordered = matchInOrder(words, query.words);
    if (ordered !== NO_MATCH) {
      return TIER_SEQUENCE + tieBreak(name, wordStart(words, ordered));
    }

    const anyOrder = matchAnyOrder(words, query, matchesPrefix);
    if (anyOrder !== NO_MATCH) {
      return TIER_ANY_ORDER + tieBreak(name, wordStart(words, anyOrder));
    }
  }

  const typo = matchAnyOrder(words, query, matchesPrefixOrTypo);
  if (typo !== NO_MATCH) {
    return TIER_TYPO + tieBreak(name, wordStart(words, typo));
  }

  const inside = matchAnyOrder(words, query, matchesInside);
  if (inside !== NO_MATCH) {
    const at = name.indexOf(query.words[0]);
    return (
      TIER_CONTAINS +
      tieBreak(name, at >= 0 ? at : wordStart(words, inside))
    );
  }

  return 0;
};

/**
 * How well `name` answers what has been typed in `query`: 0 for no match,
 * larger for a better one. The tiers, best first, are an exact name, a name
 * starting with the query, a word starting with it, every typed word
 * prefix-matching a distinct word in order, the same in any order, a typed
 * word one or two slips away from a word ("shadowmorne" finding
 * "Shadowmourne"), and lastly a typed word buried inside one ("glaive"
 * finding "Warglaive").
 */
export const scoreName = (name: string, query: string): number =>
  scoreNormalizedName(normalizeForSearch(name), toFuzzyQuery(query));

type ScoredItem<T> = {
  readonly item: T;
  readonly score: number;
  readonly name: string;
};

const byScoreThenName = <T>(left: ScoredItem<T>, right: ScoredItem<T>): number => {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.name.length !== right.name.length) {
    return left.name.length - right.name.length;
  }
  // Normalized text rather than `localeCompare`, so the order a suggestion
  // list settles into never depends on the host's collation.
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
};

/**
 * The best `limit` of `items` for what has been typed, most relevant first;
 * empty while the query is too short to narrow anything down.
 */
export const rankByName = <T>(
  items: readonly T[],
  query: string,
  getName: (item: T) => string,
  limit: number,
): T[] => {
  const fuzzyQuery = toFuzzyQuery(query);
  if (fuzzyQuery.text.length < MIN_FUZZY_QUERY_LENGTH || limit <= 0) {
    return [];
  }

  const scored: ScoredItem<T>[] = [];
  for (const item of items) {
    const name = normalizeForSearch(getName(item));
    const score = scoreNormalizedName(name, fuzzyQuery);
    if (score > 0) {
      scored.push({ item, score, name });
    }
  }

  scored.sort(byScoreThenName);

  return scored.slice(0, limit).map((entry) => entry.item);
};
