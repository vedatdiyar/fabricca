import type { RawPaper, ValidatedPaper } from "./literature-review-papers";
import type { FoundationalQuery, JuryArticle } from "@/lib/types";
import type { Logger } from "@/lib/logger";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";

// ============================================================================
// Crossref Polite Pool Configuration
// ============================================================================

const CROSSREF_USER_AGENT =
  "FabriccaAcademicAssistant/1.0 (mailto:iletisim@fabricca.com)";

const CROSSREF_SELECT =
  "DOI,title,publisher,container-title,volume,issue,page,author,issued,type,is-referenced-by-count";

// ============================================================================
// Helper Functions
// ============================================================================

function extractCleanDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/10\.\d{4,}[^\s]*/i);
  return match ? match[0].replace(/\.$/, "") : null;
}

function resolveAbstractInvertedIndex(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex) return null;
  const entries: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      entries.push([pos, word]);
    }
  }
  entries.sort(([a], [b]) => a - b);
  return entries.map(([, word]) => word).join(" ");
}

// ============================================================================
// OpenAlex Response Parser
// ============================================================================

function parseOpenAlexResults(results: Record<string, unknown>[]): RawPaper[] {
  results = results.filter((work) => {
    const type = work.type as string | undefined;
    return type === "article" || type === "book-chapter" || type === "book";
  });

  const rawScores = results.map(
    (work) => (work.relevance_score as number) ?? 0,
  );
  const maxScore = Math.max(...rawScores, 0);
  const safeMax = maxScore > 0 ? maxScore : 1;

  return results.map((work, i) => {
    const topics = work.topics as
      | {
          display_name?: string;
          subfield?: { display_name?: string };
          field?: { display_name?: string };
          domain?: { display_name?: string };
        }[]
      | undefined;
    const authorships = work.authorships as
      | { author?: { display_name?: string } }[]
      | null
      | undefined;
    const primaryLocation = work.primary_location as
      | {
          landing_page_url?: string;
          source?: { display_name?: string };
        }
      | null
      | undefined;

    const primaryTopic = topics?.[0];
    const topicName = primaryTopic?.display_name ?? null;

    const hierarchyParts: string[] = [];
    const domain = primaryTopic?.domain?.display_name;
    const field = primaryTopic?.field?.display_name;
    const subfield = primaryTopic?.subfield?.display_name;
    if (domain) hierarchyParts.push(domain);
    if (field) hierarchyParts.push(field);
    if (subfield) hierarchyParts.push(subfield);

    const metadataParts: string[] = [];
    if (topicName) metadataParts.push(`Topic: ${topicName}`);
    if (hierarchyParts.length > 0)
      metadataParts.push(`Hierarchy: ${hierarchyParts.join(" > ")}`);
    const metadata = metadataParts.length > 0 ? metadataParts.join(". ") : null;

    const invertedIndex = work.abstract_inverted_index as
      | Record<string, number[]>
      | null
      | undefined;

    return {
      source: "openalex" as const,
      title: formatAcademicTitle((work.title as string) ?? ""),
      abstract: resolveAbstractInvertedIndex(invertedIndex),
      metadata,
      doi: extractCleanDoi(work.doi as string | null | undefined),
      url: primaryLocation?.landing_page_url ?? (work.id as string) ?? null,
      authors:
        authorships?.map((a) => a.author?.display_name ?? "").filter(Boolean) ??
        [],
      year: (work.publication_year as number) ?? null,
      publisher: primaryLocation?.source?.display_name ?? null,
      openAlexId: (work.id as string) ?? null,
      isFoundational: false,
      relevanceScore: (rawScores[i] ?? 0) / safeMax,
    };
  });
}

// ============================================================================
// OpenAlex Query Executor (shared factory)
// ============================================================================

