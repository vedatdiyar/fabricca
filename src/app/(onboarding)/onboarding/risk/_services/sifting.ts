import { withRetry } from "@/lib/api-utils";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import { fetchThesisDetails } from "@/lib/tezara";
import type { Logger } from "@/lib/logger";
import type {
  TezaraThesisSummary,
  TezaraThesisDetails,
  ThesisMatrix,
} from "@/lib/types";
import {
  rerankTheses,
  formatRerankQuery,
  formatRerankDocuments,
} from "@/lib/services/cohere";

const MAX_ATTEMPTS = 4;

/**
 * Tezara'dan tez detaylarını withRetry ile jittered exponential backoff
 * kullanarak çeker. withRetry, projenin merkezi api-utils.ts'de tanımlıdır.
 * Detaylar null dönerse veya tüm denemeler tükenirse hata fırlatır.
 */
async function fetchDetailsWithRetry(
  thesis: TezaraThesisSummary,
  log: Logger,
): Promise<TezaraThesisDetails> {
  return withRetry<TezaraThesisDetails>(
    async () => {
      const details = await fetchThesisDetails(thesis, log);
      if (!details) {
        throw new Error("Could not fetch thesis details (returned null).");
      }
      return details;
    },
    {
      maxRetries: MAX_ATTEMPTS,
      baseDelay: 1000,
      isRetryable: () => true,
      onRetry: (attempt, _delay, err) => {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn("originality_fetch_details_attempt_failed", {
          service: "originality",
          data: {
            thesisId: thesis.id,
            attempt,
            maxAttempts: MAX_ATTEMPTS,
          },
          error: `[ID: ${thesis.id}] ${msg}`,
        });
      },
    },
  );
}

export type SiftAndFetchDetailsParams = ThesisMatrix;

// ──────────────────────────────────────────────
// Extraction 1: Deduplike et + ID bazlı sırala
// ──────────────────────────────────────────────
function normaliseField(value: string): string {
  return value.trim().replace(/\s{2,}/g, " ");
}

function deduplicateSiftingResults(
  tezaraSearchResults: TezaraThesisSummary[][],
  log: Logger,
): { uniqueTheses: TezaraThesisSummary[]; rawCount: number } {
  const uniqueThesesMap = new Map<number, TezaraThesisSummary>();
  let rawCount = 0;
  for (const list of tezaraSearchResults) {
    if (Array.isArray(list)) {
      rawCount += list.length;
      for (const t of list) {
        if (!t || typeof t.id !== "number") continue;

        if (/[\u0600-\u06FF]/.test(t.title)) continue;

        if (!uniqueThesesMap.has(t.id)) {
          uniqueThesesMap.set(t.id, t);
        } else {
          const existing = uniqueThesesMap.get(t.id)!;
          const existingNorm = normaliseField(existing.title);
          const incomingNorm = normaliseField(t.title);
          if (incomingNorm.localeCompare(existingNorm) < 0) {
            uniqueThesesMap.set(t.id, t);
          }
        }
      }
    }
  }

  const uniqueTheses = Array.from(uniqueThesesMap.values()).sort(
    (a, b) => a.id - b.id,
  );

  log.data("Raw/Unique Thesis Count", {
    rawCount,
    uniqueCount: uniqueTheses.length,
  });

  return { uniqueTheses, rawCount };
}

// ──────────────────────────────────────────────
// Extraction 2: Cohere rerank + top-N seç
// ──────────────────────────────────────────────
async function rerankAndSelectTheses(
  params: SiftAndFetchDetailsParams,
  uniqueTheses: TezaraThesisSummary[],
  log: Logger,
): Promise<number[]> {
  log.info("originality_sift_cohere_start", {
    service: "originality",
    data: {
      count: uniqueTheses.length,
      context: params.researchFocus,
    },
  });

  try {
    uniqueTheses.sort((a, b) => a.id - b.id);

    const query = formatRerankQuery(params);
    const documents = formatRerankDocuments(uniqueTheses);

    const { results } = await rerankTheses(query, documents, log);

    if (results.length === 0) {
      log.warn("originality_sift_cohere_empty", {
        service: "originality",
        data: { count: uniqueTheses.length, context: params.researchFocus },
      });
      return [];
    }

    const topN = Math.min(20, results.length);
    const topResults = results.slice(0, topN);

    return topResults.map((r) => uniqueTheses[r.index].id);
  } catch (err) {
    log.error("originality_sift_cohere_failed", {
      service: "originality",
      error: err,
      data: { context: params.researchFocus },
    });
    throw err;
  }
}

