import { generateStructuredContent } from "@/lib/gemini";
import { fetchThesisDetails } from "@/lib/tezara";
import type { Logger } from "@/lib/logger";
import type {
  TezaraThesisSummary,
  TezaraThesisDetails,
  SiftResponse,
  DeepSiftResponse,
} from "@/lib/types";
import {
  siftingSchema,
  SIFTING_SYSTEM_INSTRUCTION,
  buildSiftingPrompt,
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

interface ThesisWithFrequency extends TezaraThesisSummary {
  frequencyScore: number;
}

/**
 * Deduplicates, filters, sifts candidates in a two-stage pipeline using Gemini, and retrieves full thesis details.
 * Supports up to 20 parallel search query results.
 *
 * @param params - Target thesis matrix parameters.
 * @param tezaraSearchResults - Parallel search results from Tezara containing candidates.
 * @param log - Logger instance.
 * @returns Array of exactly 5 successfully retrieved and sifting-approved TezaraThesisDetails.
 */
export async function siftAndFetchDetails(
  params: SiftAndFetchDetailsParams,
  tezaraSearchResults: TezaraThesisSummary[][],
  log: Logger,
): Promise<TezaraThesisDetails[]> {
  // 1. Frequency Scoring & Deduplication
  const uniqueThesesMap = new Map<number, ThesisWithFrequency>();
  let rawCount = 0;
  for (const list of tezaraSearchResults) {
    if (Array.isArray(list)) {
      rawCount += list.length;
      const seenInThisList = new Set<number>();
      for (const t of list) {
        if (!t || typeof t.id !== "number") continue;
        if (seenInThisList.has(t.id)) continue;
        seenInThisList.add(t.id);

        const existing = uniqueThesesMap.get(t.id);
        if (existing) {
          existing.frequencyScore += 1;
        } else {
          uniqueThesesMap.set(t.id, {
            ...t,
            frequencyScore: 1,
          });
        }
      }
    }
  }

  const uniqueTheses = Array.from(uniqueThesesMap.values());

  log.info("search_success", {
    service: "tezara",
    step: "deduplicate_and_score",
    data: {
      rawCount,
      uniqueCount: uniqueTheses.length,
    },
  });

  if (uniqueTheses.length === 0) {
    return [];
  }

  // 2. Stage 1 (Coarse Sifting - Exclusion)
  // Gemini'ye sadece title, department (subject) ve id gönderiyoruz.
  log.info("ai_request_start", {
    service: "gemini",
    step: "sifting_stage_1_start",
    data: { candidateCount: uniqueTheses.length },
  });

  let stage1Ids: number[] = [];
  try {
    const siftResult = await generateStructuredContent<SiftResponse>(
      "gemini-3.1-flash-lite",
      SIFTING_SYSTEM_INSTRUCTION,
      buildSiftingPrompt({
        ...params,
        uniqueTheses: uniqueTheses.map((t) => ({
          id: t.id,
          title: t.title,
          department: t.department,
        })),
      }),
      siftingSchema,
      log,
    );
    const targetIds = Array.isArray(siftResult?.relevantThesisIds)
      ? siftResult.relevantThesisIds
      : [];
    stage1Ids = targetIds.filter((id) => uniqueTheses.some((t) => t.id === id));

    log.info("ai_request_success", {
      service: "gemini",
      step: "sifting_stage_1_end",
      data: { selectedCount: stage1Ids.length },
    });
  } catch (err) {
    log.warn("ai_low_quality_response", {
      service: "gemini",
      step: "sifting_stage_1_fallback",
      data: { fallback: "Tüm tezler kabul edildi" },
      error: err,
    });
    stage1Ids = uniqueTheses.map((t) => t.id);
  }

  // Filter out theses that didn't pass Stage 1
  const passedStage1 = uniqueTheses.filter((t) => stage1Ids.includes(t.id));

  // 3. Frequency Sorting (Sort)
  // Stage 1'den sağ çıkan tezleri frequencyScore değerine göre yüksekten düşüğe sırala.
  passedStage1.sort((a, b) => b.frequencyScore - a.frequencyScore);

  log.info("flow_start", {
    service: "originality",
    step: "frequency_sort_complete",
    data: { count: passedStage1.length },
  });

  // Limit to first 50 passed candidates to optimize token usage
  const top50Passed = passedStage1.slice(0, 50);

  // 4. Fetch details (with Abstract) for the sorted top 50 theses
  log.info("flow_start", {
    service: "originality",
    step: "fetch_details_stage_2",
    data: { thesisCount: top50Passed.length },
  });

  const detailsList = await Promise.all(
    top50Passed.map((t) => fetchThesisDetails(t.id, log)),
  );
  const validDetails = detailsList.filter(
    (d): d is TezaraThesisDetails => d !== null,
  );

  log.info("search_success", {
    service: "tezara",
    step: "fetch_details_stage_2_complete",
    data: {
      requestedCount: top50Passed.length,
      successCount: validDetails.length,
    },
  });

  if (validDetails.length === 0) {
    return [];
  }

  // 5. Stage 2 (Deep Sifting with Abstract)
  // LLM'i en kritik 5 tezi seçmeye zorla.
  log.info("ai_request_start", {
    service: "gemini",
    step: "sifting_stage_2_start",
    data: { candidateCount: validDetails.length },
  });

  let final5Ids: number[] = [];
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
    );

    const targetIds = Array.isArray(deepSiftResult?.selectedThesisIds)
      ? deepSiftResult.selectedThesisIds
      : [];

    final5Ids = targetIds.filter((id) => validDetails.some((t) => t.id === id));

    log.info("ai_request_success", {
      service: "gemini",
      step: "sifting_stage_2_end",
      data: { selectedCount: final5Ids.length },
    });
  } catch (err) {
    log.warn("ai_low_quality_response", {
      service: "gemini",
      step: "sifting_stage_2_fallback",
      data: { fallback: "İlk 5 tez seçildi" },
      error: err,
    });
    // Fallback: take the first 5 sorted by frequencyScore
    final5Ids = validDetails.slice(0, 5).map((t) => t.id);
  }

  // Extract exactly the final 5 thesis details
  let finalSelectedTheses = validDetails.filter((t) =>
    final5Ids.includes(t.id),
  );
  if (finalSelectedTheses.length === 0) {
    finalSelectedTheses = validDetails.slice(0, 5);
  } else if (finalSelectedTheses.length > 5) {
    finalSelectedTheses = finalSelectedTheses.slice(0, 5);
  } else if (
    finalSelectedTheses.length < 5 &&
    validDetails.length > finalSelectedTheses.length
  ) {
    // Fill up to 5 from other validDetails
    const extra = validDetails.filter(
      (t) => !finalSelectedTheses.some((ft) => ft.id === t.id),
    );
    finalSelectedTheses.push(...extra.slice(0, 5 - finalSelectedTheses.length));
  }

  log.info("flow_complete", {
    service: "originality",
    step: "sifting_complete",
    data: {
      finalCount: finalSelectedTheses.length,
      finalIds: finalSelectedTheses.map((t) => t.id),
    },
  });

  return finalSelectedTheses;
}
