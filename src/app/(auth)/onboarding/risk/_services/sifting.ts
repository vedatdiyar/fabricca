import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import { extractMessage } from "@/lib/error-utils";
import { cosineSimilarity } from "@/lib/utils";
import { generateEmbeddings } from "@/lib/cloudflare";
import { fetchThesisDetails } from "@/lib/tezara";
import type { Logger } from "@/lib/logger";
import type {
  TezaraThesisSummary,
  TezaraThesisDetails,
  DeepSiftEntry,
  DeepSiftResponse,
} from "@/lib/types";
import {
  deepSiftingSchema,
  buildDeepSiftingSystemInstruction,
  buildDeepSiftingPrompt,
} from "@/lib/prompts";

export interface SiftAndFetchDetailsParams {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  historicalSpatialLimits: string;
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
 * Deduplicates, filters, sifts candidates in a two-stage pipeline using Gemini, and retrieves full thesis details.
 * Supports up to 20 parallel search query results.
 *
 * @param params - Target thesis matrix parameters.
 * @param tezaraSearchResults - Parallel search results from Tezara containing candidates.
 * @param log - Logger instance.
 * @returns Object containing finalTheses (array of TezaraThesisDetails selected by the LLM) and diagnostic info.
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

  log.data("Raw/Unique Thesis Count", { rawCount, uniqueCount: uniqueTheses.length });

  log.info({
    step: "sift_and_fetch_details",
    status: "START",
    candidateCount: rawCount,
    uniqueCount: uniqueTheses.length,
  });

  if (uniqueTheses.length === 0) {
    log.info({
      step: "sift_and_fetch_details",
      status: "SUCCESS",
      metrics: {
        duration: "0.0s",
        outputRows: 0,
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
    log.info({
      step: "embedding_sifting_stage_1",
      status: "START",
      candidateCount: uniqueTheses.length,
    });

    let passedStage1: TezaraThesisSummary[] = [];
    try {
      const queryText = `task: search result | query: ${params.studyTitle}`;
      const docTexts = uniqueTheses.map(
        (t) => `title: ${t.title} | text: none`,
      );
      const textsToEmbed = [queryText, ...docTexts];

      const embeddings = await generateEmbeddings(textsToEmbed, log);

      const targetVector = embeddings[0];
      const candidateVectors = embeddings.slice(1);

      const candidatesWithSimilarity = uniqueTheses.map((t, idx) => {
        const similarity = cosineSimilarity(
          targetVector,
          candidateVectors[idx],
        );
        return { thesis: t, similarity };
      });

      candidatesWithSimilarity.sort((a, b) => b.similarity - a.similarity);

      const topCandidates = candidatesWithSimilarity.slice(0, 15);
      passedStage1 = topCandidates.map((c) => c.thesis);
      topSimilarities = topCandidates.map((c) => ({
        id: c.thesis.id,
        score: c.similarity,
      }));

      const stage1Duration =
        ((performance.now() - stage1Start) / 1000).toFixed(1) + "s";
      log.info({
        step: "embedding_sifting_stage_1",
        status: "SUCCESS",
        metrics: {
          duration: stage1Duration,
          outputRows: passedStage1.length,
        },
      });
    } catch (err) {
      log.error({
        step: "embedding_sifting_stage_1",
        status: "FAILED",
        diagnostics: {
          errorCode: "EMBEDDING_SIFTING_ERROR",
          message: extractMessage(err),
        },
      });
      throw err;
    }

    // 3. Fetch details (with Abstract) for the passed theses in batches
    const fetchStart = performance.now();
    log.info({
      step: "fetch_details_stage_2",
      status: "START",
      thesisCount: passedStage1.length,
    });

    const batchSize = 10;
    const detailsList: (TezaraThesisDetails | null)[] = [];
    for (let i = 0; i < passedStage1.length; i += batchSize) {
      const batch = passedStage1.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((t) => fetchThesisDetails(t.id, log)),
      );
      detailsList.push(...batchResults);
    }
    const validDetails = detailsList.filter(
      (d): d is TezaraThesisDetails => d !== null,
    );
    fetchFailed = passedStage1.length - validDetails.length;

    const fetchDuration =
      ((performance.now() - fetchStart) / 1000).toFixed(1) + "s";
    log.info({
      step: "fetch_details_stage_2",
      status: "SUCCESS",
      metrics: {
        duration: fetchDuration,
        outputRows: validDetails.length,
      },
    });

    if (validDetails.length === 0) {
      const totalDuration =
        ((performance.now() - functionStart) / 1000).toFixed(1) + "s";
      log.info({
        step: "sift_and_fetch_details",
        status: "SUCCESS",
        metrics: {
          duration: totalDuration,
          outputRows: 0,
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

    // 4. Stage 2 (Deep Sifting with Abstract)
    const stage2Start = performance.now();
    log.info({
      step: "sifting_stage_2",
      status: "START",
      candidateCount: validDetails.length,
    });

    let finalIds: number[] = [];
    try {
      const deepSiftPrompt = buildDeepSiftingPrompt({
        ...params,
        candidateDetails: validDetails.map((t) => ({
          id: t.id,
          title: t.title,
          department: t.department,
          abstract: t.abstract || "",
        })),
      });
      log.prompt("gemini-3.1-flash-lite (HIGH thinking)", deepSiftPrompt);

      const deepSiftResult = await generateStructuredContent<DeepSiftResponse>(
        "gemini-3.1-flash-lite",
        buildDeepSiftingSystemInstruction(),
        deepSiftPrompt,
        deepSiftingSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      );

      const targetEntries = Array.isArray(deepSiftResult?.selectedTheses)
        ? deepSiftResult.selectedTheses
        : ([] as DeepSiftEntry[]);

      const targetIds = targetEntries.map((e) => e.id);

      const validIdSet = new Set(validDetails.map((t) => t.id));
      finalIds = targetIds.filter((id) => validIdSet.has(id));

      const stage2Duration =
        ((performance.now() - stage2Start) / 1000).toFixed(1) + "s";
      const tokens = log.lastTokens || { input: 0, output: 0 };

      log.info({
        step: "sifting_stage_2",
        status: "SUCCESS",
        metrics: {
          duration: stage2Duration,
          tokens: {
            prompt: tokens.input ?? 0,
            completion: tokens.output ?? 0,
          },
          outputRows: finalIds.length,
        },
      });
    } catch (err) {
      log.error({
        step: "sifting_stage_2",
        status: "FAILED",
        diagnostics: {
          errorCode: "GEMINI_SIFTING_ERROR",
          message: extractMessage(err),
          model: "gemini-3.1-flash-lite",
        },
      });
      throw err;
    }

    const finalIdSet = new Set(finalIds);

    const finalSelectedTheses = validDetails.filter((t) =>
      finalIdSet.has(t.id),
    );

    const eliminatedTheses = uniqueTheses.filter(
      (t) => !finalIdSet.has(t.id),
    );

    log.preview("Final Selected Thesis IDs", finalSelectedTheses.map((t) => ({ id: t.id, title: t.title })));

    const totalDuration =
      ((performance.now() - functionStart) / 1000).toFixed(1) + "s";
    log.info({
      step: "sift_and_fetch_details",
      status: "SUCCESS",
      metrics: {
        duration: totalDuration,
        outputRows: finalSelectedTheses.length,
      },
    });

    return {
      finalTheses: finalSelectedTheses,
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
    log.error({
      step: "sift_and_fetch_details",
      status: "FAILED",
      diagnostics: {
        errorCode: "SIFTING_PIPELINE_ERROR",
        message: extractMessage(err),
      },
    });
    throw err;
  }
}