// ──────────────────────────────────────────────
// Extraction 3: Seçilen tezlerin detaylarını çek
// ──────────────────────────────────────────────
async function fetchSiftedThesisDetails(
  topIds: number[],
  uniqueTheses: TezaraThesisSummary[],
  log: Logger,
): Promise<{
  validDetails: TezaraThesisDetails[];
  fetchFailed: number;
  failedTheses: TezaraThesisSummary[];
  passedStage1: TezaraThesisSummary[];
}> {
  const fetchStart = performance.now();

  const selectedThesesMap = new Map<number, TezaraThesisSummary>();
  for (const id of topIds) {
    const thesis = uniqueTheses.find((t) => t.id === id);
    if (thesis) {
      selectedThesesMap.set(id, thesis);
    }
  }
  const passedStage1 = Array.from(selectedThesesMap.values());

  log.info("originality_sift_cohere_success", {
    service: "originality",
    durationMs: performance.now() - fetchStart,
    data: {
      count: passedStage1.length,
    },
  });

  log.info("originality_sift_fetch_start", {
    service: "originality",
    data: {
      count: passedStage1.length,
    },
  });

  const limiter = createConcurrencyLimiter(3);

  const results = await Promise.allSettled(
    passedStage1.map((thesis) =>
      limiter.exec(() => fetchDetailsWithRetry(thesis, log)),
    ),
  );

  const validDetails: TezaraThesisDetails[] = [];
  const failedTheses: TezaraThesisSummary[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const thesis = passedStage1[i];
    if (result.status === "fulfilled") {
      validDetails.push(result.value);
    } else {
      failedTheses.push(thesis);
      log.warn("originality_fetch_details_attempt_failed", {
        service: "originality",
        data: { thesisId: thesis.id },
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }

  const fetchFailed = failedTheses.length;

  if (fetchFailed > 0) {
    log.warn("originality_fetch_details_failed_final", {
      service: "originality",
      data: {
        failedCount: fetchFailed,
        failedIds: failedTheses.map((t) => ({ id: t.id, author: t.author })),
      },
    });
  }

  // Sort by ID to ensure a deterministic order despite the random shuffle used for parallel fetching
  validDetails.sort((a, b) => a.id - b.id);

  log.info("originality_sift_fetch_success", {
    service: "originality",
    durationMs: performance.now() - fetchStart,
    data: {
      count: validDetails.length,
      failedCount: fetchFailed,
    },
  });

  return { validDetails, fetchFailed, failedTheses, passedStage1 };
}

// ──────────────────────────────────────────────
// Extraction 4: Sonuç yapısını oluştur
// ──────────────────────────────────────────────
function buildSiftingResult(
  uniqueTheses: TezaraThesisSummary[],
  topIds: number[],
  passedStage1: TezaraThesisSummary[],
  validDetails: TezaraThesisDetails[],
  fetchFailed: number,
  log: Logger,
): {
  finalTheses: TezaraThesisDetails[];
  eliminatedTheses: TezaraThesisSummary[];
} {
  if (validDetails.length === 0) {
    return {
      finalTheses: [],
      eliminatedTheses: uniqueTheses,
    };
  }

  const passedStage1Ids = new Set(passedStage1.map((t) => t.id));
  const eliminatedTheses = uniqueTheses.filter(
    (t) => !passedStage1Ids.has(t.id),
  );

  log.preview(
    "Final Thesis IDs (Cohere selected → jury)",
    validDetails.map((t) => ({ id: t.id, title: t.title })),
  );

  return {
    finalTheses: validDetails,
    eliminatedTheses,
  };
}

/**
 * Deduplicates search results, scores relevance via Cohere Rerank v4 Pro,
 * selects top 20, fetches full thesis details, and returns all valid
 * theses for jury analysis.
 *
 * Artık 4 yardımcı fonksiyona bölünmüş temiz bir orkestratördür.
 */
export async function siftAndFetchDetails(
  params: SiftAndFetchDetailsParams,
  tezaraSearchResults: TezaraThesisSummary[][],
  log: Logger,
): Promise<{
  finalTheses: TezaraThesisDetails[];
  eliminatedTheses: TezaraThesisSummary[];
}> {
  log.file("sifting.ts");
  const functionStart = performance.now();
  log.groupStart("originality_sift");

  // Adım 1: Deduplike et
  const { uniqueTheses } = deduplicateSiftingResults(tezaraSearchResults, log);

  // Early return: hiç tez yoksa boş dön
  if (uniqueTheses.length === 0) {
    log.groupEnd("originality_sift", 0);
    return {
      finalTheses: [],
      eliminatedTheses: [],
    };
  }

  try {
    // Adım 2: Cohere rerank + seç
    const topIds = await rerankAndSelectTheses(params, uniqueTheses, log);

    // Adım 3: Detayları çek
    const { validDetails, fetchFailed, passedStage1 } =
      await fetchSiftedThesisDetails(topIds, uniqueTheses, log);

    // Adım 4: Sonucu yapılandır
    const result = buildSiftingResult(
      uniqueTheses,
      topIds,
      passedStage1,
      validDetails,
      fetchFailed,
      log,
    );

    log.groupEnd("originality_sift", performance.now() - functionStart);

    return result;
  } catch (err) {
    const durationMs = performance.now() - functionStart;
    log.error("originality_sift_failed", {
      service: "originality",
      error: err,
      durationMs,
      data: { context: params.researchFocus },
    });
    log.groupEnd("originality_sift", durationMs);
    throw err;
  }
}
