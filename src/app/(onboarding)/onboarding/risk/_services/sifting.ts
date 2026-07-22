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
// Extraction 2: Cohere rerank + Top-N ranking selection
// ──────────────────────────────────────────────

/** Minimal relevance floor to eliminate complete zero-correlation noise before ranking selection. */
const MIN_RELEVANCE_FLOOR = 0.3;

/** Maximum number of candidate theses passing Cohere reranking to avoid hitting Gemini rate limits (15 RPM). */
const COHERE_MAX_LIMIT = 24;

export type SiftAndFetchDetailsParams = ThesisMatrix;

/**
 * Runs Cohere Rerank v4 Pro on validated thesis abstracts and returns the IDs
 * of the top ranked theses (up to COHERE_MAX_LIMIT = 24), sorted by descending relevance.
 *
 * @param params - The thesis matrix used as the rerank query fallback.
 * @param validDetails - Theses with valid abstracts to rerank.
 * @param log - Logger instance.
 * @param cohereSemanticTarget - Optional 1-sentence compressed semantic target.
 * @returns Array of top thesis IDs for jury analysis.
 */
async function rerankAndSelectTheses(
  params: SiftAndFetchDetailsParams,
  validDetails: TezaraThesisDetails[],
  log: Logger,
  cohereSemanticTarget?: string,
): Promise<number[]> {
  try {
    const query = formatRerankQuery(params, cohereSemanticTarget);
    const documents = formatRerankDocuments(validDetails);

    const { results } = await rerankTheses(query, documents, log);

    if (results.length === 0) {
      return [];
    }

    // Filter out complete noise (< 0.30) and take the top N highest-ranked candidates
    const passing = results.filter(
      (r) => r.relevanceScore >= MIN_RELEVANCE_FLOOR,
    );
    const capped = passing.slice(0, COHERE_MAX_LIMIT);

    log.data("Rerank Top-N Selection Filter", {
      totalInput: results.length,
      aboveFloor: passing.length,
      selectedTopN: capped.length,
      limit: COHERE_MAX_LIMIT,
      queryLength: query.length,
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
 * v4 Pro ile puanlar ve relevanceScore >= 0.75 olan tezleri döndürür.
 *
 * Akış: dedup → abstract filter → Cohere rerank (via cohereSemanticTarget) → score ≥ 0.75
 */
export async function siftAndFetchDetails(
  params: SiftAndFetchDetailsParams,
  tezaraSearchResults: TezaraThesisDetails[][],
  log: Logger,
  cohereSemanticTarget?: string,
): Promise<{
  finalTheses: TezaraThesisDetails[];
  eliminatedTheses: TezaraThesisDetails[];
}> {
  const { validDetails, eliminatedTheses: abstractEliminated } =
    deduplicateSiftingResults(tezaraSearchResults, log);

  if (validDetails.length === 0) {
    return {
      finalTheses: [],
      eliminatedTheses: abstractEliminated,
    };
  }

  log.info("cohere_rerank_start", {
    service: "originality",
    data: {
      count: validDetails.length,
      context: params.researchCore,
      cohereSemanticTarget,
    },
  });

  try {
    const topIds = await rerankAndSelectTheses(
      params,
      validDetails,
      log,
      cohereSemanticTarget,
    );

    const detailMap = new Map(validDetails.map((t) => [t.id, t]));
    const finalTheses = topIds
      .map((id) => detailMap.get(id))
      .filter((t): t is TezaraThesisDetails => t !== undefined);
    const selectedIds = new Set(topIds);
    const eliminatedFromRerank = validDetails.filter(
      (t) => !selectedIds.has(t.id),
    );
    const allEliminated = [...abstractEliminated, ...eliminatedFromRerank];

    log.info("cohere_rerank_success", {
      service: "originality",
      data: {
        finalCount: finalTheses.length,
        eliminatedCount: allEliminated.length,
      },
    });

    return {
      finalTheses,
      eliminatedTheses: allEliminated,
    };
  } catch (err) {
    log.error("cohere_rerank_failed", {
      service: "originality",
      error: err,
      data: { context: params.researchCore },
    });
    throw err;
  }
}
