import { CROSSREF_USER_AGENT } from "@/lib/api-utils";
import type { Logger } from "@/lib/logger";

export interface EnrichedBibliographicMetadata {
  publisher?: string;
  containerTitle?: string;
  publicationYear?: number;
  doi?: string;
  documentType?: string;
}

export interface CrossrefEnrichmentParams {
  title: string;
  authors?: string[];
  doi?: string;
  logger?: Logger;
}

/**
 * Calculates word-level Dice similarity between two titles (0.0 to 1.0).
 *
 * @param a - First title string.
 * @param b - Second title string.
 * @returns Similarity score between 0 and 1.
 */
export function calculateTitleSimilarity(a: string, b: string): number {
  const normA = a
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normB = b
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(" ").filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  return (2 * intersection) / (wordsA.size + wordsB.size);
}

interface CrossrefPerson {
  given?: string;
  family?: string;
}

interface CrossrefWorkItem {
  title?: string[];
  publisher?: string;
  "container-title"?: string[];
  issued?: {
    "date-parts"?: number[][];
  };
  DOI?: string;
  type?: string;
  author?: CrossrefPerson[];
}

function parseCrossrefItem(
  item: CrossrefWorkItem,
  fallbackDoi?: string,
): EnrichedBibliographicMetadata {
  return {
    publisher: item.publisher?.trim() || undefined,
    containerTitle: item["container-title"]?.[0]?.trim() || undefined,
    publicationYear: item.issued?.["date-parts"]?.[0]?.[0] || undefined,
    doi: item.DOI || fallbackDoi,
    documentType: item.type || undefined,
  };
}

/**
 * Enriches bibliographic metadata via Crossref API using DOI lookup or title/author fuzzy search.
 *
 * @param params - Search parameters (title, authors, optional DOI, logger).
 * @returns Enriched bibliographic fields if a high-confidence match is found, null otherwise.
 */
export async function enrichWithCrossref(
  params: CrossrefEnrichmentParams,
): Promise<EnrichedBibliographicMetadata | null> {
  const { title, authors = [], doi, logger } = params;

  if (!title && !doi) return null;

  const timeoutSignal = AbortSignal.timeout(4000);

  // Case 1: Direct DOI lookup
  if (doi && doi.trim().length > 0) {
    try {
      const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//i, "");
      const res = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`,
        {
          headers: { "User-Agent": CROSSREF_USER_AGENT },
          signal: timeoutSignal,
        },
      );

      if (res.ok) {
        const json = (await res.json()) as { message?: CrossrefWorkItem };
        const item = json.message;
        if (item) {
          const enriched = parseCrossrefItem(item, cleanDoi);
          logger?.info("crossref_doi_lookup_success", {
            service: "crossref",
            data: { doi: cleanDoi, publisher: enriched.publisher },
          });
          return enriched;
        }
      }
    } catch (err) {
      logger?.info("crossref_doi_lookup_failed", {
        service: "crossref",
        data: { doi, error: String(err) },
      });
    }
  }

  // Case 2: Bibliographic search by title and author
  try {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 5) return null;

    let authorQuery = "";
    if (authors.length > 0 && authors[0].trim().length > 0) {
      const firstAuthor = authors[0].trim();
      const nameParts = firstAuthor.split(/\s+/).filter(Boolean);
      const lastName = nameParts[nameParts.length - 1] || firstAuthor;
      authorQuery = `&query.author=${encodeURIComponent(lastName)}`;
    }

    const queryUrl = `https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}${authorQuery}&rows=3`;
    const res = await fetch(queryUrl, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: timeoutSignal,
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      message?: { items?: CrossrefWorkItem[] };
    };
    const items = json.message?.items || [];

    for (const item of items) {
      const itemTitle = item.title?.[0] || "";
      if (!itemTitle) continue;

      const similarity = calculateTitleSimilarity(cleanTitle, itemTitle);
      if (similarity >= 0.75) {
        const enriched = parseCrossrefItem(item);

        logger?.info("crossref_bibliographic_search_matched", {
          service: "crossref",
          data: {
            queriedTitle: cleanTitle,
            matchedTitle: itemTitle,
            similarity,
            publisher: enriched.publisher,
            containerTitle: enriched.containerTitle,
            publicationYear: enriched.publicationYear,
          },
        });

        return enriched;
      }
    }
  } catch (err) {
    logger?.info("crossref_bibliographic_search_failed", {
      service: "crossref",
      data: { title, error: String(err) },
    });
  }

  return null;
}
