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
 * Resolves the author(s) of an academic work title by querying OpenAlex duplicates and selecting the most cited candidate.
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
  const params = new URLSearchParams({
    filter: `title.search:${cleanSearchTitle}`,
    per_page: "15",
    select: "id,title,type,authorships,cited_by_count,primary_location",
  });
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  const url = `${OPENALEX_BASE_URL}/works?${params.toString().replace(/\+/g, "%20")}`;

  try {
    const response = (await openAlexQueue.exec(() =>
      fetchWithOpenAlexRetry(url),
    )) as Response | null;

    if (!response) return [];
    const data = (await response.json()) as {
      results?: OpenAlexHealCandidate[];
    };
    const rawResults = data.results ?? [];

    const validCandidates: { authors: string[]; citations: number }[] = [];

    for (const work of rawResults) {
      const authorships = Array.isArray(work.authorships)
        ? (work.authorships as { author?: { display_name?: string } }[])
        : [];
      const authors = authorships
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean);

      if (authors.length === 0) continue;

      const sourceName = work.primary_location?.source?.display_name ?? "";
      const isBookReview =
        work.type === "book-review" ||
        sourceName.toLowerCase().includes("review") ||
        work.title?.toLowerCase().includes("review on") ||
        work.title?.toLowerCase().includes("review of");

      if (isBookReview) continue;

      validCandidates.push({
        authors,
        citations: work.cited_by_count ?? 0,
      });
    }

    if (validCandidates.length === 0) return [];

    const authorCitationsMap: Record<string, number> = {};
    const authorMap: Record<string, string[]> = {};

    for (const c of validCandidates) {
      const authorKey = c.authors.join(", ");
      authorCitationsMap[authorKey] =
        (authorCitationsMap[authorKey] ?? 0) + c.citations;
      authorMap[authorKey] = c.authors;
    }

    let bestAuthorKey = "";
    let maxCitations = -1;

    for (const [key, citations] of Object.entries(authorCitationsMap)) {
      if (citations > maxCitations) {
        maxCitations = citations;
        bestAuthorKey = key;
      }
    }

    return authorMap[bestAuthorKey] ?? [];
  } catch {
    return [];
  }
}
