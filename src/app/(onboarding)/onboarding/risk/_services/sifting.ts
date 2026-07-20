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

        if (t.language && t.language !== "Türkçe" && t.language !== "İngilizce")
          continue;

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
// Extraction 2: Tüm tezlerin abstractlarını paralel çek (C=12 queue ile)
// ──────────────────────────────────────────────
async function fetchAllAbstracts(
  theses: TezaraThesisSummary[],
  log: Logger,
): Promise<{
  validDetails: TezaraThesisDetails[];
  eliminatedTheses: TezaraThesisSummary[];
}> {
  const results = await Promise.allSettled(
    theses.map((thesis) => fetchThesisDetails(thesis, log)),
  );

  const validDetails: TezaraThesisDetails[] = [];
  const eliminatedTheses: TezaraThesisSummary[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const thesis = theses[i];

    if (result.status === "fulfilled" && result.value) {
      const details = result.value;
      if (!details.abstract || details.abstract.length < 50) {
        eliminatedTheses.push(thesis);
        continue;
      }
      validDetails.push(details);
    } else {
      eliminatedTheses.push(thesis);
    }
  }

  validDetails.sort((a, b) => a.id - b.id);

  return { validDetails, eliminatedTheses };
}

// ──────────────────────────────────────────────
// Extraction 3: Cohere rerank + strict score >= 0.80 filter
// ──────────────────────────────────────────────

/** Minimum Cohere relevance score required for a thesis to pass to jury analysis. */
const RELEVANCE_SCORE_THRESHOLD = 0.8;

export type SiftAndFetchDetailsParams = ThesisMatrix;

/**
 * Runs Cohere Rerank v4 Pro on validated thesis abstracts and returns the IDs
 * of those that meet or exceed the relevance threshold. No artificial caps applied.
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

    // Strict threshold — no min/max caps; yield exactly what the model deems relevant
    const passing = results.filter(
      (r) => r.relevanceScore >= RELEVANCE_SCORE_THRESHOLD,
    );

    log.data("Rerank threshold filter", {
      total: results.length,
      passing: passing.length,
      threshold: RELEVANCE_SCORE_THRESHOLD,
    });

    return passing.map((r) => validDetails[r.index].id);
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
 * Deduplicates search results, fetches all abstracts (via detailsCache — instant),
 * scores relevance via Cohere Rerank v4 Pro, and returns every thesis with
 * relevanceScore >= 0.80. No artificial min or max caps applied.
 *
 * Tekil akış: dedup → fetchAllAbstracts → abstract-aware rerank → score ≥ 0.80
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

  if (uniqueTheses.length === 0) {
    log.groupEnd("originality_sift", 0);
    return {
      finalTheses: [],
      eliminatedTheses: [],
    };
  }

  try {
    // Adım 2: Tüm tezlerin abstractlarını paralel çek
    const { validDetails, eliminatedTheses: abstractEliminated } =
      await fetchAllAbstracts(uniqueTheses, log);

    if (validDetails.length === 0) {
      log.groupEnd("originality_sift", performance.now() - functionStart);
      return {
        finalTheses: [],
        eliminatedTheses: uniqueTheses,
      };
    }

    // Adım 3: Abstract-aware Cohere rerank → score >= 0.80
    const topIds = await rerankAndSelectTheses(params, validDetails, log);

    // Adım 4: Sonuç yapısını oluştur
    const selectedIds = new Set(topIds);
    const finalTheses = validDetails.filter((t) => selectedIds.has(t.id));
    const eliminatedFromRerank: TezaraThesisSummary[] = validDetails
      .filter((t) => !selectedIds.has(t.id))
      .map((t) => ({
        id: t.id,
        title: t.title,
        author: t.author,
        university: t.university,
        year: t.year,
        thesisType: t.thesisType,
        department: t.department,
      }));

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
