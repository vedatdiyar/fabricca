import { extractCleanDoi, CROSSREF_USER_AGENT } from "./_shared";
import type { FoundationalQuery } from "@/lib/types";
import type { Logger } from "@/lib/logger";

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

  const results: FoundationalWorkResult[] = [];
  const BATCH_SIZE = 2;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (query) => {
        try {
          const bibQuery = `${query.author} ${query.title}`;
          const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(bibQuery)}&rows=5`;

          const response = await fetch(url, {
            headers: { "User-Agent": CROSSREF_USER_AGENT },
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) {
            logger?.warn("crossref_foundational_non_ok", {
              service: "crossref",
              filePath:
                "onboarding/literature-review/_services/foundational-resolver.ts",
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

          const BOGUS_TITLE_PATTERNS = [
            /^book\s+review/i,
            /^reflections?\s+on/i,
          ];

          const queryTitle = query.title.toLowerCase().trim();
          const queryAuthor = query.author.toLowerCase().trim();

          // Find first non-bogus item that passes validation
          let matchedItem: Record<string, unknown> | undefined;
          for (const item of items) {
            const itemTitle = ((item.title as string[])?.[0] ?? "")
              .toLowerCase()
              .trim();

            const isBogus = BOGUS_TITLE_PATTERNS.some((pattern) =>
              pattern.test(itemTitle),
            );
            if (isBogus) continue;

            const titleMatch =
              itemTitle.includes(queryTitle) || queryTitle.includes(itemTitle);

            const itemAuthorList = item.author as
              { given?: string; family?: string }[] | undefined;
            const authorMatch = itemAuthorList?.some((a) => {
              const full = `${a.given ?? ""} ${a.family ?? ""}`
                .toLowerCase()
                .trim();
              return full.includes(queryAuthor);
            });

            if (titleMatch || authorMatch) {
              matchedItem = item;
              break;
            }
          }

          if (!matchedItem) {
            return createFallback(query);
          }

          // Extract only id and publisher from Crossref; lock LLM fields
          const doi = extractCleanDoi(
            matchedItem.DOI as string | null | undefined,
          );
          const id = doi ? `https://doi.org/${doi}` : "";
          const publisher =
            (matchedItem.publisher as string) ??
            (matchedItem["container-title"] as string[])?.[0] ??
            null;

          return {
            id,
            title: query.title,
            type: (matchedItem.type as string) ?? "unknown",
            publicationYear: query.publicationYear,
            citedByCount: 0,
            isFoundational: true,
            authors: query.author ? [query.author] : [],
            publisher,
          } as FoundationalWorkResult;
        } catch (error) {
          logger?.error("foundational_work_resolution_failed", {
            service: "crossref",
            filePath:
              "onboarding/literature-review/_services/foundational-resolver.ts",
            error,
            data: { queryTitle: query.title },
          });
          return createFallback(query);
        }
      }),
    );
    results.push(...batchResults);
  }

  return results;
}
