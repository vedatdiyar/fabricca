import type { Logger } from "@/lib/logger";
import type { RawPaper, SubBoxItem } from "../literature-review-papers";
import {
  searchOpenAlex,
  searchOpenAlexByTitleFilter,
  searchOpenAlexBooks,
} from "../openalex/client";
import { healAuthorsByTitle, normalizeHealedTitle } from "../openalex/openalex-healing";
import { searchTheses } from "@/core/services/thesis-search";

import {
  parseDualSemanticQuery,
  isBookReview,
  isNonResearchEvent,
} from "@/lib/academic/utils";

/**
 * Resolves fallback search phrases for OpenAlex `search` when structured queries are missing.
 * Uses sub-box concepts or title tokens, strictly avoiding arbitrary abstract paragraph slicing.
 *
 * @param subBox - Sub-box item metadata.
 * @returns Array of up to 3 focused keyword queries for OpenAlex.
 */
function resolveSearchPhrases(subBox: SubBoxItem): string[] {
  const parts: string[] = [];
  if (subBox.concepts && subBox.concepts.length > 0) {
    parts.push(subBox.concepts.slice(0, 3).join(" "));
  } else if (subBox.title) {
    parts.push(subBox.title);
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  const tokens = joined
    .split(/\s+/)
    .filter((t) => t.replace(/[^a-zA-Zçğıöşü]/g, "").length >= 4)
    .slice(0, 6)
    .join(" ");
  return tokens.length >= 3 ? [tokens] : [];
}

/** Maximum time to wait for any individual search provider before continuing. */
const PROVIDER_TIMEOUT_MS = 10000;

/**
 * Wraps a provider call with a real abort — timeout actually cancels the
 * underlying `fetch` socket so quota/server resources are not wasted.
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
        filePath:
          "src/app/(onboarding)/onboarding/literature-review/_services/orchestrator/multi-channel-search.ts",
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
 * 1a. OpenAlex Semantic (GTE Large EN 1024d server-side vector search, per_page=50, 1 req/s)
 * 1b. OpenAlex Lexical (Anchor + Focus keyword search, per_page=20, 100 req/s parallel)
 * 2. Qdrant (YOK National Thesis Center embeddings, EN semantic paragraph, limit=15)
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
  const { openAlexSemanticQuery, openAlexLexicalQueries } =
    parseDualSemanticQuery(subBox.semanticQuery);

  // Defense in depth: a non-English semantic paragraph must never reach
  // OpenAlex. Generation-time gates should already prevent this; if one
  // slips through, block the channel and surface it loudly instead of
  // sending Turkish text to the English search index.
  const semanticBlocked = /[çÇğĞıIöÖşŞüÜ]/.test(openAlexSemanticQuery);
  if (semanticBlocked) {
    logger.error("multi_channel_semantic_blocked_non_english", {
      data: { subBoxTitle: subBox.title },
    });
  }
  const safeSemanticQuery = semanticBlocked ? "" : openAlexSemanticQuery;

  logger.info("multi_channel_search_start", {
    hidden: true,
    data: {
      subBoxTitle: subBox.title,
      hasOpenAlexQuery: Boolean(safeSemanticQuery),
    },
  });

  const targetPhrases =
    openAlexLexicalQueries && openAlexLexicalQueries.length > 0
      ? openAlexLexicalQueries
      : resolveSearchPhrases(subBox);

  const [openAlexResult, openAlexTitleResult, qdrantThesesResult] =
    await Promise.allSettled([
      // 1a. OpenAlex semantic — GTE Large EN (1024d) server-side vector (per_page=50).
      (async (): Promise<RawPaper[]> => {
        if (!safeSemanticQuery || checkCancelled?.()) return [];
        try {
          const raw = await searchOpenAlex(safeSemanticQuery, 50, checkCancelled);
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

      // 1b. OpenAlex lexical search (100 req/s queue) — executes targeted Anchor + Focus queries
      // in parallel (per_page=20) to recover canonical books, monographs, and specific case literature.
      // Plus a dedicated book lane reusing the first two anchors with `filter=type:book`
      // ranked by citations, so monographs surface even when articles dominate relevance.
      (async (): Promise<RawPaper[]> => {
        if (targetPhrases.length === 0 || checkCancelled?.()) return [];
        try {
          const bookAnchors = targetPhrases.slice(0, 2);
          const [phraseResults, bookResults] = await Promise.all([
            Promise.all(
              targetPhrases.map((phrase) =>
                withProviderTimeout(
                  (signal) =>
                    searchOpenAlexByTitleFilter(
                      phrase,
                      20,
                      checkCancelled,
                      signal,
                    ),
                  [],
                  PROVIDER_TIMEOUT_MS,
                  "openalex_lexical_search",
                  logger,
                ),
              ),
            ),
            Promise.all(
              bookAnchors.map((phrase) =>
                withProviderTimeout(
                  (signal) =>
                    searchOpenAlexBooks(phrase, 10, checkCancelled, signal),
                  [],
                  PROVIDER_TIMEOUT_MS,
                  "openalex_book_lane",
                  logger,
                ),
              ),
            ),
          ]);
          const flattened = [...phraseResults.flat(), ...bookResults.flat()];
          return flattened.map((p) => ({
            ...p,
            source: "openalex" as const,
            publicationType: p.publicationType || "Makale",
          }));
        } catch (err) {
          logger.warn("multi_channel_openalex_lexical_failed", {
            error: err instanceof Error ? err.message : String(err),
            data: { subBoxTitle: subBox.title, targetPhrases },
          });
          return [];
        }
      })(),

      // 2. Qdrant — EN semantic paragraph → HF `multilingual-e5-base` 768d → Cosine (768/Cosine).
      // Isolated from OpenAlex GTE 1024d space. The semantic paragraph (not title:description)
      // feeds this lane: measured 2026-09-05, Box 217 query ranks Okudan 2014 thesis #6,
      // while the TR short query misses it outside top-30.
      (async (): Promise<RawPaper[]> => {
        if (!safeSemanticQuery || checkCancelled?.()) return [];
        try {
          const theses = await withProviderTimeout(
            (signal) =>
              searchTheses(
                safeSemanticQuery,
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

  // ── Parent-work resolution & healing for review proxies ──
  // Review-suspected entries often carry a canonical work's reception
  // (e.g. W654994107 review with 198 citations vs book entry with 2 citations).
  // Every reception-bearing candidate (>= 10 citations) enters resolution:
  // when a parent record is found, title/authors heal to the real work while the
  // most-cited record ID is preserved for forward citation expansion (`cites:W...`).
  // When no parent exists, the record itself is kept as proxy with healed
  // title/authors — nothing is ever dropped for carrying a review marker.
  const resolvedParentBooks: RawPaper[] = [];
  const rawReviewIdsReplaced = new Set<string>();

  const reviewCandidates = rawOpenAlexPapers
    .filter(
      (p) =>
        p.title &&
        (p.publicationType === "Kitap İncelemesi" ||
          isBookReview(p.title, p.abstract, p.authors)) &&
        !isNonResearchEvent(p.title) &&
        (p.citedByCount ?? 0) >= 10,
    )
    .sort((a, b) => (b.citedByCount ?? 0) - (a.citedByCount ?? 0));

  if (reviewCandidates.length > 0) {
    const parentResults = await Promise.allSettled(
      reviewCandidates.map(async (review) => {
        const rawTitle = review.title ?? "";
        // Strip common review prefixes and trailing dash-author suffix ("Title – Author").
        const cleanTitle = rawTitle
          .replace(
            /^(?:Book\s+)?Review(?:\s+of|\s+on|\s*:\s*|\s+essay\s*:\s*)/i,
            "",
          )
          .replace(
            /\s+[–—-]\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2}\s*$/,
            "",
          )
          .trim();
        const coreTitle = cleanTitle.split(":")[0]?.trim() || cleanTitle;
        const titleQuery = coreTitle.slice(0, 50).trim();
        if (!titleQuery || titleQuery.length < 5) return null;

        try {
          return await withProviderTimeout(
            async (signal) => {
              const { openAlexQueue, queryOpenAlexWorks } = await import(
                "../openalex/openalex-http"
              );
              const params = new URLSearchParams({
                search: `"${titleQuery}"`,
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

              const norm = (s: string) =>
                s.toLowerCase().replace(/[^a-z0-9]/g, "");
              const targetNorm = norm(titleQuery);
              const exact = res.find(
                (r) => r.title && norm(r.title).includes(targetNorm),
              );
              const chosen = exact ?? res[0];

              // Preserve the review's OpenAlex ID if it holds more citations
              // so forward expansion (`cites:W...`) discovers citing academic works.
              // The kept ID may belong to any record type; title/authors below are
              // always healed to the real work, so type never drives the outcome.
              const primaryId =
                review.openAlexId &&
                (review.citedByCount ?? 0) >= (chosen?.citedByCount ?? 0)
                  ? review.openAlexId
                  : chosen?.openAlexId ?? review.openAlexId;

              const maxCitations = Math.max(
                chosen?.citedByCount ?? 0,
                review.citedByCount ?? 0,
              );
              // When a parent book is resolved, its DOI is the canonical monograph DOI.
              // We do not drop it when forward citation expansion keeps the review ID.
              const mergedDoi = chosen?.doi ?? null;

              if (chosen) {
                const baseChosenTitle = normalizeHealedTitle(chosen.title || "");
                const cleanCore = cleanTitle.split(":")[0]?.trim().toLowerCase();
                const chosenCore = (chosen.title || "").split(":")[0]?.trim().toLowerCase();
                let healedTitle = baseChosenTitle || cleanTitle;
                if (
                  cleanTitle.includes(":") &&
                  !baseChosenTitle.includes(":") &&
                  cleanCore &&
                  chosenCore &&
                  (cleanCore === chosenCore ||
                    cleanCore.includes(chosenCore) ||
                    chosenCore.includes(cleanCore))
                ) {
                  healedTitle = normalizeHealedTitle(cleanTitle);
                }

                const healedAuthors =
                  chosen.authors && chosen.authors.length > 0
                    ? chosen.authors
                    : review.authors;
                return {
                  ...chosen,
                  source: "openalex" as const,
                  openAlexId: primaryId,
                  publicationType: "Kitap / Monografi",
                  authors:
                    healedAuthors.length > 0
                      ? healedAuthors
                      : await healAuthorsByTitle(healedTitle),
                  title: healedTitle,
                  doi: mergedDoi,
                  citedByCount: maxCitations,
                  _rawReviewId: review.openAlexId,
                } as RawPaper & { _rawReviewId?: string | null };
              }

              // In-place healing if parent book record is not separately indexed
              const healedTitle = normalizeHealedTitle(cleanTitle);
              const healedAuthors = await healAuthorsByTitle(healedTitle);
              return {
                ...review,
                source: "openalex" as const,
                openAlexId: review.openAlexId,
                publicationType: "Kitap / Monografi",
                authors:
                  healedAuthors.length > 0 ? healedAuthors : review.authors,
                title: healedTitle || cleanTitle,
                doi: null,
                citedByCount: maxCitations,
                _rawReviewId: review.openAlexId,
              } as RawPaper & { _rawReviewId?: string | null };
            },
            null,
            PROVIDER_TIMEOUT_MS,
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
        const v = r.value as RawPaper & { _rawReviewId?: string | null };
        if (v._rawReviewId) {
          rawReviewIdsReplaced.add(v._rawReviewId);
        }
        resolvedParentBooks.push(v);
        logger.info("openalex_parent_book_resolved", {
          hidden: true,
          data: {
            resolvedTitle: v.title?.slice(0, 60),
            openAlexId: v.openAlexId,
            mergedCitations: v.citedByCount,
            authors: v.authors,
          },
        });
      }
    }
  }

  const candidates: RawPaper[] = [
    ...rawOpenAlexPapers.filter(
      (p) => !p.openAlexId || !rawReviewIdsReplaced.has(p.openAlexId),
    ),
    ...resolvedParentBooks,
    ...(openAlexTitleResult.status === "fulfilled"
      ? openAlexTitleResult.value
      : []),
    ...(qdrantThesesResult.status === "fulfilled"
      ? qdrantThesesResult.value
      : []),
  ];

  const validCandidates = candidates.filter(
    (c): c is RawPaper & { title: string } =>
      Boolean(c.title && c.title.trim().length >= 3) &&
      // Review-suspected records are never dropped by type: reception-bearing
      // proxies (>= 10 citations) flow downstream where title/authors are healed
      // and content decides. Only low-signal review noise is skipped here.
      (!isBookReview(c.title, c.abstract, c.authors) ||
        (c.citedByCount ?? 0) >= 10) &&
      !isNonResearchEvent(c.title),
  );

  logger.info("multi_channel_search_completed", {
    hidden: true,
    data: {
      subBoxTitle: subBox.title,
      totalCandidates: validCandidates.length,
      openAlexCount:
        openAlexResult.status === "fulfilled" ? openAlexResult.value.length : 0,
      openAlexTitleCount:
        openAlexTitleResult.status === "fulfilled"
          ? openAlexTitleResult.value.length
          : 0,
      qdrantCount:
        qdrantThesesResult.status === "fulfilled"
          ? qdrantThesesResult.value.length
          : 0,
    },
  });

  return validCandidates;
}
