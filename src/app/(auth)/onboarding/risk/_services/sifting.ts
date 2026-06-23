import { cosineSimilarity } from "@/lib/utils";
import { generateEmbeddings } from "@/lib/cloudflare";
import { fetchThesisDetails } from "@/lib/tezara";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisSummary, TezaraThesisDetails } from "@/lib/types";

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
  topSimilarities: { id: number; score: number }[];
  stage1Count: number;
  fetchRequested: number;
  fetchSuccess: number;
  fetchFailed: number;
}

/**
 * Deduplicates search results, selects top 15 via embedding cosine similarity,
 * fetches full thesis details, and returns all valid theses for jury analysis.
 * Deep sifting (Stage 2) has been removed — the jury now exercises elimination authority.
 *
 * @param params - Target thesis parameters.
 * @param tezaraSearchResults - Parallel search results from Tezara containing candidates.
 * @param log - Logger instance.
 * @returns Object containing finalTheses (all embedding-top-15 theses with valid details) and diagnostic info.
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
  log.file("sifting.ts:53");
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
        topSimilarities: [],
        stage1Count: 0,
        fetchRequested: 0,
        fetchSuccess: 0,
        fetchFailed: 0,
      },
    };
  }

  try {
    // Diagnostic tracking
    let topSimilarities: { id: number; score: number }[] = [];
    let fetchFailed = 0;

    // 2. Stage 1 (Coarse Sifting via Google Gemini Embedding v2)
    const stage1Start = performance.now();
    log.info("originality_sift_embedding_start", {
      service: "originality",
      data: {
        count: uniqueTheses.length,
        context: params.studyTitle,
      },
    });

    let passedStage1: TezaraThesisSummary[] = [];
    try {
      const queryText = `task: search result | query: ${params.studyTitle}`;

      const docTexts = uniqueTheses.map(
        (t) => `title: ${t.title} | text: none`,
      );

      const textsToEmbed = [queryText, ...docTexts];

      const embeddings = await generateEmbeddings(textsToEmbed, log);

      const queryVector = embeddings[0];
      const candidateVectors = embeddings.slice(1);

      const candidatesWithSimilarity = uniqueTheses.map((t, idx) => {
        const similarity = cosineSimilarity(queryVector, candidateVectors[idx]);
        return { thesis: t, similarity };
      });

      candidatesWithSimilarity.sort((a, b) => b.similarity - a.similarity);

      const topCandidates = candidatesWithSimilarity.slice(0, 15);
      passedStage1 = topCandidates.map((c) => c.thesis);
      topSimilarities = topCandidates.map((c) => ({
        id: c.thesis.id,
        score: c.similarity,
      }));

      log.info("originality_sift_embedding_success", {
        service: "originality",
        durationMs: performance.now() - stage1Start,
        data: {
          count: passedStage1.length,
          context: params.studyTitle,
        },
      });
    } catch (err) {
      log.error("originality_sift_embedding_failed", {
        service: "originality",
        error: err,
        data: { context: params.studyTitle },
      });
      throw err;
    }

    // 3. Fetch details (with Abstract) for the passed theses in batches
    const fetchStart = performance.now();
    log.info("originality_sift_fetch_start", {
      service: "originality",
      data: {
        count: passedStage1.length,
        context: params.studyTitle,
      },
    });

    const batchSize = 10;
    const detailsList: (TezaraThesisDetails | null)[] = [];
    for (let i = 0; i < passedStage1.length; i += batchSize) {
      const batch = passedStage1.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((t) => fetchThesisDetails(t, log)),
      );
      detailsList.push(...batchResults);
    }
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
          topSimilarities,
          stage1Count: passedStage1.length,
          fetchRequested: passedStage1.length,
          fetchSuccess: 0,
          fetchFailed,
        },
      };
    }

    // Stage 2 kaldirildi — embedding'den gecen 15 tezin tamami jury analizine gider.
    // Jury (originality-analysis.ts) kendi eleme yetkisiyle alakasiz veya 4 ekseni
    // de ozgun olan tezleri rapor disinda birakir.

    const passedStage1Ids = new Set(passedStage1.map((t) => t.id));
    const eliminatedTheses = uniqueTheses.filter(
      (t) => !passedStage1Ids.has(t.id),
    );

    log.preview(
      "Final Thesis IDs (all valid from stage 1 → jury)",
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
        topSimilarities,
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
