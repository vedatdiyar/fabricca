import type { FoundationalQuery } from "@/lib/types";
import { Logger } from "@/lib/logger";

const OPENALEX_DELAY_MS = 1100;
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
 * Fetch wrapper that retries on 429 rate limit or network/server errors with exponential backoff + jitter.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  log: Logger,
  maxRetries = 3,
  baseDelayMs = 1500,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }

      const isRetryable = response.status === 429 || response.status >= 500;
      if (!isRetryable || attempt > maxRetries) {
        return response;
      }

      const backoff = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = backoff * 0.3 * Math.random();
      const delayMs = backoff + jitter;

      log.warn("openalex_request_retry", {
        service: "boxes",
        data: {
          attempt,
          status: response.status,
          delayMs: Math.round(delayMs),
          url: url.substring(0, 120),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (err) {
      if (attempt > maxRetries) {
        throw err;
      }
      const backoff = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = backoff * 0.3 * Math.random();
      const delayMs = backoff + jitter;

      log.warn("openalex_request_network_retry", {
        service: "boxes",
        data: {
          attempt,
          delayMs: Math.round(delayMs),
          error: err instanceof Error ? err.message : String(err),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Executes the co-citation mining algorithm to find seminal works for a set of search queries.
 *
 * 1. For each query, fetch top 20 relevant works from OpenAlex semantic search.
 * 2. Collect their referenced_works IDs and count citation frequencies per query.
 * 3. Pick candidate references across all queries using round-robin.
 * 4. Fetch metadata for the selected candidates.
 * 5. Distribute the final resolved works equally across queries using round-robin selection.
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

  const queryCandidates = new Map<number, Map<string, number>>();
  const activeQueries = queries.filter((q) => q.trim().length > 0);

  for (let i = 0; i < activeQueries.length; i++) {
    const query = activeQueries[i];
    const candidatesMap = new Map<string, number>();
    queryCandidates.set(i, candidatesMap);

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

      const response = await fetchWithRetry(
        url,
        {
          headers: { "User-Agent": OPENALEX_USER_AGENT },
          signal: AbortSignal.timeout(15000),
        },
        log,
      );

      if (response.ok) {
        const data = (await response.json()) as { results?: OpenAlexWork[] };
        const results = data.results || [];

        for (const item of results) {
          const refs = item.referenced_works || [];
          for (const ref of refs) {
            if (!ref) continue;
            candidatesMap.set(ref, (candidatesMap.get(ref) || 0) + 1);
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
    await new Promise((resolve) => setTimeout(resolve, OPENALEX_DELAY_MS));
  }

  // Count total distinct candidates across all queries
  let totalCandidatesCount = 0;
  for (const [, map] of queryCandidates) {
    totalCandidatesCount += map.size;
  }

  if (totalCandidatesCount === 0) {
    log.warn("co_citation_miner_no_references", {
      service: "boxes",
      data: { context: "No references extracted from search results." },
    });
    return [];
  }

  // Sort candidates for each query descending by citation count
  const sortedCandidatesByQuery = new Map<
    number,
    { id: string; count: number }[]
  >();
  for (let i = 0; i < activeQueries.length; i++) {
    const map = queryCandidates.get(i) || new Map();
    const sorted = Array.from(map.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
    sortedCandidatesByQuery.set(i, sorted);
  }

  // Select up to 15 unique candidate IDs using round-robin across queries
  const selectedIds = new Set<string>();
  const indices = new Array(activeQueries.length).fill(0);
  let added = true;
  while (selectedIds.size < 15 && added) {
    added = false;
    for (let i = 0; i < activeQueries.length; i++) {
      const list = sortedCandidatesByQuery.get(i) || [];
      const idx = indices[i];
      if (idx < list.length) {
        const candidate = list[idx];
        selectedIds.add(candidate.id);
        indices[i]++;
        added = true;
        if (selectedIds.size >= 15) break;
      }
    }
  }

  const candidateIds = Array.from(selectedIds).map((id) =>
    id.replace("https://openalex.org/", ""),
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

  interface ResolvedWorkExtended extends FoundationalQuery {
    id: string;
  }

  const resolvedQueries: ResolvedWorkExtended[] = [];
  try {
    log.info("openalex_resolve_details", {
      service: "boxes",
      data: { candidateCount: candidateIds.length },
    });

    const response = await fetchWithRetry(
      detailsUrl,
      {
        headers: { "User-Agent": OPENALEX_USER_AGENT },
        signal: AbortSignal.timeout(15000),
      },
      log,
    );

    if (response.ok) {
      const data = (await response.json()) as { results?: OpenAlexWork[] };
      const results = data.results || [];
      const seenTitles = new Set<string>();

      for (const item of results) {
        const title = (item.title || "").trim();
        const year = item.publication_year || 0;
        let authorsList =
          item.authorships
            ?.map((a) => a.author?.display_name || "")
            .filter(Boolean) || [];

        if (!title || seenTitles.has(title.toLowerCase())) {
          continue;
        }
        seenTitles.add(title.toLowerCase());

        // Fallback for works with empty authors (e.g. books/chapters cataloged under journal book-reviews)
        if (authorsList.length === 0 && title) {
          try {
            // Split by colon to search the main title (e.g. "Activists in office") which helps locate the main book record
            const mainTitle = title.split(":")[0].trim();
            if (mainTitle.length > 5) {
              const fallbackParams = new URLSearchParams({
                filter: `title.search:${mainTitle}`,
                per_page: "10",
                select: "id,title,authorships,publication_year,cited_by_count",
              });
              const fallbackUrl = `https://api.openalex.org/works?${fallbackParams.toString().replace(/\+/g, "%20")}`;
              const fallbackResponse = await fetchWithRetry(
                fallbackUrl,
                {
                  headers: { "User-Agent": OPENALEX_USER_AGENT },
                  signal: AbortSignal.timeout(8000),
                },
                log,
              );
              if (fallbackResponse.ok) {
                const fallbackData = (await fallbackResponse.json()) as {
                  results?: OpenAlexWork[];
                };
                const fallbackResults = fallbackData.results || [];

                // Citation-Weighted Consensus: group matches by author and accumulate cited_by_count
                const authorScores = new Map<
                  string,
                  { count: number; rawList: string[] }
                >();
                const REVIEW_PATTERNS = [
                  /review/i,
                  /reviewed/i,
                  /recension/i,
                  /discussion of/i,
                  /\bpp\b/i,
                ];

                for (const match of fallbackResults) {
                  const matchAuthors =
                    match.authorships
                      ?.map((a) => a.author?.display_name || "")
                      .filter(Boolean) || [];
                  if (matchAuthors.length === 0) continue;

                  const matchTitle = (match.title || "").trim();
                  // Skip review items that contain review keywords in their titles
                  const isReview = REVIEW_PATTERNS.some((pattern) =>
                    pattern.test(matchTitle),
                  );
                  if (isReview) continue;

                  const cleanMainTitle = mainTitle.toLowerCase().trim();
                  const cleanMatchTitle = matchTitle.toLowerCase().trim();
                  const cleanTitle = title.toLowerCase().trim();

                  // Check if titles match or contain each other
                  const isTitleMatch =
                    cleanMatchTitle.includes(cleanMainTitle) ||
                    cleanMainTitle.includes(cleanMatchTitle) ||
                    cleanMatchTitle.includes(cleanTitle) ||
                    cleanTitle.includes(cleanMatchTitle);

                  if (isTitleMatch) {
                    // Create a unique key for the author combination
                    let authorKey = "";
                    if (matchAuthors.length > 2) {
                      authorKey = `${matchAuthors[0]} et al.`;
                    } else {
                      authorKey = matchAuthors.join(" & ");
                    }

                    const score = (match.cited_by_count || 0) + 1; // Base score of 1 to count occurrences
                    const existing = authorScores.get(
                      authorKey.toLowerCase(),
                    ) || { count: 0, rawList: matchAuthors };
                    authorScores.set(authorKey.toLowerCase(), {
                      count: existing.count + score,
                      rawList: matchAuthors,
                    });
                  }
                }

                // Determine the winner (author with highest cumulative citation-weighted score)
                let highestScore = -1;
                let consensusAuthors: string[] = [];
                for (const [, val] of authorScores.entries()) {
                  if (val.count > highestScore) {
                    highestScore = val.count;
                    consensusAuthors = val.rawList;
                  }
                }

                if (consensusAuthors.length > 0) {
                  authorsList = consensusAuthors;
                  log.info("openalex_author_fallback_resolved", {
                    service: "boxes",
                    data: {
                      originalTitle: title,
                      resolvedAuthors: consensusAuthors,
                      score: highestScore,
                    },
                  });
                }
              }
            }
            // Respect rate limits after making an extra request
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (err) {
            log.warn("openalex_author_fallback_failed", {
              service: "boxes",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

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
          id: item.id,
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

  // Enforce a strict delay after resolving details to respect the rate limit before the next box is processed
  await new Promise((resolve) => setTimeout(resolve, OPENALEX_DELAY_MS));

  // Distribute the resolved works equally among queries using round-robin selection
  const resolvedForQueryMap = new Map<number, ResolvedWorkExtended[]>();
  for (let i = 0; i < activeQueries.length; i++) {
    const queryMap = queryCandidates.get(i) || new Map<string, number>();
    const resolvedForQuery = resolvedQueries
      .filter((w) => queryMap.has(w.id))
      .sort((a, b) => {
        const countA = queryMap.get(a.id) || 0;
        const countB = queryMap.get(b.id) || 0;
        return countB - countA;
      });
    resolvedForQueryMap.set(i, resolvedForQuery);
  }

  const finalWorks: FoundationalQuery[] = [];
  const chosenIds = new Set<string>();
  const resolvedIndices = new Array(activeQueries.length).fill(0);
  let chosenAny = true;

  while (finalWorks.length < 4 && chosenAny) {
    chosenAny = false;
    for (let i = 0; i < activeQueries.length; i++) {
      const list = resolvedForQueryMap.get(i) || [];
      let idx = resolvedIndices[i];
      while (idx < list.length) {
        const work = list[idx];
        resolvedIndices[i]++;
        if (!chosenIds.has(work.id)) {
          chosenIds.add(work.id);
          finalWorks.push({
            author: work.author,
            title: work.title,
            publicationYear: work.publicationYear,
          });
          chosenAny = true;
          break; // move to the next query in the round-robin
        }
        idx = resolvedIndices[i];
      }
      if (finalWorks.length >= 4) break;
    }
  }

  log.info("co_citation_miner_complete", {
    service: "boxes",
    data: { foundCount: finalWorks.length },
  });

  return finalWorks;
}
