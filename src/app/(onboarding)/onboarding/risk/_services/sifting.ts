import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails, ThesisMatrix } from "@/lib/types";
import {
  rerankTheses,
  formatRerankQuery,
  formatRerankDocuments,
} from "@/lib/services/cohere";

// ──────────────────────────────────────────────
// Extraction 1: Deduplike et + abstract filtresi + ID bazlı sırala
// ──────────────────────────────────────────────
function normaliseField(value: string): string {
  return value.trim().replace(/\s{2,}/g, " ");
}

function deduplicateSiftingResults(
  tezaraSearchResults: TezaraThesisDetails[][],
  log: Logger,
): {
  validDetails: TezaraThesisDetails[];
  eliminatedTheses: TezaraThesisDetails[];
  rawCount: number;
} {
  const uniqueMap = new Map<number, TezaraThesisDetails>();
  let rawCount = 0;

  for (const list of tezaraSearchResults) {
    if (Array.isArray(list)) {
      rawCount += list.length;
      for (const t of list) {
        if (!t || typeof t.id !== "number") continue;

        // Arapça başlıklı tezleri ele
        if (/[\u0600-\u06FF]/.test(t.title)) continue;

        // Sadece Türkçe ve İngilizce tezleri kabul et
        if (t.language && t.language !== "Türkçe" && t.language !== "İngilizce")
          continue;

        if (!uniqueMap.has(t.id)) {
          uniqueMap.set(t.id, t);
        } else {
          const existing = uniqueMap.get(t.id)!;
          const existingNorm = normaliseField(existing.title);
          const incomingNorm = normaliseField(t.title);
          if (incomingNorm.localeCompare(existingNorm) < 0) {
            uniqueMap.set(t.id, t);
          }
        }
      }
    }
  }

  const uniqueTheses = Array.from(uniqueMap.values()).sort(
    (a, b) => a.id - b.id,
  );

  // Abstract filtresi: abstract'ı olmayan veya <50 karakter olan tezleri ele
  const validDetails: TezaraThesisDetails[] = [];
  const eliminatedTheses: TezaraThesisDetails[] = [];

  for (const t of uniqueTheses) {
    if (!t.abstract || t.abstract.length < 50) {
      eliminatedTheses.push(t);
    } else {
      validDetails.push(t);
    }
  }

  log.data("Raw/Unique/Valid Thesis Count", {
    rawCount,
    uniqueCount: uniqueTheses.length,
    validCount: validDetails.length,
    eliminatedCount: eliminatedTheses.length,
  });

  return { validDetails, eliminatedTheses, rawCount };
}

// ──────────────────────────────────────────────
// Extraction 2: Cohere rerank + strict score >= 0.80 filter
// ──────────────────────────────────────────────

/** Minimum Cohere relevance score required for a thesis to pass to jury analysis. */
const RELEVANCE_SCORE_THRESHOLD = 0.8;

/** Maximum number of candidate theses passing Cohere reranking to avoid hitting API limitations. */
const COHERE_MAX_LIMIT = 45;

export type SiftAndFetchDetailsParams = ThesisMatrix;

/**
 * Runs Cohere Rerank v4 Pro on validated thesis abstracts and returns the IDs
 * of those that meet or exceed the relevance threshold, capped at a maximum limit.
 *
 * @param params - The thesis matrix used as the rerank query.
 * @param validDetails - Theses with valid abstracts to rerank.
 * @param log - Logger instance.
 * @returns Array of thesis IDs with relevanceScore >= 0.80.
 */
async function rerankAndSelectTheses(
  params: SiftAndFetchDetailsParams,
  validDetails: TezaraThesisDetails[],
  log: Logger,
): Promise<number[]> {
  try {
    const query = formatRerankQuery(params);
    const documents = formatRerankDocuments(validDetails);

    const { results } = await rerankTheses(query, documents, log);

    if (results.length === 0) {
      return [];
    }

    const passing = results.filter(
      (r) => r.relevanceScore >= RELEVANCE_SCORE_THRESHOLD,
    );

    // Apply the Cohere limit cap (e.g. 45 for BATCH_SIZE = 3)
    const capped = passing.slice(0, COHERE_MAX_LIMIT);

    log.data("Rerank threshold filter", {
      total: results.length,
      passing: passing.length,
      capped: capped.length,
      threshold: RELEVANCE_SCORE_THRESHOLD,
      limit: COHERE_MAX_LIMIT,
    });

    return capped.map((r) => validDetails[r.index].id);
  } catch (err) {
    log.error("originality_sift_cohere_failed", {
      service: "originality",
      error: err,
      data: { context: params.researchCore },
    });
    throw err;
  }
}

/**
 * Deduplicates search results (abstract'lar zaten searchTezara'dan geldiği
 * için ayrı bir fetch gerekmez), abstract filtresi uygular, Cohere Rerank
 * v4 Pro ile puanlar ve relevanceScore >= 0.80 olan tezleri döndürür.
 *
 * Akış: dedup → abstract filter → Cohere rerank → score ≥ 0.80
 */
export async function siftAndFetchDetails(
  params: SiftAndFetchDetailsParams,
  tezaraSearchResults: TezaraThesisDetails[][],
  log: Logger,
): Promise<{
  finalTheses: TezaraThesisDetails[];
  eliminatedTheses: TezaraThesisDetails[];
}> {
  log.file("sifting.ts");
  const functionStart = performance.now();
  log.groupStart("originality_sift");

  const { validDetails, eliminatedTheses: abstractEliminated } =
    deduplicateSiftingResults(tezaraSearchResults, log);

  if (validDetails.length === 0) {
    log.groupEnd("originality_sift", performance.now() - functionStart);
    return {
      finalTheses: [],
      eliminatedTheses: abstractEliminated,
    };
  }

  try {
    const topIds = await rerankAndSelectTheses(params, validDetails, log);

    const selectedIds = new Set(topIds);
    const finalTheses = validDetails.filter((t) => selectedIds.has(t.id));
    const eliminatedFromRerank = validDetails.filter(
      (t) => !selectedIds.has(t.id),
    );
    const allEliminated = [...abstractEliminated, ...eliminatedFromRerank];

    log.preview(
      "Final Thesis IDs (Cohere selected → jury)",
      finalTheses.map((t) => ({ id: t.id, title: t.title })),
    );

    log.groupEnd("originality_sift", performance.now() - functionStart);

    return {
      finalTheses,
      eliminatedTheses: allEliminated,
    };
  } catch (err) {
    const durationMs = performance.now() - functionStart;
    log.error("originality_sift_failed", {
      service: "originality",
      error: err,
      durationMs,
      data: { context: params.researchCore },
    });
    log.groupEnd("originality_sift", durationMs);
    throw err;
  }
}
