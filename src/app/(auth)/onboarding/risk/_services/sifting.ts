import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
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

    // 4. Stage 2 (Deep Sifting with Abstract)
    const stage2Start = performance.now();
    log.info("originality_sift_deep_start", {
      service: "originality",
      data: {
        count: validDetails.length,
        context: params.studyTitle,
      },
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

      console.log(
        "=== GEMINI'A GİDEN HAM TEZ VERİLERİ ===",
        JSON.stringify(validDetails, null, 2),
      );

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

      const tokens = log.lastTokens || { input: 0, output: 0 };

      log.info("originality_sift_deep_success", {
        service: "originality",
        durationMs: performance.now() - stage2Start,
        tokens: { input: tokens.input ?? 0, output: tokens.output ?? 0 },
        data: {
          count: finalIds.length,
          context: params.studyTitle,
        },
      });
    } catch (err) {
      log.error("originality_sift_deep_failed", {
        service: "originality",
        error: err,
        data: { context: params.studyTitle },
      });
      throw err;
    }

    const finalIdSet = new Set(finalIds);

    const finalSelectedTheses = validDetails.filter((t) =>
      finalIdSet.has(t.id),
    );

    const eliminatedTheses = uniqueTheses.filter((t) => !finalIdSet.has(t.id));

    log.preview(
      "Final Selected Thesis IDs",
      finalSelectedTheses.map((t) => ({ id: t.id, title: t.title })),
    );

    log.info("originality_sift_success", {
      service: "originality",
      durationMs: performance.now() - functionStart,
      data: {
        count: finalSelectedTheses.length,
        before: uniqueTheses.length,
        after: finalSelectedTheses.length,
        context: params.studyTitle,
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
    log.error("originality_sift_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    throw err;
  }
}
