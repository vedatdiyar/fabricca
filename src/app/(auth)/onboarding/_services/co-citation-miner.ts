import type { FoundationalQuery } from "@/lib/types";
import { Logger } from "@/lib/logger";
import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import {
  CO_CITATION_REFEREE_SCHEMA,
  buildRefereeSystemInstruction,
  buildRefereePrompt,
} from "@/lib/prompts";
import type { RefereeBoxContext as BoxContext } from "@/lib/prompts/co-citation-referee";
export type { BoxContext };

const OPENALEX_DELAY_MS = 1100;
const OPENALEX_USER_AGENT =
  "FabriccaAcademicAssistant/1.0 (mailto:support@fabricca.com)";
const PER_PAGE = 10;
const TOP_K = 10;
const DETAIL_CHUNK_SIZE = 40;
const BOX_REFEREE_SEED = 42;

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
 * Checks whether a work's metadata is missing or suspicious enough to warrant
 * the author consensus fallback.
 */
function isSuspiciousMetadata(authors: string[], title: string): boolean {
  if (authors.length === 0) return true;
  if (authors.some((a) => a.length < 3)) return true;
  if (title.length < 10) return true;
  return false;
}

/**
 * Returns the local co-citation count as the raw score.
 * The score equals the number of papers in the search pool that reference
 * the candidate work — a pure consensus frequency without global citation bias.
 */
function computeScore(localCount: number): number {
  return localCount;
}

/**
 * Runs the author-consensus fallback to recover author metadata for works
 * (e.g. books monographs) whose OpenAlex record has empty or broken authors.
 *
 * Searches by the main title (before colon), skips review-type entries, and
 * uses citation-weighted scoring to determine the most likely author set.
 *
 * @returns The resolved authors list if successful, or null if resolution failed.
 */