async function queryOpenAlexWorks(
  params: URLSearchParams,
): Promise<RawPaper[]> {
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  const url = `https://api.openalex.org/works?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 429) {
      throw new Error("OpenAlex rate limit exceeded (429)");
    }
    if (!response.ok) return [];
    const data = (await response.json()) as {
      results?: Record<string, unknown>[];
    };
    const results = data.results;
    if (!results) return [];
    return parseOpenAlexResults(results);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("OpenAlex rate limit") ||
        err instanceof TypeError ||
        err.name === "AbortError")
    ) {
      throw err;
    }
    return [];
  }
}

// ============================================================================
// Stage 1a: OpenAlex Semantic Search
// ============================================================================

export async function searchOpenAlex(query: string): Promise<RawPaper[]> {
  const params = new URLSearchParams({
    "search.semantic": query,
    per_page: "50",
    select:
      "id,title,type,biblio,cited_by_count,authorships,publication_year,primary_location",
  });
  const results = await queryOpenAlexWorks(params);
  if (results.length === 0) {
    return [];
  }
  return results;
}

// ============================================================================
// CrossRef Polite-Pool Validation
// ============================================================================

export async function validateWithCrossRef(
  paper: ValidatedPaper,
  logger?: Logger,
): Promise<ValidatedPaper> {
  if (
    !paper.doi ||
    paper.doi.toLowerCase().trim() === "not_provided" ||
    !/^10\.\d{4,}/.test(paper.doi.trim())
  )
    return paper;

  const contactEmail = process.env.CROSSREF_CONTACT_EMAIL;
  const endpoint = `https://api.crossref.org/works/${encodeURIComponent(paper.doi)}${contactEmail ? `?mailto=${encodeURIComponent(contactEmail)}` : ""}`;

  const CROSSREF_MAX_RETRIES = 3;
  const CROSSREF_BASE_DELAY_MS = 1000;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        headers: { "User-Agent": CROSSREF_USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const body = (await response.json()) as
          | { message?: Record<string, unknown> }
          | undefined;
        const message = body?.message;
        if (!message) return paper;

        const authorList = message.author as
          | { given?: string; family?: string }[]
          | undefined;
        if (authorList && authorList.length > 0) {
          const resolvedAuthors: string[] = [];
          for (const a of authorList) {
            const given = (a.given ?? "").trim();
            const family = (a.family ?? "").trim();
            const full = `${given} ${family}`.trim();
            if (full) resolvedAuthors.push(full);
          }
          if (resolvedAuthors.length > 0) {
            paper.authors = resolvedAuthors;
          }
        }

        const crossrefUrl = message.URL as string | undefined;
        if (crossrefUrl) paper.url = crossrefUrl;

        const publisher = message.publisher as string | undefined;
        const containerTitle = message["container-title"] as
          | string[]
          | undefined;
        if (publisher) paper.publisher = publisher;
        else if (containerTitle && containerTitle.length > 0) {
          paper.publisher = containerTitle[0];
        }

        const title = message.title as string[] | undefined;
        if (title && title.length > 0) {
          paper.title = formatAcademicTitle(title[0]);
        }

        const published = message.published as
          | { "date-parts"?: number[][] }
          | undefined;
        const dateParts = published?.["date-parts"];
        if (dateParts && dateParts.length > 0 && dateParts[0].length > 0) {
          paper.year = dateParts[0][0];
        }

        return paper;
      }

      const isRetryable =
        response.status === 429 ||
        response.status === 503 ||
        response.status >= 500;

      if (isRetryable && attempt <= CROSSREF_MAX_RETRIES) {
        const backoff = CROSSREF_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = backoff * 0.3 * Math.random();
        const delayMs = backoff + jitter;

        logger?.warn("crossref_retry", {
          service: "crossref",
          filePath:
            "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
          step: `retry_attempt_${attempt}`,
          durationMs: delayMs,
          data: {
            attempt,
            maxRetries: CROSSREF_MAX_RETRIES,
            doi: paper.doi,
            status: response.status,
            delayMs: Math.round(delayMs),
          },
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      logger?.warn("crossref_non_ok", {
        service: "crossref",
        filePath:
          "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
        data: {
          doi: paper.doi,
          status: response.status,
          attempt,
        },
      });

      return paper;
    } catch (error) {
      if (attempt <= CROSSREF_MAX_RETRIES) {
        const backoff = CROSSREF_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = backoff * 0.3 * Math.random();
        const delayMs = backoff + jitter;

        logger?.warn("crossref_network_retry", {
          service: "crossref",
          filePath:
            "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
          step: `retry_attempt_${attempt}`,
          durationMs: delayMs,
          data: {
            attempt,
            maxRetries: CROSSREF_MAX_RETRIES,
            doi: paper.doi,
            delayMs: Math.round(delayMs),
            error: error instanceof Error ? error.message : String(error),
          },
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      logger?.warn("crossref_failed", {
        service: "crossref",
        filePath:
          "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
        data: {
          doi: paper.doi,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return paper;
    }
  }
}

// ============================================================================
// Foundational Works Resolution
// ============================================================================

export interface FoundationalWorkResult {
  id: string;
  title: string;
  type: string;
  publicationYear: number;
  citedByCount: number;
  isFoundational: boolean;
  authors: string[];
  publisher: string | null;
}

/**
 * Resolves a list of foundational (classical/seminal) work queries against the
 * Crossref API using query.bibliographic. Each query combines the author and
 * title into a single bibliographic search, requesting the top-1 result.
 *
 * Each result is validated against title and/or author criteria before acceptance;
 * if no result passes validation (LLM hallucination guard), the raw query data
 * is preserved via createFallback instead of accepting an irrelevant match.
 *
 * All queries are resolved in parallel via Promise.all.
 * Every query is guaranteed to return a FoundationalWorkResult — either
 * enriched by Crossref or created as a fallback from the raw query data.
 *
 * @param queries - Array of FoundationalQuery objects (author, title, publicationYear)
 * @returns Array of FoundationalWorkResult with Crossref metadata (guaranteed 1:1 with input)
 */
export async function resolveFoundationalWorks(
  queries: FoundationalQuery[],
  logger?: Logger,
): Promise<FoundationalWorkResult[]> {
  if (!queries || queries.length === 0) return [];

  function createFallback(query: FoundationalQuery): FoundationalWorkResult {
    return {
      id: "",
      title: query.title,
      type: "unknown",
      publicationYear: query.publicationYear,
      citedByCount: 0,
      isFoundational: true,
      authors: query.author ? [query.author] : [],
      publisher: null,
    } as FoundationalWorkResult;
  }

  const results = await Promise.all(
    queries.map(async (query) => {
      try {
        const bibQuery = `${query.author} ${query.title}`;
        const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(bibQuery)}&rows=1&select=${encodeURIComponent(CROSSREF_SELECT)}`;

        const response = await fetch(url, {
          headers: { "User-Agent": CROSSREF_USER_AGENT },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          logger?.warn("crossref_foundational_non_ok", {
            service: "crossref",
            filePath:
              "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
            data: {
              queryTitle: query.title,
              status: response.status,
            },
          });
          return createFallback(query);
        }

        const data = (await response.json()) as {
          message?: { items?: Record<string, unknown>[] };
        };
        const items = data?.message?.items;
        if (!items || items.length === 0) {
          return createFallback(query);
        }

        const match = items[0];

        // Validation — title/author fuzzy guard against hallucination
        const matchTitle = ((match.title as string[])?.[0] ?? "")
          .toLowerCase()
          .trim();
        const queryTitle = query.title.toLowerCase().trim();
        const titleMatch =
          matchTitle.includes(queryTitle) || queryTitle.includes(matchTitle);

        const authorList = match.author as
          | { given?: string; family?: string }[]
          | undefined;
        const queryAuthor = query.author.toLowerCase().trim();
        const authorMatch = authorList?.some((a) => {
          const full = `${a.given ?? ""} ${a.family ?? ""}`
            .toLowerCase()
            .trim();
          return full.includes(queryAuthor);
        });

        if (!titleMatch && !authorMatch) {
          return createFallback(query);
        }

        // Extract fields from Crossref response
        const doi = extractCleanDoi(match.DOI as string | null | undefined);
        const id = doi ? `https://doi.org/${doi}` : "";
        const title = formatAcademicTitle(
          ((match.title as string[])?.[0] as string) ?? query.title,
        );
        const type = (match.type as string) ?? "unknown";
        const issued = match.issued as
          | { "date-parts"?: number[][] }
          | undefined;
        const publicationYear =
          issued?.["date-parts"]?.[0]?.[0] ?? query.publicationYear;
        const citedByCount = (match["is-referenced-by-count"] as number) ?? 0;
        const publisher = (match.publisher as string) ?? null;
        const containerTitle =
          (match["container-title"] as string[])?.[0] ?? null;
        const resolvedPublisher = publisher ?? containerTitle;
        const authors: string[] =
          authorList
            ?.map((a) =>
              `${(a.given ?? "").trim()} ${(a.family ?? "").trim()}`.trim(),
            )
            .filter(Boolean) ?? (query.author ? [query.author] : []);

        return {
          id,
          title,
          type,
          publicationYear,
          citedByCount,
          isFoundational: true,
          authors,
          publisher: resolvedPublisher,
        } as FoundationalWorkResult;
      } catch (error) {
        logger?.error("foundational_work_resolution_failed", {
          service: "crossref",
          filePath:
            "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
          error,
          data: { queryTitle: query.title },
        });
        return createFallback(query);
      }
    }),
  );

  return results;
}

// ============================================================================
// Final Enrichment — Crossref-based künye takviyesi (post-AI-review)
// ============================================================================

/**
 * Enriches a single JuryArticle by fetching metadata from Crossref when
 * critical fields (title, authors, year, publisher) are missing.
 * Only missing fields are patched; existing values are never overwritten.
 *
 * Uses DOI-based exact lookup when available, otherwise falls back to
 * query.bibliographic with the article title.
 *
 * @param article - The article to enrich in-place
 * @param logger - Optional logger instance
 * @returns The enriched article (same reference if no enrichment needed)
 */
async function enrichSingleJuryArticle(
  article: JuryArticle,
  logger?: Logger,
): Promise<JuryArticle> {
  const needsTitle = !article.title;
  const needsAuthors = !article.authors || article.authors.length === 0;
  const needsYear = !article.publicationYear || article.publicationYear === 0;
  const needsPublisher = !article.publisher;

  if (!needsTitle && !needsAuthors && !needsYear && !needsPublisher) {
    return article;
  }

  const hasValidDoi = article.doi && /^10\.\d{4,}/.test(article.doi.trim());

  let endpoint: string;
  if (hasValidDoi) {
    endpoint = `https://api.crossref.org/works/${encodeURIComponent(article.doi.trim())}?select=${encodeURIComponent(CROSSREF_SELECT)}`;
  } else if (article.title) {
    endpoint = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(article.title)}&rows=1&select=${encodeURIComponent(CROSSREF_SELECT)}`;
  } else {
    return article;
  }

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger?.warn("crossref_enrichment_non_ok", {
        service: "crossref",
        filePath:
          "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
        data: {
          doi: article.doi,
          title: article.title?.substring(0, 100),
          status: response.status,
        },
      });
      return article;
    }

    const body = (await response.json()) as {
      message?: { items?: Record<string, unknown>[] };
    };

    let item: Record<string, unknown> | undefined;

    if (hasValidDoi) {
      // DOI endpoint returns the work directly in message
      const msg = body.message as Record<string, unknown> | undefined;
      if (msg && msg.DOI) item = msg;
    } else {
      // query.bibliographic returns items array
      const items = body?.message?.items;
      if (items && items.length > 0) item = items[0];
    }

    if (!item) return article;

    const enriched = { ...article };

    if (needsTitle) {
      const titleArr = item.title as string[] | undefined;
      if (titleArr && titleArr.length > 0) {
        enriched.title = formatAcademicTitle(titleArr[0]);
      }
    }

    if (needsAuthors) {
      const authorList = item.author as
        | { given?: string; family?: string }[]
        | undefined;
      if (authorList && authorList.length > 0) {
        enriched.authors = authorList
          .map((a) =>
            `${(a.given ?? "").trim()} ${(a.family ?? "").trim()}`.trim(),
          )
          .filter(Boolean);
      }
    }

    if (needsYear) {
      const issued = item.issued as { "date-parts"?: number[][] } | undefined;
      const year = issued?.["date-parts"]?.[0]?.[0];
      if (year) enriched.publicationYear = year;
    }

    if (needsPublisher) {
      const publisher = item.publisher as string | undefined;
      const containerTitle = item["container-title"] as string[] | undefined;
      if (publisher) enriched.publisher = publisher;
      else if (containerTitle && containerTitle.length > 0) {
        enriched.publisher = containerTitle[0];
      }
    }

    return enriched;
  } catch (error) {
    logger?.warn("crossref_enrichment_failed", {
      service: "crossref",
      filePath:
        "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
      data: {
        doi: article.doi,
        title: article.title?.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return article;
  }
}

/**
 * Enriches the top-N articles (by position) in a JuryArticle array with
 * Crossref metadata when critical fields are missing.
 *
 * Designed to be called after the AI review stage, just before the final
 * arrays are written to the database. Only the first `topN` articles are
 * checked to avoid excessive API calls on low-ranked candidates.
 *
 * @param articles - Array of JuryArticle to potentially enrich
 * @param topN - Number of top articles to inspect (default: 5)
 * @param logger - Optional logger instance
 * @returns Enriched article array (preserves order and unmodified articles)
 */
export async function enrichFinalArticles(
  articles: JuryArticle[],
  topN: number = 5,
  logger?: Logger,
): Promise<JuryArticle[]> {
  if (!articles || articles.length === 0) return articles;

  const toEnrich = articles.slice(0, topN);
  const rest = articles.slice(topN);

  const enriched = await Promise.all(
    toEnrich.map((article) => enrichSingleJuryArticle(article, logger)),
  );

  return [...enriched, ...rest];
}

// ============================================================================
// Full Abstract Recovery (post-sifting)
// ============================================================================

/**
 * Fetches full abstracts for a batch of OpenAlex work IDs after the sifting
 * stage. Splits IDs into chunks of 100 (OpenAlex OR limit) and queries each
 * chunk in parallel, merging results into a single Map.
 *
 * @param openAlexIds - Array of OpenAlex work URLs (e.g. "https://openalex.org/W...")
 * @returns Map of openAlexId → full abstract text
 */
export async function fetchFullAbstracts(
  openAlexIds: string[],
  logger?: Logger,
): Promise<Map<string, string>> {
  if (!openAlexIds || openAlexIds.length === 0) return new Map();

  const CHUNK_SIZE = 100;
  const cleanedIds = openAlexIds.map((id) =>
    id.replace(/^https?:\/\/openalex\.org\//, ""),
  );
  const apiKey = process.env.OPENALEX_API_KEY;

  const chunks: string[][] = [];
  for (let i = 0; i < cleanedIds.length; i += CHUNK_SIZE) {
    chunks.push(cleanedIds.slice(i, i + CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const params = new URLSearchParams({
        filter: `openalex_id:${chunk.join("|")}`,
        select: "id,abstract_inverted_index",
        per_page: "100",
      });
      if (apiKey) params.set("api_key", apiKey);

      const url = `https://api.openalex.org/works?${params.toString()}`;

      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) {
          logger?.warn("fetch_full_abstracts_chunk_failed", {
            service: "openalex",
            filePath:
              "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
            data: {
              status: response.status,
              chunkSize: chunk.length,
            },
          });
          return new Map<string, string>();
        }

        const data = (await response.json()) as {
          results?: Record<string, unknown>[];
        };
        const results = data.results;
        if (!results) return new Map<string, string>();

        const chunkMap = new Map<string, string>();
        for (const work of results) {
          const id = work.id as string | undefined;
          if (!id) continue;

          const invertedIndex = work.abstract_inverted_index as
            | Record<string, number[]>
            | null
            | undefined;
          const resolved = resolveAbstractInvertedIndex(invertedIndex);
          if (resolved) {
            chunkMap.set(id, resolved);
          }
        }

        return chunkMap;
      } catch (err) {
        logger?.warn("fetch_full_abstracts_chunk_exception", {
          service: "openalex",
          filePath:
            "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
          data: {
            chunkSize: chunk.length,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return new Map<string, string>();
      }
    }),
  );

  const abstractMap = new Map<string, string>();
  for (const chunkMap of chunkResults) {
    for (const [id, abstract] of chunkMap) {
      abstractMap.set(id, abstract);
    }
  }

  return abstractMap;
}
