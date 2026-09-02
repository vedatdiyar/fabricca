import type { Logger } from "@/lib/logger";
import type { RawPaper, SubBoxItem } from "../literature-review-papers";
import { searchOpenAlex } from "../openalex/client";
import { searchSemanticScholarPapers } from "@/core/services/semantic-scholar/semantic-scholar-search";
import { searchTheses } from "@/core/services/thesis-search";

import { parseDualSemanticQuery } from "@/lib/academic/utils";

/** Maximum time to wait for any individual search provider before continuing. */
const PROVIDER_TIMEOUT_MS = 35000;

/**
 * Wraps a promise with a timeout so a slow provider never hangs the whole pipeline.
 *
 * @param promise - The async operation to wrap.
 * @param timeoutMs - Maximum duration in milliseconds.
 * @param fallbackValue - Value to return when timeout expires.
 * @returns The resolved promise value or the fallback value.
 */
async function withProviderTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ]);
}

/**
 * Executes a 3-channel parallel search across:
 * 1. OpenAlex (Global scholarly works, semantic vector search)
 * 2. Semantic Scholar (Influential and highly cited papers)
 * 3. Qdrant (YÖK National Thesis Center embeddings)
 *
 * @param subBox - The sub-box item containing title, description, and semanticQuery.
 * @param logger - Shared pipeline logger.
 * @param checkCancelled - Optional cancellation check callback.
 * @returns Unified array of RawPaper candidates across all 3 channels.
 */
export async function searchMultiChannelForSubBox(
  subBox: SubBoxItem,
  logger: Logger,
  checkCancelled?: () => boolean,
): Promise<RawPaper[]> {
  const { openAlexQuery, semanticScholarQuery } = parseDualSemanticQuery(
    subBox.semanticQuery,
  );
  const turkishQuery = `${subBox.title}: ${subBox.description}`.trim();

  logger.info("multi_channel_search_start", {
    hidden: true,
    data: {
      subBoxTitle: subBox.title,
      hasOpenAlexQuery: Boolean(openAlexQuery),
      hasSemanticScholarQuery: Boolean(semanticScholarQuery),
      hasTurkishQuery: Boolean(turkishQuery),
    },
  });

  const [openAlexResult, semanticScholarResult, qdrantThesesResult] =
    await Promise.allSettled([
      // 1. OpenAlex (Global academic literature - GTE-Large-EN semantic search)
      (async (): Promise<RawPaper[]> => {
        if (!openAlexQuery || checkCancelled?.()) return [];
        try {
          const raw = await withProviderTimeout(
            searchOpenAlex(openAlexQuery, 35, checkCancelled),
            PROVIDER_TIMEOUT_MS,
            [],
          );
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

      // 2. Semantic Scholar (Influential global papers - focused keyword/phrase search)
      (async (): Promise<RawPaper[]> => {
        const s2Query =
          semanticScholarQuery ||
          `${subBox.title} ${subBox.concepts?.join(" ") ?? ""}`.trim();
        if (!s2Query || checkCancelled?.()) return [];
        try {
          const papers = await withProviderTimeout(
            searchSemanticScholarPapers(s2Query, 25),
            PROVIDER_TIMEOUT_MS,
            [],
          );

          return papers.map((p): RawPaper => {
            const authors = (p.authors ?? [])
              .map((a) => a.name)
              .filter((n): n is string => Boolean(n));

            const doi = p.externalIds?.DOI ?? null;
            const url = p.url || (doi ? `https://doi.org/${doi}` : null);

            const isBook = (p.publicationTypes ?? []).includes("Book");
            const isSection = (p.publicationTypes ?? []).includes(
              "BookSection",
            );
            const pubType = isBook
              ? "Kitap / Monografi"
              : isSection
                ? "Kitap Bölümü"
                : "Makale";

            return {
              source: "semantic_scholar",
              title: p.title,
              abstract: p.abstract || null,
              metadata: p.venue || null,
              doi,
              authors,
              year: p.year ?? null,
              publisher: p.venue || null,
              openAlexId: null,
              relevanceScore: 0.85,
              citedByCount: p.citationCount ?? 0,
              url,
              publicationType: pubType,
            };
          });
        } catch (err) {
          logger.warn("multi_channel_semantic_scholar_failed", {
            error: err instanceof Error ? err.message : String(err),
            data: { subBoxTitle: subBox.title },
          });
          return [];
        }
      })(),

      // 3. Qdrant (YÖK Ulusal Tez Havuzu embeddings)
      (async (): Promise<RawPaper[]> => {
        if (!turkishQuery || checkCancelled?.()) return [];
        try {
          const theses = await withProviderTimeout(
            searchTheses(turkishQuery, logger, {
              limit: 15,
              rankingScoreThreshold: 0.7,
              silent: true,
            }),
            PROVIDER_TIMEOUT_MS,
            [],
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

  const candidates: RawPaper[] = [
    ...(openAlexResult.status === "fulfilled" ? openAlexResult.value : []),
    ...(semanticScholarResult.status === "fulfilled"
      ? semanticScholarResult.value
      : []),
    ...(qdrantThesesResult.status === "fulfilled"
      ? qdrantThesesResult.value
      : []),
  ];

  const validCandidates = candidates.filter(
    (c): c is RawPaper & { title: string } =>
      Boolean(c.title && c.title.trim().length >= 3),
  );

  logger.info("multi_channel_search_completed", {
    hidden: true,
    data: {
      subBoxTitle: subBox.title,
      totalCandidates: validCandidates.length,
      openAlexCount:
        openAlexResult.status === "fulfilled" ? openAlexResult.value.length : 0,
      semanticScholarCount:
        semanticScholarResult.status === "fulfilled"
          ? semanticScholarResult.value.length
          : 0,
      qdrantCount:
        qdrantThesesResult.status === "fulfilled"
          ? qdrantThesesResult.value.length
          : 0,
    },
  });

  return validCandidates;
}
