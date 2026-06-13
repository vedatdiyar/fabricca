import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent, generateEmbeddings, cosineSimilarity } from "@/lib/gemini";
import { fetchThesisDetails } from "@/lib/tezara";
import type { Logger } from "@/lib/logger";
import type {
  TezaraThesisSummary,
  TezaraThesisDetails,
  DeepSiftResponse,
} from "@/lib/types";
import {
  deepSiftingSchema,
  DEEP_SIFTING_SYSTEM_INSTRUCTION,
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
): Promise<{ finalTheses: TezaraThesisDetails[]; diagnostic: SiftingDiagnostic }> {
  // 1. Deduplication
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

  const uniqueTheses = Array.from(uniqueThesesMap.values()).sort((a, b) => a.id - b.id);

  log.info("search_success", {
    service: "tezara",
    step: "deduplicate_and_score",
    data: {
      rawCount,
      uniqueCount: uniqueTheses.length,
    },
  });

  if (uniqueTheses.length === 0) {
    return { finalTheses: [], diagnostic: { uniqueAfterDedup: 0, topSimilarities: [], stage1Count: 0, fetchRequested: 0, fetchSuccess: 0, fetchFailed: 0 } };
  }

  // Diagnostic tracking
  let topSimilarities: { id: number; score: number }[] = [];
  let fetchFailed = 0;

  // 2. Stage 1 (Coarse Sifting via Google Gemini Embedding v2)
  log.info("flow_start", {
    service: "originality",
    step: "embedding_sifting_stage_1_start",
    data: { candidateCount: uniqueTheses.length },
  });

  let passedStage1: TezaraThesisSummary[] = [];
  try {
    // Toplu (batch) olarak targetTitle (query formatında) ve tüm aday tez başlıklarını (document formatında) içeren tek bir arama isteği
    const queryText = `task: search result | query: ${params.studyTitle}`;
    const docTexts = uniqueTheses.map((t) => `title: ${t.title} | text: none`);
    const textsToEmbed = [queryText, ...docTexts];
    
    // generateEmbeddings fonksiyonunu çağır (tam olarak 1 adet API isteği harcanır)
    const embeddings = await generateEmbeddings(textsToEmbed, log);
    
    const targetVector = embeddings[0];
    const candidateVectors = embeddings.slice(1);

    // Her bir adayın kosinüs benzerlik skorunu hesapla
    const candidatesWithSimilarity = uniqueTheses.map((t, idx) => {
      const similarity = cosineSimilarity(targetVector, candidateVectors[idx]);
      return { thesis: t, similarity };
    });

    // Benzerliğe göre azalan sırada sırala ve en yüksek skora sahip ilk 15 tezi seç
    candidatesWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    
    const topCandidates = candidatesWithSimilarity.slice(0, 15);
    passedStage1 = topCandidates.map((c) => c.thesis);
    topSimilarities = topCandidates.map((c) => ({ id: c.thesis.id, score: c.similarity }));

    log.info("flow_complete", {
      service: "originality",
      step: "embedding_sifting_stage_1_end",
      data: {
        candidateCount: uniqueTheses.length,
        selectedCount: passedStage1.length,
        topSimilarities,
      },
    });
  } catch (err) {
    log.error("ai_request_failed", {
      service: "originality",
      step: "embedding_sifting_stage_1_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // 4. Fetch details (with Abstract) for the passed theses in batches to avoid network bottleneck
  log.info("flow_start", {
    service: "originality",
    step: "fetch_details_stage_2",
    data: { thesisCount: passedStage1.length },
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

  log.info("search_success", {
    service: "tezara",
    step: "fetch_details_stage_2_complete",
    data: {
      requestedCount: passedStage1.length,
      successCount: validDetails.length,
    },
  });

  if (validDetails.length === 0) {
    return { finalTheses: [], diagnostic: { uniqueAfterDedup: uniqueTheses.length, topSimilarities, stage1Count: passedStage1.length, fetchRequested: passedStage1.length, fetchSuccess: 0, fetchFailed } };
  }

  // 5. Stage 2 (Deep Sifting with Abstract)
  // LLM'i en kritik 6 tezi seçmeye zorla.
  log.info("ai_request_start", {
    service: "gemini",
    step: "sifting_stage_2_start",
    data: { candidateCount: validDetails.length },
  });

  let finalIds: number[] = [];
  try {
    const deepSiftResult = await generateStructuredContent<DeepSiftResponse>(
      "gemini-3.1-flash-lite",
      DEEP_SIFTING_SYSTEM_INSTRUCTION,
      buildDeepSiftingPrompt({
        ...params,
        candidateDetails: validDetails.map((t) => ({
          id: t.id,
          title: t.title,
          department: t.department,
          abstract: t.abstract || "",
        })),
      }),
      deepSiftingSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.1, // Low temperature for deterministic selection
      },
    );

    const targetIds = Array.isArray(deepSiftResult?.selectedThesisIds)
      ? deepSiftResult.selectedThesisIds
      : [];

    finalIds = targetIds.filter((id) => validDetails.some((t) => t.id === id));

    log.info("ai_request_success", {
      service: "gemini",
      step: "sifting_stage_2_end",
      data: { selectedCount: finalIds.length },
    });
  } catch (err) {
    log.error("ai_request_failed", {
      service: "gemini",
      step: "sifting_stage_2_failed",
      error: err,
    });
    throw err;
  }

  // Respect the LLM's selection — no artificial padding or capping
  const finalSelectedTheses = validDetails.filter((t) => finalIds.includes(t.id));

  log.info("flow_complete", {
    service: "originality",
    step: "sifting_complete",
    data: {
      finalCount: finalSelectedTheses.length,
      finalIds: finalSelectedTheses.map((t) => t.id),
    },
  });

  return {
    finalTheses: finalSelectedTheses,
    diagnostic: {
      uniqueAfterDedup: uniqueTheses.length,
      topSimilarities,
      stage1Count: passedStage1.length,
      fetchRequested: passedStage1.length,
      fetchSuccess: validDetails.length,
      fetchFailed,
    },
  };
}
