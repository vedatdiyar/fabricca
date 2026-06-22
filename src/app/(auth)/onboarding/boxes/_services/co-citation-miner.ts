import type { FoundationalQuery } from "@/lib/types";
import { Logger } from "@/lib/logger";

const OPENALEX_DELAY_MS = 1200;
const OPENALEX_USER_AGENT =
  "FabriccaAcademicAssistant/1.0 (mailto:support@fabricca.com)";

interface OpenAlexAuthor {
  author?: {
    display_name?: string;
  };
}

interface OpenAlexWork {
  id: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  referenced_works?: string[];
  authorships?: OpenAlexAuthor[];
}

/**
 * Executes the co-citation mining algorithm to find seminal works for a set of search queries.
 *
 * 1. For each query, fetch top 20 relevant works from OpenAlex semantic search.
 * 2. Collect their referenced_works IDs and count citation frequencies.
 * 3. Fetch metadata for the top 15 most cited references.
 * 4. Dedup by title and return top 2-4 works as FoundationalQuery objects.
 *
 * @param queries Array of English semantic search query paragraphs.
 * @param log Logger instance for pipeline event tracing.
 * @returns Array of FoundationalQuery objects.
 */
export async function mineCoCitations(
  queries: string[],
  log: Logger,
): Promise<FoundationalQuery[]> {
  if (!queries || queries.length === 0) {
    return [];
  }

  log.info("co_citation_miner_start", {
    service: "boxes",
    data: { queryCount: queries.length, queries },
  });

  const referencesMap = new Map<
    string,
    { count: number; firstQueryIdx: number }
  >();
  const activeQueries = queries.filter((q) => q.trim().length > 0);

  for (let i = 0; i < activeQueries.length; i++) {
    const query = activeQueries[i];
    const params = new URLSearchParams({
      "search.semantic": query,
      per_page: "20",
      select: "id,title,referenced_works,cited_by_count",
    });
    const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

    try {
      log.info("openalex_semantic_search", {
        service: "boxes",
        data: { queryIndex: i, query: query.substring(0, 100) },
      });

      const response = await fetch(url, {
        headers: { "User-Agent": OPENALEX_USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = (await response.json()) as { results?: OpenAlexWork[] };
        const results = data.results || [];

        for (const item of results) {
          const refs = item.referenced_works || [];
          for (const ref of refs) {
            if (!ref) continue;
            const existing = referencesMap.get(ref);
            if (existing) {
              existing.count += 1;
            } else {
              referencesMap.set(ref, { count: 1, firstQueryIdx: i });
            }
          }
        }
      } else {
        log.warn("openalex_semantic_search_failed", {
          service: "boxes",
          data: { status: response.status, query: query.substring(0, 60) },
        });
      }
    } catch (err) {
      log.error("openalex_request_failed", {
        service: "boxes",
        error: err instanceof Error ? err : new Error(String(err)),
        data: { query: query.substring(0, 60) },
      });
    }

    // Abide by OpenAlex rate limits (max 1-2 requests/sec)
    if (i < activeQueries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, OPENALEX_DELAY_MS));
    }
  }

  if (referencesMap.size === 0) {
    log.warn("co_citation_miner_no_references", {
      service: "boxes",
      data: { context: "No references extracted from search results." },
    });
    return [];
  }

  // Sort candidates by citation frequency descending
  const candidates = Array.from(referencesMap.entries())
    .map(([id, stats]) => ({ id, count: stats.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const candidateIds = candidates.map((c) =>
    c.id.replace("https://openalex.org/", ""),
  );
  if (candidateIds.length === 0) {
    return [];
  }

  // Fetch metadata details for top candidate references
  const filterParams = new URLSearchParams({
    filter: `openalex_id:${candidateIds.join("|")}`,
    select: "id,title,authorships,publication_year,cited_by_count",
  });
  const detailsUrl = `https://api.openalex.org/works?${filterParams.toString().replace(/\+/g, "%20")}`;

  const resolvedQueries: FoundationalQuery[] = [];
  try {
    log.info("openalex_resolve_details", {
      service: "boxes",
      data: { candidateCount: candidateIds.length },
    });

    const response = await fetch(detailsUrl, {
      headers: { "User-Agent": OPENALEX_USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const data = (await response.json()) as { results?: OpenAlexWork[] };
      const results = data.results || [];
      const seenTitles = new Set<string>();

      for (const item of results) {
        const title = (item.title || "").trim();
        const year = item.publication_year || 0;
        const authorsList =
          item.authorships
            ?.map((a) => a.author?.display_name || "")
            .filter(Boolean) || [];

        if (!title || seenTitles.has(title.toLowerCase())) {
          continue;
        }
        seenTitles.add(title.toLowerCase());

        // Format author name string
        let authorStr = "Bilinmeyen Yazar";
        if (authorsList.length > 0) {
          if (authorsList.length > 2) {
            authorStr = `${authorsList[0]} et al.`;
          } else {
            authorStr = authorsList.join(" & ");
          }
        }

        resolvedQueries.push({
          author: authorStr,
          title,
          publicationYear: year,
        });
      }
    }
  } catch (err) {
    log.error("openalex_resolve_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
  }

  // Deduplicate and filter down to top 2-4 works
  const finalWorks = resolvedQueries.slice(0, 4);

  log.info("co_citation_miner_complete", {
    service: "boxes",
    data: { foundCount: finalWorks.length },
  });

  return finalWorks;
}
