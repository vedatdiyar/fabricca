/**
 * Fuzzy bibliographic deduplication utility.
 *
 * Implements a two-metric approach recommended by the bibliographic record-linkage
 * literature:
 *   - Jaccard similarity on title token sets  → order-independent word overlap
 *   - Jaro-Winkler similarity on author surnames → prefix-weighted name matching
 *
 * Thresholds (empirically tuned for academic Turkish/English sources):
 *   - CERTAIN_DUPLICATE  : Jaccard ≥ 0.85 AND Jaro-Winkler ≥ 0.85
 *   - SUSPICIOUS_DUPLICATE: Jaccard ≥ 0.65 AND Jaro-Winkler ≥ 0.70
 */

/** Classification of a candidate against an existing source. */
export type DedupResult =
  | { kind: "unique" }
  | { kind: "certain_duplicate"; matchedTitle: string }
  | {
      kind: "suspicious";
      matchedTitle: string;
      titleScore: number;
      authorScore: number;
    };

/** Minimal shape required from an existing source for dedup comparison. */
export interface ExistingSourceSnippet {
  title: string;
  doi: string | null;
  authors: string[] | null;
}

/** Minimal shape required from a candidate reference. */
export interface CandidateSnippet {
  title: string;
  doi?: string | null;
  authors: string[];
}

// ---------------------------------------------------------------------------
// Turkish character pre-normalization (centralized)
// ---------------------------------------------------------------------------

import { normalizeTurkishChars } from "@/lib/academic/normalize";
export { normalizeTurkishChars };

/**
 * Strips everything except lowercase ASCII alphanumerics.
 * Used for bucket-key deduplication across candidate references.
 */
export function normKey(title: string): string {
  return normalizeTurkishChars(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------------------

/**
 * Tokenises a string to a lowercase alphanumeric word set.
 * Strips diacritics, punctuation, and single-char tokens.
 */
function tokenSet(s: string): Set<string> {
  return new Set(
    normalizeTurkishChars(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

/**
 * Jaccard similarity between two token sets.
 * J(A,B) = |A ∩ B| / |A ∪ B|
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Jaro similarity between two strings.
 */
function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Jaro-Winkler similarity with standard prefix scale p = 0.1.
 * Boosts score when strings share a common prefix (up to 4 chars).
 */
function jaroWinkler(s1: string, s2: string): number {
  const jaroScore = jaro(s1, s2);
  if (jaroScore < 0.7) return jaroScore;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaroScore + prefix * 0.1 * (1 - jaroScore);
}

/**
 * Extracts and normalises the primary author surname for comparison.
 * Handles formats: "A. Marcus", "Marcus, Aliza", "Marcus"
 */
function normaliseSurname(authorName: string): string {
  const trimmed = authorName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // "Last, First" format
  if (trimmed.includes(",")) return trimmed.split(",")[0].trim();
  // "First Last" or "Initial. Last" format — take last token
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const JACCARD_CERTAIN = 0.85;
const JACCARD_SUSPICIOUS = 0.65;
const JW_CERTAIN = 0.85;
const JW_SUSPICIOUS = 0.7;

/**
 * Classifies a single candidate against the full existing-source list.
 *
 * Order of checks (short-circuit on first hit):
 *   1. DOI exact match → certain_duplicate
 *   2. Alphanumeric-normalised title exact match → certain_duplicate
 *   3. Jaccard ≥ CERTAIN + Jaro-Winkler ≥ CERTAIN → certain_duplicate
 *   4. Jaccard ≥ SUSPICIOUS + Jaro-Winkler ≥ SUSPICIOUS → suspicious
 *   5. Otherwise → unique
 *
 * @param candidate  - Candidate reference to classify.
 * @param existing   - Array of all existing user sources.
 * @returns DedupResult indicating unique / certain duplicate / suspicious.
 */
export function classifyCandidate(
  candidate: CandidateSnippet,
  existing: ExistingSourceSnippet[],
): DedupResult {
  const candidateTokens = tokenSet(candidate.title);
  const candidateSurname = candidate.authors[0]
    ? normaliseSurname(candidate.authors[0])
    : "";
  const candidateDoi = candidate.doi?.toLowerCase().trim();
  const candidateNorm = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const ex of existing) {
    // 1. DOI exact match
    if (candidateDoi && ex.doi) {
      const exDoi = ex.doi.toLowerCase().trim();
      if (candidateDoi === exDoi) {
        return { kind: "certain_duplicate", matchedTitle: ex.title };
      }
    }

    // 2. Alphanumeric title exact match (catches punctuation / spacing variants)
    const exNorm = ex.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (candidateNorm === exNorm && candidateNorm.length > 0) {
      return { kind: "certain_duplicate", matchedTitle: ex.title };
    }

    // 3 & 4. Fuzzy title + author similarity
    const exTokens = tokenSet(ex.title);
    const titleScore = jaccard(candidateTokens, exTokens);

    if (titleScore < JACCARD_SUSPICIOUS) continue; // fast-skip

    const exSurname = ex.authors?.[0] ? normaliseSurname(ex.authors[0]) : "";

    const authorScore =
      candidateSurname && exSurname
        ? jaroWinkler(candidateSurname, exSurname)
        : 0.5; // neutral when author data is missing

    if (titleScore >= JACCARD_CERTAIN && authorScore >= JW_CERTAIN) {
      return { kind: "certain_duplicate", matchedTitle: ex.title };
    }

    if (titleScore >= JACCARD_SUSPICIOUS && authorScore >= JW_SUSPICIOUS) {
      return {
        kind: "suspicious",
        matchedTitle: ex.title,
        titleScore,
        authorScore,
      };
    }
  }

  return { kind: "unique" };
}

/**
 * Filters a candidate list against existing sources, returning:
 *   - `confirmed`  : candidates classified as unique
 *   - `suspicious` : candidates that may be duplicates — forward to LLM
 *   - `removed`    : candidates confirmed as duplicates (dropped)
 */
export function filterCandidates(
  candidates: CandidateSnippet[],
  existing: ExistingSourceSnippet[],
): {
  confirmed: CandidateSnippet[];
  suspicious: (CandidateSnippet & {
    matchedTitle: string;
    titleScore: number;
    authorScore: number;
  })[];
  removed: string[];
} {
  const confirmed: CandidateSnippet[] = [];
  const suspicious: (CandidateSnippet & {
    matchedTitle: string;
    titleScore: number;
    authorScore: number;
  })[] = [];
  const removed: string[] = [];

  for (const c of candidates) {
    const result = classifyCandidate(c, existing);
    if (result.kind === "unique") {
      confirmed.push(c);
    } else if (result.kind === "certain_duplicate") {
      removed.push(c.title);
    } else {
      suspicious.push({
        ...c,
        matchedTitle: result.matchedTitle,
        titleScore: result.titleScore,
        authorScore: result.authorScore,
      });
    }
  }

  return { confirmed, suspicious, removed };
}
