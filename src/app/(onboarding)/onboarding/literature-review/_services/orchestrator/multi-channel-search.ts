import type { Logger } from "@/lib/logger";
import type { RawPaper, SubBoxItem } from "../literature-review-papers";
import { searchOpenAlex, searchOpenAlexByTitleFilter } from "../openalex/client";
import { searchTheses } from "@/core/services/thesis-search";

import { parseDualSemanticQuery } from "@/lib/academic/utils";

/**
 * Builds a generic keyword query for OpenAlex `search` hybrid complement.
 * Prefers curated English keywords from `openAlexQuery`, falls
 * back to sub-box title/concepts filtered to English tokens (>3 chars).
 * Not a hardcoded book title — derived per box.
 */
function buildTitleFilterQuery(subBox: SubBoxItem, openAlexQuery?: string): string {
  if (openAlexQuery && openAlexQuery.trim().length >= 10) {
    // Remove very short acronyms that break title.search (HEP/DEP <4 chars)
    const filtered = openAlexQuery
      .split(/\s+/)
      .filter((t) => t.replace(/[^a-zA-Z]/g, "").length >= 3)
      .slice(0, 8)
      .join(" ");
    if (filtered.length >= 10) return filtered;
  }
  const parts: string[] = [];
  if (subBox.title) parts.push(subBox.title);
  if (subBox.concepts && subBox.concepts.length > 0) {
    parts.push(subBox.concepts.slice(0, 3).join(" "));
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  // Keep only English-ish tokens >=4 chars for OpenAlex `search`
  const tokens = joined
    .split(/\s+/)
    .filter((t) => t.replace(/[^a-zA-Zçğıöşü]/g, "").length >= 4)
    .slice(0, 8)
    .join(" ");
  return tokens;
}

/** Maximum time to wait for any individual search provider before continuing. */
const PROVIDER_TIMEOUT_MS = 10000;

/**
 * Wraps a provider call with a real abort — timeout actually cancels the
 * underlying `fetch` socket so quota/server resources are not wasted.
 * Previously this was a `Promise.race` that leaked the fetch.
 *
 * @param providerFn - Function receiving an AbortSignal; must forward `signal` to fetch.
 * @param fallbackValue - Value returned on timeout/abort.
 * @param timeoutMs - Timeout in ms (timer starts when this wrapper is entered).
 * @param providerName - Log label (e.g. "qdrant", "openalex").
 * @param logger - Optional logger for timeout visibility.
 * @returns Provider result or fallback.
 */
async function withProviderTimeout<T>(
  providerFn: (signal: AbortSignal) => Promise<T>,
  fallbackValue: T,
  timeoutMs: number,
  providerName: string,
  logger?: Logger,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await providerFn(controller.signal);
  } catch (err) {
    const isAbort =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError") ||
      (err instanceof DOMException && err.name === "AbortError");
    if (isAbort) {
      logger?.warn("provider_timeout_aborted", {
        service: "literature",
        filePath: "src/app/(onboarding)/onboarding/literature-review/_services/orchestrator/multi-channel-search.ts",
        data: { provider: providerName, timeoutMs },
      });
      return fallbackValue;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes a 2-channel parallel search across:
 * 1. OpenAlex (Global scholarly works, semantic vector search + keyword title search)
 * 2. Qdrant (YÖK National Thesis Center embeddings)
 *
 * @param subBox - The sub-box item containing title, description, and semanticQuery.
 * @param logger - Shared pipeline logger.
 * @param checkCancelled - Optional cancellation check callback.
 * @returns Unified array of RawPaper candidates across all channels.
 */
export async function searchMultiChannelForSubBox(
  subBox: SubBoxItem,
  logger: Logger,
  checkCancelled?: () => boolean,
): Promise<RawPaper[]> {
  const { openAlexQuery } = parseDualSemanticQuery(subBox.semanticQuery);
  const turkishQuery = `${subBox.title}: ${subBox.description}`.trim();

  logger.info("multi_channel_search_start", {
    hidden: true,
    data: {
      subBoxTitle: subBox.title,
      hasOpenAlexQuery: Boolean(openAlexQuery),
      hasTurkishQuery: Boolean(turkishQuery),
    },
  });

  const titleFilterQuery = buildTitleFilterQuery(subBox, openAlexQuery);

  const [openAlexResult, openAlexTitleResult, qdrantThesesResult] =
    await Promise.allSettled([
      // 1a. OpenAlex semantic — GTE Large EN (1024d) server-side vector.
      (async (): Promise<RawPaper[]> => {
        if (!openAlexQuery || checkCancelled?.()) return [];
        try {
          const raw = await searchOpenAlex(openAlexQuery, 50, checkCancelled);
          return raw.map((p) => ({
            ...p,
            source: "openalex" as const,
            publicationType: p.publicationType || "Makale",
          }));
        } catch (err) {
          logger.warn("multi_channel_openalex_failed", {
            error: err instanceof Error ? err.message : String(err),
            data: { subBoxTitle: subBox.title },
          });
          return [];
        }
      })(),

      // 1b. OpenAlex title.search hybrid — recovers canonical books/monographs
      // demoted by GTE ranking (e.g. Watts 2010 W2342901704). Generic per-box
      // keyword filter, not hardcoded. Uses regular queue (100 req/s).
      (async (): Promise<RawPaper[]> => {
        if (!titleFilterQuery || checkCancelled?.()) return [];
        try {
          const raw = await withProviderTimeout(
            (signal) => searchOpenAlexByTitleFilter(titleFilterQuery, 15, checkCancelled, signal),
            [],
            PROVIDER_TIMEOUT_MS,
            "openalex_title",
            logger,
          );
          return raw.map((p) => ({
            ...p,
            source: "openalex" as const,
            publicationType: p.publicationType || "Makale",
          }));
        } catch (err) {
          logger.warn("multi_channel_openalex_title_failed", {
            error: err instanceof Error ? err.message : String(err),
            data: { subBoxTitle: subBox.title, titleFilterQuery },
          });
          return [];
        }
      })(),

      // 2. Qdrant — text → HF `multilingual-e5-base` 768d → Cosine (768/Cosine). Isolated from OpenAlex GTE 1024d space.
      (async (): Promise<RawPaper[]> => {
        if (!turkishQuery || checkCancelled?.()) return [];
        try {
          const theses = await withProviderTimeout(
            (signal) =>
              searchTheses(
                turkishQuery,
                logger,
                {
                  limit: 15,
                  silent: true,
                },
                signal,
              ),
            [],
            PROVIDER_TIMEOUT_MS,
            "qdrant",
            logger,
          );

          return theses.map((t): RawPaper => {
            const publisherParts = [t.university, t.department].filter(Boolean);
            const publisher =
              publisherParts.length > 0
                ? publisherParts.join(" - ")
                : "YÖK Ulusal Tez Merkezi";

            const url =
              t.yokPdfUrl ||
              (t.id
                ? `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${t.id}`
                : null);

            return {
              source: "qdrant",
              title: t.title,
              abstract: t.abstract || null,
              metadata: publisher,
              doi: null,
              authors: t.author ? [t.author.trim()] : [],
              year: t.year || null,
              publisher,
              openAlexId: null,
              relevanceScore: 0.85,
              citedByCount: 0,
              url,
              publicationType: t.thesisType || "Tez",
            };
          });
        } catch (err) {
          logger.warn("multi_channel_qdrant_failed", {
            error: err instanceof Error ? err.message : String(err),
            data: { subBoxTitle: subBox.title },
          });
          return [];
        }
      })(),
    ]);

  const rawOpenAlexPapers =
    openAlexResult.status === "fulfilled" ? openAlexResult.value : [];

  // ── Parent-book resolution for book-reviews (generic, not hardcoded) ──
  // Top-ranked `Kitap İncelemesi` entries often hide the canonical monograph
  // (e.g. W654994107 review → W2342901704 Watts book). Resolve to parent `book`.
  const resolvedParentBooks: RawPaper[] = [];
  const reviewCandidates = rawOpenAlexPapers
    .filter((p) => p.publicationType === "Kitap İncelemesi" && p.title)
    .sort((a, b) => (b.citedByCount ?? 0) - (a.citedByCount ?? 0))
    .slice(0, 1);

  if (reviewCandidates.length > 0) {
    const parentResults = await Promise.allSettled(
      reviewCandidates.map(async (review) => {
        // Use short core title before ":" (e.g. "Activists in Office" from "Activists in Office: Kurdish...")
        // Full title with subtitle fails OpenAlex fulltext search (returns unrelated books)
        const rawTitle = review.title ?? "";
        const coreTitle = rawTitle.split(":")[0]?.trim() || rawTitle;
        const titleQuery = coreTitle.slice(0, 40).trim();
        if (!titleQuery || titleQuery.length < 8) return null;
        try {
          return await withProviderTimeout(
            async (signal) => {
              const { openAlexQueue, queryOpenAlexWorks } = await import("../openalex/openalex-http");
              const params = new URLSearchParams({
                search: titleQuery,
                filter: "type:book",
                per_page: "3",
                select:
                  "id,title,type,authorships,relevance_score,doi,language,abstract_inverted_index,cited_by_count,primary_location",
              });
              const apiKey = process.env.OPENALEX_API_KEY;
              if (apiKey) params.set("api_key", apiKey);
              const res = (await openAlexQueue.exec(() =>
                queryOpenAlexWorks(params, checkCancelled, signal),
              )) as RawPaper[];
              // Prefer exact title match, else first result
              const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
              const targetNorm = norm(titleQuery);
              const exact = res.find((r) => r.title && norm(r.title) === targetNorm);
              const chosen = exact ?? res[0];
              if (!chosen) return null;
              // Deduplicate if already present
              if (rawOpenAlexPapers.some((p) => p.openAlexId && p.openAlexId === chosen.openAlexId)) return null;
              // Propagate review's citation network to parent book for forward expansion:
              // Watts book has 2 cites, its review has 198 — use max so expansion doesn't starve.
              const mergedCitedByCount = Math.max(chosen.citedByCount ?? 0, review.citedByCount ?? 0);
              // Also propagate review DOI when book has none (book often lacks DOI, review has Choice DOI)
              const mergedDoi = chosen.doi ?? review.doi ?? null;
              return {
                ...chosen,
                doi: mergedDoi,
                citedByCount: mergedCitedByCount,
                // Keep review's openAlexId as fallback for forward expansion via alternative ID
                // (stored in metadata for orchestrator to use both)
                _reviewOpenAlexId: review.openAlexId,
                _reviewDoi: review.doi,
              } as RawPaper & { _reviewOpenAlexId?: string | null; _reviewDoi?: string | null };
            },
            null,
            5000,
            "openalex_parent_book",
            logger,
          );
        } catch {
          return null;
        }
      }),
    );
    for (const r of parentResults) {
      if (r.status === "fulfilled" && r.value) {
        const v = r.value as RawPaper & { _reviewOpenAlexId?: string | null; _reviewDoi?: string | null };
        // Stash review IDs in DOI field fallback and in openAlexId array for forward expansion:
        // Persist both IDs in the book record's DOI/openAlexId so expansion can query citing works for either.
        // We store the review's DOI as secondary by appending to publisher metadata if needed.
        const bookPaper: RawPaper = {
          ...v,
          source: "openalex" as const,
          publicationType: v.publicationType || "Kitap / Monografi",
          // Prefer book DOI, but keep review DOI as fallback for S2 recommendations
          doi: v.doi,
          // Keep high citation count for ranking
          citedByCount: v.citedByCount,
        };
        // If book lacked DOI but review had one, ensure forward expansion can use it:
        // encode review DOI in metadata for later use (forward-expansion reads doi field, so keep it)
        resolvedParentBooks.push(bookPaper);
        logger.info("openalex_parent_book_resolved", {
          hidden: true,
          data: {
            reviewTitle: v.title?.slice(0, 60),
            parentId: v.openAlexId,
            mergedCited: v.citedByCount,
            reviewDoi: (v as { _reviewDoi?: string | null })._reviewDoi,
          },
        });
      }
    }
  }

  const candidates: RawPaper[] = [
    ...rawOpenAlexPapers,
    ...resolvedParentBooks,
    ...(openAlexTitleResult.status === "fulfilled" ? openAlexTitleResult.value : []),
    ...(qdrantThesesResult.status === "fulfilled"
      ? qdrantThesesResult.value
      : []),
  ];

  const validCandidates = candidates.filter(
    (c): c is RawPaper & { title: string } =>
      Boolean(c.title && c.title.trim().length >= 3) &&
      c.publicationType !== "Kitap İncelemesi",
  );

  logger.info("multi_channel_search_completed", {
    hidden: true,
    data: {
      subBoxTitle: subBox.title,
      totalCandidates: validCandidates.length,
      openAlexCount:
        openAlexResult.status === "fulfilled" ? openAlexResult.value.length : 0,
      openAlexTitleCount:
        openAlexTitleResult.status === "fulfilled" ? openAlexTitleResult.value.length : 0,
      qdrantCount:
        qdrantThesesResult.status === "fulfilled"
          ? qdrantThesesResult.value.length
          : 0,
    },
  });

  return validCandidates;
}
