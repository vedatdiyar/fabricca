import { generateStructuredContent } from "@/lib/gemini";
import { fetchThesisDetails } from "@/lib/tezara";
import type { Logger } from "@/lib/logger";
import type {
  TezaraThesisSummary,
  TezaraThesisDetails,
  SiftResponse,
} from "@/lib/types";
import {
  siftingSchema,
  SIFTING_SYSTEM_INSTRUCTION,
  buildSiftingPrompt,
} from "@/lib/prompts";

export interface SiftAndFetchDetailsParams {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  historicalSpatialLimits: string;
}

/**
 * Deduplicates, filters, sifts candidates using Gemini, and retrieves full thesis details.
 *
 * @param params - Target thesis matrix parameters.
 * @param tezaraSearchResults - Parallel search results from Tezara containing candidates.
 * @param log - Logger instance.
 * @returns Array of successfully retrieved TezaraThesisDetails.
 */
export async function siftAndFetchDetails(
  params: SiftAndFetchDetailsParams,
  tezaraSearchResults: TezaraThesisSummary[][],
  log: Logger,
): Promise<TezaraThesisDetails[]> {
  const rawTheses: TezaraThesisSummary[] = [];
  for (const list of tezaraSearchResults) {
    if (Array.isArray(list)) {
      rawTheses.push(...list);
    }
  }

  // Deduplicate by ID
  const uniqueThesesMap = new Map<number, TezaraThesisSummary>();
  for (const t of rawTheses) {
    uniqueThesesMap.set(t.id, t);
  }
  const uniqueTheses = Array.from(uniqueThesesMap.values());

  log.info("search_success", {
    service: "tezara",
    step: "deduplicate",
    data: {
      rawCount: rawTheses.length,
      uniqueCount: uniqueTheses.length,
    },
  });

  let selectedThesisIds: number[] = [];
  if (uniqueTheses.length === 0) {
    selectedThesisIds = [];
  } else if (uniqueTheses.length <= 7) {
    selectedThesisIds = uniqueTheses.map((t) => t.id);

    log.info("search_success", {
      service: "tezara",
      step: "select_theses",
      data: { method: "Doğrudan (≤7)", count: selectedThesisIds.length },
    });
  } else {
    log.info("ai_request_start", {
      service: "gemini",
      step: "rough_sift",
      data: { candidateCount: uniqueTheses.length },
    });

    try {
      const siftResult = await generateStructuredContent<SiftResponse>(
        "gemini-3.1-flash-lite",
        SIFTING_SYSTEM_INSTRUCTION,
        buildSiftingPrompt({
          ...params,
          uniqueTheses,
        }),
        siftingSchema,
        log,
      );
      const targetIds = Array.isArray(siftResult?.relevantThesisIds)
        ? siftResult.relevantThesisIds
        : [];
      selectedThesisIds = targetIds.filter((id) =>
        uniqueTheses.some((t) => t.id === id),
      );

      log.info("ai_request_success", {
        service: "gemini",
        step: "rough_sift",
        data: { selectedCount: selectedThesisIds.length },
      });
    } catch (err) {
      log.warn("ai_low_quality_response", {
        service: "gemini",
        step: "rough_sift",
        data: { fallback: "İlk 7 tez seçildi" },
        error: err,
      });
      selectedThesisIds = uniqueTheses.slice(0, 7).map((t) => t.id);
    }
  }

  // Fetch details
  log.info("flow_start", {
    service: "originality",
    step: "fetch_details",
    data: { thesisCount: selectedThesisIds.length },
  });

  const detailsList = await Promise.all(
    selectedThesisIds.map((id) => fetchThesisDetails(id, log)),
  );
  const validDetails = detailsList.filter(
    (d): d is TezaraThesisDetails => d !== null,
  );

  log.info("search_success", {
    service: "tezara",
    step: "fetch_details_complete",
    data: {
      requestedCount: selectedThesisIds.length,
      successCount: validDetails.length,
    },
  });

  return validDetails;
}
