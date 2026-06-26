import { fetchThesisDetails } from "@/lib/tezara";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisSummary, TezaraThesisDetails } from "@/lib/types";
import { rerankTheses } from "@/lib/cohere";

export interface SiftAndFetchDetailsParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}

export interface SiftingDiagnostic {
  uniqueAfterDedup: number;
  topIds: number[];
  stage1Count: number;
  fetchRequested: number;
  fetchSuccess: number;
  fetchFailed: number;
}

/**
 * Deduplicates search results, scores relevance via Cohere Rerank v4 Pro,
 * selects top 20, fetches full thesis details, and returns all valid
 * theses for jury analysis.
 *
 * @param params - Target thesis parameters.
 * @param tezaraSearchResults - Parallel search results from Tezara containing candidates.
 * @param log - Logger instance.
 * @returns Object containing finalTheses (all Cohere-selected theses with valid details) and diagnostic info.
 */
export async function siftAndFetchDetails(
  params: SiftAndFetchDetailsParams,
  tezaraSearchResults: TezaraThesisSummary[][],
  log: Logger,
): Promise<{
  finalTheses: TezaraThesisDetails[];
  eliminatedTheses: TezaraThesisSummary[];
  diagnostic: SiftingDiagnostic;
}> {
  log.file("sifting.ts:44");
  const functionStart = performance.now();

  // Deduplication
  const uniqueThesesMap = new Map<number, TezaraThesisSummary>();
  let rawCount = 0;
  for (const list of tezaraSearchResults) {
    if (Array.isArray(list)) {
      rawCount += list.length;
      for (const t of list) {
        if (!t || typeof t.id !== "number") continue;
        if (!uniqueThesesMap.has(t.id)) {
          uniqueThesesMap.set(t.id, t);
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

  log.info("originality_sift_start", {
    service: "originality",
    data: {
      count: rawCount,
      uniqueCount: uniqueTheses.length,
      context: params.studyTitle,
    },
  });

  if (uniqueTheses.length === 0) {
    log.info("originality_sift_success", {
      service: "originality",
      durationMs: 0,
      data: {
        count: 0,
        before: uniqueTheses.length,
        after: 0,
        context: params.studyTitle,
      },
    });
    return {
      finalTheses: [],
      eliminatedTheses: [],
      diagnostic: {
        uniqueAfterDedup: 0,
        topIds: [],
        stage1Count: 0,
        fetchRequested: 0,
        fetchSuccess: 0,
        fetchFailed: 0,
      },
    };
  }

  try {
    let topIds: number[] = [];
    let fetchFailed = 0;

    // Stage 1 — Cohere Rerank: semantic relevance scoring against the thesis matrix
    const siftStart = performance.now();
    log.info("originality_sift_cohere_start", {
      service: "originality",
      data: {
        count: uniqueTheses.length,
        context: params.studyTitle,
      },
    });

    try {
      // Build the rerank query from all 6 thesis matrix fields
      const rerankQuery = [
        `studyTitle: ${params.studyTitle}`,
        `researchQuestion: ${params.researchQuestion}`,
        `mainClaim: ${params.mainClaim}`,
        `theoreticalFramework: ${params.theoreticalFramework}`,
        `methodology: ${params.methodology}`,
        `researchScope: ${params.researchScope}`,
      ].join("\n");

      // Documents are bare thesis titles (no metadata) for cross-lingual cross-attention
      const titles = uniqueTheses.map((t) => t.title);

      const { results } = await rerankTheses(rerankQuery, titles, log);

      // Sort descending by relevance score, with ID-based tie-breaker
      // for FP16 micro-fluctuations below 0.001
      const topResults = results
        .sort((a, b) => {
          const scoreDiff = b.relevanceScore - a.relevanceScore;
          if (Math.abs(scoreDiff) < 0.001) {
            return uniqueTheses[a.index].id - uniqueTheses[b.index].id;
          }
          return scoreDiff;
        })
        .slice(0, 20);

      topIds = topResults.map((r) => uniqueTheses[r.index].id);
    } catch (err) {
      log.error("originality_sift_cohere_failed", {
        service: "originality",
        error: err,
        data: { context: params.studyTitle },
      });
      throw err;
    }

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
      durationMs: performance.now() - siftStart,
      data: {
        count: passedStage1.length,
        context: params.studyTitle,
      },
    });

    // Fetch details (with Abstract) for the passed theses
    const fetchStart = performance.now();
    log.info("originality_sift_fetch_start", {
      service: "originality",
      data: {
        count: passedStage1.length,
        context: params.studyTitle,
      },
    });

    const detailsList = await Promise.all(
      passedStage1.map((t) => fetchThesisDetails(t, log)),
    );
    const validDetails = detailsList.filter(
      (d): d is TezaraThesisDetails => d !== null,
    );
    fetchFailed = passedStage1.length - validDetails.length;

    log.info("originality_sift_fetch_success", {
      service: "originality",
      durationMs: performance.now() - fetchStart,
      data: {
        count: validDetails.length,
        context: params.studyTitle,
      },
    });

    if (validDetails.length === 0) {
      log.info("originality_sift_success", {
        service: "originality",
        durationMs: performance.now() - functionStart,
        data: {
          count: 0,
          before: uniqueTheses.length,
          after: 0,
          context: params.studyTitle,
        },
      });
      return {
        finalTheses: [],
        eliminatedTheses: uniqueTheses,
        diagnostic: {
          uniqueAfterDedup: uniqueTheses.length,
          topIds,
          stage1Count: passedStage1.length,
          fetchRequested: passedStage1.length,
          fetchSuccess: 0,
          fetchFailed,
        },
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

    log.info("originality_sift_success", {
      service: "originality",
      durationMs: performance.now() - functionStart,
      data: {
        count: validDetails.length,
        before: uniqueTheses.length,
        after: validDetails.length,
        context: params.studyTitle,
      },
    });

    return {
      finalTheses: validDetails,
      eliminatedTheses,
      diagnostic: {
        uniqueAfterDedup: uniqueTheses.length,
        topIds,
        stage1Count: passedStage1.length,
        fetchRequested: passedStage1.length,
        fetchSuccess: validDetails.length,
        fetchFailed,
      },
    };
  } catch (err) {
    log.error("originality_sift_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    throw err;
  }
}