async function resolveAuthorsViaFallback(
  title: string,
  apiKey: string | undefined,
  log: Logger,
): Promise<string[] | null> {
  const mainTitle = title.split(":")[0].trim();
  if (mainTitle.length <= 5) return null;

  try {
    const fallbackParams = new URLSearchParams({
      filter: `title.search:${mainTitle}`,
      per_page: "10",
      select: "id,title,authorships,publication_year,cited_by_count",
    });
    if (apiKey) fallbackParams.set("api_key", apiKey);
    const fallbackUrl = `https://api.openalex.org/works?${fallbackParams.toString().replace(/\+/g, "%20")}`;

    const fallbackResponse = await fetchWithRetry(
      fallbackUrl,
      {
        headers: { "User-Agent": OPENALEX_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      },
      log,
    );

    if (!fallbackResponse.ok) return null;
    const fallbackData = (await fallbackResponse.json()) as {
      results?: OpenAlexWork[];
    };
    const fallbackResults = fallbackData.results || [];

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
      if (REVIEW_PATTERNS.some((pattern) => pattern.test(matchTitle))) continue;

      const cleanMainTitle = mainTitle.toLowerCase().trim();
      const cleanMatchTitle = matchTitle.toLowerCase().trim();
      const cleanTitle = title.toLowerCase().trim();

      const isTitleMatch =
        cleanMatchTitle.includes(cleanMainTitle) ||
        cleanMainTitle.includes(cleanMatchTitle) ||
        cleanMatchTitle.includes(cleanTitle) ||
        cleanTitle.includes(cleanMatchTitle);

      if (isTitleMatch) {
        const authorKey =
          matchAuthors.length > 2
            ? `${matchAuthors[0]} et al.`
            : matchAuthors.join(" & ");
        const score = (match.cited_by_count || 0) + 1;
        const existing = authorScores.get(authorKey.toLowerCase()) || {
          count: 0,
          rawList: matchAuthors,
        };
        authorScores.set(authorKey.toLowerCase(), {
          count: existing.count + score,
          rawList: matchAuthors,
        });
      }
    }

    let highestScore = -1;
    let consensusAuthors: string[] = [];
    for (const [, val] of authorScores) {
      if (val.count > highestScore) {
        highestScore = val.count;
        consensusAuthors = val.rawList;
      }
    }

    if (consensusAuthors.length > 0) {
      log.info("openalex_author_fallback_resolved", {
        service: "boxes",
        data: {
          originalTitle: title,
          resolvedAuthors: consensusAuthors,
          score: highestScore,
        },
      });
      return consensusAuthors;
    }

    return null;
  } catch (err) {
    log.warn("openalex_author_fallback_failed", {
      service: "boxes",
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Normalizes an author list for merge-key generation — lowercases, removes
 * punctuation and "et al." suffixes, sorts multi-author entries.
 */
function normalizeForMergeAuthor(authorsList: string[]): string {
  return authorsList
    .map((a) =>
      a
        .toLowerCase()
        .replace(/\./g, " ")
        .replace(/et\s*al\.?/g, "")
        .replace(/[^a-z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .sort()
    .join(" | ");
}

/**
 * Normalizes a title for merge-key matching — lowercases, strips punctuation,
 * collapses whitespace.
 */
function normalizeForMergeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merges candidates whose author lists and titles substantially overlap
 * (same classic work split across multiple OpenAlex IDs, e.g. different
 * editions of Gramsci's Prison Notebooks).
 *
 * Two candidates match when their normalized authors overlap AND their
 * normalized titles overlap (one contains the other, or the core pre-colon
 * segments overlap).
 *
 * Merged record:
 *   - localCount = sum of all merged entries
 *   - citedByCount = max of all merged entries
 *   - title / authorsList = from the entry with the longest title
 */
interface ResolvedEntry {
  openAlexId: string;
  title: string;
  publicationYear: number;
  citedByCount: number;
  authorsList: string[];
}

interface MergedCandidate {
  id: string;
  title: string;
  publicationYear: number;
  localCount: number;
  citedByCount: number;
  authorsList: string[];
}

function mergeCandidates(
  candidates: { id: string; localCount: number }[],
  resolvedMap: Map<string, ResolvedEntry>,
): MergedCandidate[] {
  interface MergeGroup {
    ids: Set<string>;
    localCount: number;
    citedByCount: number;
    title: string;
    publicationYear: number;
    authorsList: string[];
  }

  const groups: MergeGroup[] = [];

  for (const c of candidates) {
    const resolved = resolvedMap.get(c.id);
    if (!resolved) continue;

    const normAuthor = normalizeForMergeAuthor(resolved.authorsList);
    const normTitle = normalizeForMergeTitle(resolved.title);
    const coreTitle = normTitle.split(":")[0].trim();

    let merged = false;
    for (const group of groups) {
      const groupNormAuthor = normalizeForMergeAuthor(group.authorsList);
      const groupNormTitle = normalizeForMergeTitle(group.title);
      const groupCoreTitle = groupNormTitle.split(":")[0].trim();

      const authorMatch =
        normAuthor === groupNormAuthor ||
        normAuthor.includes(groupNormAuthor) ||
        groupNormAuthor.includes(normAuthor);

      if (!authorMatch) continue;

      const titleMatch =
        normTitle.includes(groupNormTitle) ||
        groupNormTitle.includes(normTitle) ||
        coreTitle.includes(groupCoreTitle) ||
        groupCoreTitle.includes(coreTitle);

      if (titleMatch) {
        group.ids.add(c.id);
        group.localCount += c.localCount;
        group.citedByCount = Math.max(
          group.citedByCount,
          resolved.citedByCount,
        );
        if (resolved.title.length > group.title.length) {
          group.title = resolved.title;
          group.publicationYear = resolved.publicationYear;
          group.authorsList = resolved.authorsList;
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      groups.push({
        ids: new Set([c.id]),
        localCount: c.localCount,
        citedByCount: resolved.citedByCount,
        title: resolved.title,
        publicationYear: resolved.publicationYear,
        authorsList: resolved.authorsList,
      });
    }
  }

  return groups.map((g) => ({
    id: Array.from(g.ids)[0],
    title: g.title,
    publicationYear: g.publicationYear,
    localCount: g.localCount,
    citedByCount: g.citedByCount,
    authorsList: g.authorsList,
  }));
}

/**
 * Opens a candidate id string (full OpenAlex URL) and extracts the canonical
 * identifier portion (e.g. "W123456789").
 */
function extractOpenAlexId(candidateId: string): string {
  return candidateId.replace("https://openalex.org/", "");
}

/**
 * Runs a fully isolated per-query co-citation mining pipeline to find
 * seminal works for each search query independently.
 *
 * For each query:
 * 1. Fetch top 10 works from OpenAlex semantic search
 * 2. Count referenced_works frequencies (local co-citation)
 * 3. Select the top 10 most-referenced candidates (up from 5 for richer LLM input)
 * 4. Fetch metadata for those candidates (chunked for URI safety)
 * 5. Run author-consensus fallback for works with suspicious metadata
 * 6. Merge candidates with overlapping author+title (ID fragmentation recovery)
 * 7. LLM Referee — Gemini evaluates the merged list with box context to merge
 *    editions semantically, filter out secondary literature, and select the true
 *    root classic champion. Falls back to pure localCount if the call fails.
 * 8. Return one champion per query.
 *
 * Each query is an isolated cell — no cross-query deduplication or pooled
 * batch fetching. Every query gets its own champion regardless of overlap.
 *
 * @param queries Array of English semantic search query paragraphs.
 * @param log Logger instance for pipeline event tracing.
 * @param boxContext Optional box metadata (type, title, description) passed
 *   to the LLM referee for context-aware champion selection.
 */
export async function mineCoCitations(
  queries: string[],
  log: Logger,
  boxContext?: BoxContext,
): Promise<FoundationalQuery[]> {
  if (!queries || queries.length === 0) {
    return [];
  }

  log.info("co_citation_miner_start", {
    service: "boxes",
    data: { queryCount: queries.length, queries },
  });

  const activeQueries = queries.filter((q) => q.trim().length > 0);
  const apiKey = process.env.OPENALEX_API_KEY;
  const champions: FoundationalQuery[] = [];

  for (let i = 0; i < activeQueries.length; i++) {
    const query = activeQueries[i];

    log.info("co_citation_miner_query_start", {
      service: "boxes",
      data: { queryIndex: i, query: query.substring(0, 100) },
    });

    // ======================================================================
    // Step 1: Semantic search — collect referenced works for this query alone
    // ======================================================================

    const candidatesMap = new Map<string, number>();

    const params = new URLSearchParams({
      "search.semantic": query,
      per_page: String(PER_PAGE),
      select: "id,title,referenced_works,cited_by_count",
    });
    if (apiKey) params.set("api_key", apiKey);
    const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

    let emptyRetries = 0;
    const MAX_EMPTY_RETRIES = 2;

    while (true) {
      try {
        log.info("openalex_semantic_search", {
          service: "boxes",
          data: {
            queryIndex: i,
            query: query.substring(0, 100),
            attempt: emptyRetries + 1,
          },
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
          const data = (await response.json()) as {
            results?: OpenAlexWork[];
          };
          const results = data.results || [];

          if (results.length > 0) {
            for (const item of results) {
              const refs = item.referenced_works || [];
              for (const ref of refs) {
                if (!ref) continue;
                candidatesMap.set(ref, (candidatesMap.get(ref) || 0) + 1);
              }
            }
            break;
          }

          emptyRetries++;
          if (emptyRetries > MAX_EMPTY_RETRIES) {
            log.warn("openalex_semantic_search_empty", {
              service: "boxes",
              data: {
                queryIndex: i,
                query: query.substring(0, 60),
                retriesExhausted: true,
              },
            });
            break;
          }

          log.warn("openalex_semantic_search_empty_retry", {
            service: "boxes",
            data: {
              queryIndex: i,
              attempt: emptyRetries,
              maxRetries: MAX_EMPTY_RETRIES,
              query: query.substring(0, 60),
            },
          });

          await new Promise((resolve) =>
            setTimeout(resolve, OPENALEX_DELAY_MS),
          );
          continue;
        }

        log.warn("openalex_semantic_search_failed", {
          service: "boxes",
          data: { status: response.status, query: query.substring(0, 60) },
        });
        break;
      } catch (err) {
        log.error("openalex_request_failed", {
          service: "boxes",
          error: err instanceof Error ? err : new Error(String(err)),
          data: { query: query.substring(0, 60) },
        });
        break;
      }
    }

    // ======================================================================
    // Step 2: Select top K candidates for this query
    // ======================================================================

    const sortedCandidates = Array.from(candidatesMap.entries())
      .map(([id, localCount]) => ({ id, localCount }))
      .sort((a, b) => b.localCount - a.localCount)
      .slice(0, TOP_K);

    if (sortedCandidates.length === 0) {
      log.warn("co_citation_miner_no_candidates", {
        service: "boxes",
        data: {
          queryIndex: i,
          query: query.substring(0, 80),
          reason: "No referenced works extracted from search results",
        },
      });
      continue;
    }

    log.info("co_citation_miner_query_candidates", {
      service: "boxes",
      data: {
        queryIndex: i,
        query: query.substring(0, 80),
        candidateCount: sortedCandidates.length,
      },
    });

    // ======================================================================
    // Step 3: Fetch metadata for this query's candidates (chunked)
    // ======================================================================

    // Throttle: delay before internal API calls (after semantic search)
    await new Promise((resolve) => setTimeout(resolve, OPENALEX_DELAY_MS));

    const candidateIds = sortedCandidates.map((c) => extractOpenAlexId(c.id));
    const idChunks: string[][] = [];
    for (let j = 0; j < candidateIds.length; j += DETAIL_CHUNK_SIZE) {
      idChunks.push(candidateIds.slice(j, j + DETAIL_CHUNK_SIZE));
    }

    const detailResults: OpenAlexWork[] = [];
    for (const chunk of idChunks) {
      const filterParams = new URLSearchParams({
        filter: `openalex_id:${chunk.join("|")}`,
        select: "id,title,authorships,publication_year,cited_by_count",
      });
      if (apiKey) filterParams.set("api_key", apiKey);
      const detailUrl = `https://api.openalex.org/works?${filterParams.toString().replace(/\+/g, "%20")}`;

      try {
        const response = await fetchWithRetry(
          detailUrl,
          {
            headers: { "User-Agent": OPENALEX_USER_AGENT },
            signal: AbortSignal.timeout(15000),
          },
          log,
        );

        if (response.ok) {
          const data = (await response.json()) as {
            results?: OpenAlexWork[];
          };
          if (data.results) detailResults.push(...data.results);
        }
      } catch (err) {
        log.warn("openalex_detail_chunk_failed", {
          service: "boxes",
          data: {
            chunkSize: chunk.length,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    // ======================================================================
    // Step 4: Build resolved-details map with author-consensus fallback
    // ======================================================================

    const resolvedMap = new Map<
      string,
      {
        openAlexId: string;
        title: string;
        publicationYear: number;
        citedByCount: number;
        authorsList: string[];
      }
    >();
    const seenTitles = new Set<string>();

    for (const item of detailResults) {
      const title = (item.title || "").trim();
      if (!title || seenTitles.has(title.toLowerCase())) continue;
      seenTitles.add(title.toLowerCase());

      let authorsList =
        item.authorships
          ?.map((a) => a.author?.display_name || "")
          .filter(Boolean) || [];

      if (isSuspiciousMetadata(authorsList, title)) {
        log.info("openalex_fallback_triggered", {
          service: "boxes",
          data: {
            title: title.substring(0, 80),
            authorCount: authorsList.length,
            reason:
              authorsList.length === 0
                ? "empty_authors"
                : authorsList.some((a) => a.length < 3)
                  ? "short_author_name"
                  : "short_title",
          },
        });

        const resolved = await resolveAuthorsViaFallback(title, apiKey, log);
        if (resolved) {
          authorsList = resolved;
        } else {
          log.warn("openalex_candidate_skipped", {
            service: "boxes",
            data: {
              title: title.substring(0, 80),
              reason: "fallback_failed_suspicious_metadata",
            },
          });
          continue;
        }
      }

      resolvedMap.set(item.id, {
        openAlexId: item.id,
        title,
        publicationYear: item.publication_year || 0,
        citedByCount: item.cited_by_count ?? 0,
        authorsList,
      });
    }

    // ======================================================================
    // Step 5: Author+title similarity merging (ID fragmentation recovery)
    // ======================================================================

    const merged = mergeCandidates(sortedCandidates, resolvedMap);
    const mergedCount = sortedCandidates.length - merged.length;

    if (mergedCount > 0) {
      log.info("co_citation_miner_merged_records", {
        service: "boxes",
        data: {
          queryIndex: i,
          query: query.substring(0, 80),
          before: sortedCandidates.length,
          after: merged.length,
          mergedCount,
        },
      });
    }

    // ======================================================================
    // Step 6: LLM Referee — semantic champion selection with edition
    // merging and secondary-literature filtering. Falls back to localCount
    // champion if the referee call fails.
    // ======================================================================

    if (merged.length === 0) {
      log.warn("co_citation_miner_no_champion", {
        service: "boxes",
        data: {
          queryIndex: i,
          query: query.substring(0, 80),
          reason: "No resolved candidates available",
        },
      });
      continue;
    }

    interface RefereeVerdict {
      champion: {
        title: string;
        author: string;
        publicationYear: number;
        academicReasoning: string;
      };
    }

    const candidateListForReferee = merged.map((c, idx) => ({
      index: idx + 1,
      title: c.title,
      author:
        c.authorsList.length > 0
          ? c.authorsList.length > 2
            ? `${c.authorsList[0]} et al.`
            : c.authorsList.join(" & ")
          : "Bilinmeyen Yazar",
      year: c.publicationYear,
      localCount: c.localCount,
    }));

    let champion: MergedCandidate;

    try {
      log.info("llm_referee_start", {
        service: "boxes",
        data: {
          queryIndex: i,
          candidateCount: candidateListForReferee.length,
          boxContext: boxContext
            ? { title: boxContext.title, boxType: boxContext.boxType }
            : undefined,
        },
      });

      const refereePrompt = buildRefereePrompt(
        candidateListForReferee,
        boxContext,
      );

      const verdict = await generateStructuredContent<RefereeVerdict>(
        "gemini-3.1-flash-lite",
        buildRefereeSystemInstruction(),
        refereePrompt,
        CO_CITATION_REFEREE_SCHEMA,
        log,
        {
          temperature: 1.0,
          seed: BOX_REFEREE_SEED,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          payloadStage: "co-citation-referee",
        },
      );

      // Match the LLM verdict back to a merged candidate
      const llmNormTitle = normalizeForMergeTitle(verdict.champion.title);
      const matched = merged.find((c) => {
        const cNormTitle = normalizeForMergeTitle(c.title);
        return (
          cNormTitle.includes(llmNormTitle) || llmNormTitle.includes(cNormTitle)
        );
      });

      if (matched) {
        champion = {
          ...matched,
          title: verdict.champion.title,
          publicationYear: verdict.champion.publicationYear,
          authorsList: [verdict.champion.author],
        };
      } else {
        // No semantic match — use LLM verdict values directly
        champion = {
          id: "",
          title: verdict.champion.title,
          publicationYear: verdict.champion.publicationYear,
          localCount: 0,
          citedByCount: 0,
          authorsList: [verdict.champion.author],
        };
      }

      log.info("llm_referee_verdict", {
        service: "boxes",
        data: {
          queryIndex: i,
          selectedTitle: verdict.champion.title,
          selectedAuthor: verdict.champion.author,
          selectedYear: verdict.champion.publicationYear,
          matchedCandidateTitle: matched?.title ?? null,
          academicReasoning: verdict.champion.academicReasoning,
        },
      });
    } catch (err) {
      log.warn("llm_referee_fallback", {
        service: "boxes",
        data: {
          queryIndex: i,
          reason: "LLM referee failed, falling back to localCount champion",
          error: err instanceof Error ? err.message : String(err),
        },
      });

      champion = merged
        .map((c) => ({
          ...c,
          score: computeScore(c.localCount),
        }))
        .sort((a, b) => b.score - a.score)[0];
    }

    const authorStr =
      champion.authorsList.length > 0
        ? champion.authorsList.length > 2
          ? `${champion.authorsList[0]} et al.`
          : champion.authorsList.join(" & ")
        : "Bilinmeyen Yazar";

    champions.push({
      author: authorStr,
      title: champion.title,
      publicationYear: champion.publicationYear,
    });

    log.info("co_citation_miner_champion_selected", {
      service: "boxes",
      data: {
        queryIndex: i,
        query: query.substring(0, 80),
        champion: {
          author: authorStr,
          title: champion.title,
          score: champion.localCount,
        },
      },
    });

    // Inter-query throttle: delay before the next query's first API call
    await new Promise((resolve) => setTimeout(resolve, OPENALEX_DELAY_MS));
  }

  log.info("co_citation_miner_complete", {
    service: "boxes",
    data: { foundCount: champions.length },
  });

  return champions;
}
