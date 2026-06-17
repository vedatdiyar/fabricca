import type { RawPaper, ValidatedPaper } from "./literature-review-papers";
import type { FoundationalQuery } from "@/lib/types";
import type { Logger } from "@/lib/logger";

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
  const rawScores = results.map(
    (work) => (work.relevance_score as number) ?? 0,
  );
  const maxScore = Math.max(...rawScores, 0);
  const safeMax = maxScore > 0 ? maxScore : 1;

  return results.map((work, i) => {
    const topics = work.topics as { display_name?: string }[] | undefined;
    const concepts = work.concepts as
      | { display_name?: string; score?: number; level?: number }[]
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

    const topicName = topics?.[0]?.display_name ?? null;
    const topConcepts =
      concepts
        ?.filter(
          (c) => (c.score ?? 0) > 0.3 && (c.level === 1 || c.level === 2),
        )
        .slice(0, 3)
        .map((c) => c.display_name)
        .filter(Boolean) ?? [];

    const metadataParts: string[] = [];
    if (topicName) metadataParts.push(`Topic: ${topicName}`);
    if (topConcepts.length > 0)
      metadataParts.push(`Concepts: ${topConcepts.join(", ")}`);
    const metadata =
      metadataParts.length > 0 ? metadataParts.join(". ") : null;

    return {
      source: "openalex" as const,
      title: (work.title as string) ?? null,
      abstract: null,
      metadata,
      doi: extractCleanDoi(work.doi as string | null | undefined),
      url: primaryLocation?.landing_page_url ?? (work.id as string) ?? null,
      authors:
        authorships
          ?.map((a) => a.author?.display_name ?? "")
          .filter(Boolean) ?? [],
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

async function queryOpenAlexWorks(params: URLSearchParams): Promise<RawPaper[]> {
  const url = `https://api.openalex.org/works?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      results?: Record<string, unknown>[];
    };
    const results = data.results;
    if (!results) return [];
    return parseOpenAlexResults(results);
  } catch {
    return [];
  }
}

// ============================================================================
// Stage 1a: OpenAlex Semantic Search
// ============================================================================

export async function searchOpenAlex(query: string): Promise<RawPaper[]> {
  const apiKey = process.env.OPENALEX_API_KEY;
  const params = new URLSearchParams({
    "search.semantic": query,
    per_page: "50",
    select:
      "title,topics,concepts,doi,id,authorships,publication_year,primary_location",
  });
  if (apiKey) params.set("api_key", apiKey);
  return queryOpenAlexWorks(params);
}

// ============================================================================
// Stage 1b: OpenAlex Keyword Search (full-text fallback)
// ============================================================================

/**
 * Searches OpenAlex using the standard 'search' parameter (keyword/full-text).
 * Unlike 'search.semantic' which uses vector similarity, this performs exact
 * keyword matching as a fallback.
 */
export async function searchOpenAlexKeyword(
  query: string,
): Promise<RawPaper[]> {
  const apiKey = process.env.OPENALEX_API_KEY;
  const params = new URLSearchParams({
    search: query,
    sort: "cited_by_count:desc",
    per_page: "50",
    select:
      "title,topics,concepts,doi,id,authorships,publication_year,primary_location",
  });
  if (apiKey) params.set("api_key", apiKey);
  return queryOpenAlexWorks(params);
}

// ============================================================================
// CrossRef Polite-Pool Validation
// ============================================================================

export async function validateWithCrossRef(
  paper: ValidatedPaper,
): Promise<ValidatedPaper> {
  if (!paper.doi) return paper;

  const contactEmail = process.env.CROSSREF_CONTACT_EMAIL;
  const endpoint = `https://api.crossref.org/works/${encodeURIComponent(paper.doi)}${contactEmail ? `?mailto=${encodeURIComponent(contactEmail)}` : ""}`;

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return paper;

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
    const containerTitle = message["container-title"] as string[] | undefined;
    if (publisher) paper.publisher = publisher;
    else if (containerTitle && containerTitle.length > 0) {
      paper.publisher = containerTitle[0];
    }

    const published = message.published as
      | { "date-parts"?: number[][] }
      | undefined;
    const dateParts = published?.["date-parts"];
    if (dateParts && dateParts.length > 0 && dateParts[0].length > 0) {
      paper.year = dateParts[0][0];
    }

    return paper;
  } catch {
    return paper;
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
}

/**
 * Resolves a list of foundational (classical/seminal) work queries against the
 * OpenAlex works endpoint using AND-filtered title + author search. Returns
 * validated works sorted by citation count (highest first) and deduplicated.
 *
 * Each query is resolved independently in a Promise.allSettled parallel batch.
 * Failed or empty results are silently filtered out.
 *
 * @param queries - Array of FoundationalQuery objects (author, title, publicationYear)
 * @returns Array of FoundationalWorkResult with OpenAlex metadata
 */
export async function resolveFoundationalWorks(
  queries: FoundationalQuery[],
  logger?: Logger,
): Promise<FoundationalWorkResult[]> {
  if (!queries || queries.length === 0) return [];

  const resolvePromises = queries.map(async (query) => {
    try {
      const urlParams = new URLSearchParams({
        filter: `title.search:${query.title},raw_author_name.search:${query.author}`,
        sort: "cited_by_count:desc",
        per_page: "1",
        select: "id,title,type,publication_year,cited_by_count",
      });

      const response = await fetch(
        `https://api.openalex.org/works?${urlParams.toString()}`,
        {
          headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!response.ok) return null;

      const data = (await response.json()) as {
        results?: Record<string, unknown>[];
      };
      const result = data.results?.[0];

      if (!result) return null;

      return {
        id: result.id as string,
        title: (result.title as string) ?? "",
        type: (result.type as string) ?? "unknown",
        publicationYear: (result.publication_year as number) ?? 0,
        citedByCount: (result.cited_by_count as number) ?? 0,
        isFoundational: true,
      } as FoundationalWorkResult;
    } catch (error) {
      logger?.error("foundational_work_resolution_failed", {
        service: "openalex",
        filePath: "src/app/(auth)/onboarding/literature-review/_services/search-api.ts",
        error,
        data: { queryTitle: query.title },
      });
      return null;
    }
  });

  const resolvedWorks = await Promise.all(resolvePromises);
  return resolvedWorks.filter(
    (work): work is FoundationalWorkResult => work !== null,
  );
}

// ============================================================================
// Full Abstract Recovery (post-sifting)
// ============================================================================

/**
 * Fetches full abstracts for a batch of OpenAlex work IDs after the sifting
 * stage. Uses a single API call with a pipe-delimited ID filter.
 *
 * @param openAlexIds - Array of OpenAlex work URLs (e.g. "https://openalex.org/W...")
 * @returns Map of openAlexId → full abstract text
 */
export async function fetchFullAbstracts(
  openAlexIds: string[],
): Promise<Map<string, string>> {
  if (!openAlexIds || openAlexIds.length === 0) return new Map();

  const apiKey = process.env.OPENALEX_API_KEY;
  const params = new URLSearchParams({
    filter: `id:${openAlexIds.join("|")}`,
    select: "id,abstract_inverted_index",
    per_page: "200",
  });
  if (apiKey) params.set("api_key", apiKey);

  const url = `https://api.openalex.org/works?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return new Map();

    const data = (await response.json()) as {
      results?: Record<string, unknown>[];
    };
    const results = data.results;
    if (!results) return new Map();

    const abstractMap = new Map<string, string>();
    for (const work of results) {
      const id = work.id as string | undefined;
      if (!id) continue;

      const invertedIndex = work.abstract_inverted_index as
        | Record<string, number[]>
        | null
        | undefined;
      const resolved = resolveAbstractInvertedIndex(invertedIndex);
      if (resolved) {
        abstractMap.set(id, resolved);
      }
    }

    return abstractMap;
  } catch {
    return new Map();
  }
}
