import { openAlexQueue, fetchWithOpenAlexRetry } from "./openalex-http";
import { OPENALEX_BASE_URL } from "@/core/config/endpoints";

interface OpenAlexHealCandidate {
  id: string;
  title?: string;
  type?: string;
  cited_by_count?: number;
  authorships?: {
    author?: {
      display_name?: string;
    };
  }[];
  primary_location?: {
    source?: {
      display_name?: string;
      type?: string;
    };
  };
}

/**
 * Normalizes a proxy record title to the canonical work title.
 * Strips review prefixes, trailing periods, and collapses whitespace,
 * so the persisted title is always the real work's title.
 *
 * @param title - Raw title from any OpenAlex record type.
 * @returns Canonical title (empty string when input is blank).
 */
export function normalizeHealedTitle(title: string): string {
  const cleaned = (title ?? "")
    .replace(
      /^(?:Book\s+)?Review(?:\s+of|\s+on|\s*:\s*|\s+essay\s*:\s*)/i,
      "",
    )
    .replace(/\s*\.\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

/**
 * Resolves the author(s) of an academic work title by querying OpenAlex duplicates and selecting the most cited candidate.
 * No record is skipped by type: review/chapter records often carry the work's
 * citations, so they participate with a downweighted score instead of being dropped.
 *
 * @param title - The raw title of the academic work.
 * @returns The resolved author names.
 */
export async function healAuthorsByTitle(title: string): Promise<string[]> {
  const cleanSearchTitle = title
    .replace(/[:\-,\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200);
  // Quoted-phrase `search` (not the deprecated `title.search` filter): returns every
  // record carrying this exact title across all types — book, chapter, review, article —
  // so the true author set is found even when only proxy records exist.
  // Core title first: derived from the raw title BEFORE punctuation stripping,
  // the canonical record often carries only the short main title
  // (e.g. "Activists in Office") while proxies carry the full title with subtitle.
  // A pre-colon core is required because a quoted phrase demands every word —
  // the short-titled original could never match the full subtitle phrase.
  const rawCore = title.split(":")[0]?.trim() || title;
  const coreTitle = rawCore
    .replace(/[\-,\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80);
  const queryPhrases = coreTitle.length >= 3 ? [coreTitle] : [];
  if (
    cleanSearchTitle.length > coreTitle.length + 10 &&
    cleanSearchTitle.length <= 120
  ) {
    queryPhrases.push(cleanSearchTitle.slice(0, 120));
  }
  if (queryPhrases.length === 0) return [];
  const apiKey = process.env.OPENALEX_API_KEY;

  const rawResults: OpenAlexHealCandidate[] = [];
  try {
    for (const phrase of queryPhrases) {
      const params = new URLSearchParams({
        search: `"${phrase}"`,
        per_page: "25",
        select: "id,title,type,authorships,cited_by_count,primary_location",
      });
      if (apiKey) params.set("api_key", apiKey);
      const url = `${OPENALEX_BASE_URL}/works?${params.toString().replace(/\+/g, "%20")}`;
      const response = (await openAlexQueue.exec(() =>
        fetchWithOpenAlexRetry(url),
      )) as Response | null;
      if (!response) continue;
      const data = (await response.json()) as {
        results?: OpenAlexHealCandidate[];
      };
      rawResults.push(...(data.results ?? []));
      if (rawResults.length >= 25) break;
    }
  } catch {
    return [];
  }

    const STOP_WORDS = new Set([
      "a",
      "an",
      "the",
      "and",
      "or",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ]);
    const tokenize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

    const targetTokens = new Set(tokenize(cleanSearchTitle));

    const validCandidates: {
      authors: string[];
      citations: number;
      score: number;
    }[] = [];

    for (const work of rawResults) {
      const authorships = Array.isArray(work.authorships)
        ? (work.authorships as { author?: { display_name?: string } }[])
        : [];
      const allAuthors = authorships
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean);

      if (allAuthors.length === 0) continue;

      const sourceName = work.primary_location?.source?.display_name ?? "";
      const isReviewRecord =
        work.type === "book-review" ||
        sourceName.toLowerCase().includes("review") ||
        work.title?.toLowerCase().includes("review on") ||
        work.title?.toLowerCase().includes("review of");

      // Reviewer-first convention: on review records the reviewer is listed first
      // and the work's author last (e.g. [Dwight Fee, Norman Fairclough]).
      // Drop the leading reviewer so the resolved authors belong to the real work.
      const authors =
        isReviewRecord && allAuthors.length > 1
          ? allAuthors.slice(1)
          : allAuthors;

      const candTokens = tokenize(work.title ?? "");
      if (candTokens.length === 0) continue;

      const intersection = candTokens.filter((t) => targetTokens.has(t)).length;
      const union = new Set([...candTokens, ...targetTokens]).size;
      const jaccard = union > 0 ? intersection / union : 0;
      // Containment: the canonical record often has a shorter title (main title
      // without subtitle) fully contained in the query. Jaccard alone punishes
      // short true titles, so the better of the two similarities decides.
      const containment =
        candTokens.length > 0 ? intersection / candTokens.length : 0;
      const similarity = Math.max(jaccard, containment);

      if (intersection === 0) continue;

      // Similarity heavily weighted against raw citations to prevent unrelated long titles from hijacking resolution.
      // Review records participate with a halved score: their authorships are noisier,
      // but they must not be skipped since they often carry the work's citations.
      const citations = work.cited_by_count ?? 0;
      const typeWeight = isReviewRecord ? 0.5 : 1;
      const score =
        Math.pow(similarity, 2) * (Math.log10(citations + 2) + 1) * typeWeight;

      validCandidates.push({
        authors,
        citations,
        score,
      });
    }

    if (validCandidates.length === 0) return [];

    const authorScoresMap: Record<string, number> = {};
    const authorMap: Record<string, string[]> = {};

    for (const c of validCandidates) {
      const authorKey = c.authors.join(", ");
      authorScoresMap[authorKey] =
        (authorScoresMap[authorKey] ?? 0) + c.score;
      authorMap[authorKey] = c.authors;
    }

    let bestAuthorKey = "";
    let maxScore = -1;

    for (const [key, score] of Object.entries(authorScoresMap)) {
      if (score > maxScore) {
        maxScore = score;
        bestAuthorKey = key;
      }
    }

    return authorMap[bestAuthorKey] ?? [];
}
