import type { Logger } from "@/lib/logger";
import type { RawPaper, SubBoxItem } from "../literature-review-papers";
import { searchOpenAlex } from "../openalex/client";
import { searchSemanticScholarPapers } from "@/core/services/semantic-scholar/semantic-scholar-search";
import { searchTheses } from "@/core/services/thesis-search";

import { parseDualSemanticQuery } from "@/lib/academic/utils";

/** Maximum time to wait for any individual search provider before continuing. */
const PROVIDER_TIMEOUT_MS = 35000;

/**
 * Wraps a provider call with a real abort — timeout actually cancels the
 * underlying `fetch` socket so quota/server resources are not wasted.
 * Previously this was a `Promise.race` that leaked the fetch.
 *
 * @param providerFn - Function receiving an AbortSignal; must forward `signal` to fetch.
 * @param fallbackValue - Value returned on timeout/abort.
 * @param timeoutMs - Timeout in ms (timer starts when this wrapper is entered).
 * @param providerName - Log label (e.g. "semantic_scholar", "qdrant", "openalex").
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
      // 1. OpenAlex — text → server-side GTE Large EN (1024d). No local vector enters this channel.
      // Turnstile pacing (1050 ms) + 35 s execution timeout are isolated inside openalex-http
      // (queue wait does NOT consume the timeout). Each sub-box keeps its own query.
      (async (): Promise<RawPaper[]> => {
        if (!openAlexQuery || checkCancelled?.()) return [];
        try {
          const raw = await searchOpenAlex(openAlexQuery, 35, checkCancelled);
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

      // 2. Semantic Scholar — 1 req/s turnstile (1050 ms, concurrency 1, 60 RPM).
      // Execution timeout (35 s via withProviderTimeout + 20 s internal) is isolated
      // inside s2SearchQueue: AbortSignal starts AFTER dequeue so 8 sub-box queue
      // wait (~7 s) does NOT consume the provider budget. Signal aborts socket.
      (async (): Promise<RawPaper[]> => {
        const s2Query =
          semanticScholarQuery ||
          `${subBox.title} ${subBox.concepts?.join(" ") ?? ""}`.trim();
        if (!s2Query || checkCancelled?.()) return [];
        try {
          const papers = await withProviderTimeout(
            (signal) => searchSemanticScholarPapers(s2Query, 25, signal),
            [],
            PROVIDER_TIMEOUT_MS,
            "semantic_scholar",
            logger,
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

      // 3. Qdrant — text → HF `multilingual-e5-base` 768d → Cosine (768/Cosine). Isolated from OpenAlex GTE 1024d space.
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
