import { Logger } from "@/lib/logger";
import type { SubBoxInput, SubBoxItem } from "../literature-review-papers";
import { searchMultiChannelForSubBox } from "./multi-channel-search";
import type { SubBoxResult } from "./types";

/**
 * Executes Phase 1 search across sub-boxes using the 4-channel multi-source search engine
 * (OpenAlex, Semantic Scholar, Exa DergiPark, and Qdrant YÖK Theses).
 *
 * @param activeJobs - The list of box sub-box jobs to search.
 * @param logger - The shared flow logger.
 * @param checkCancelled - Optional cancellation predicate checked during execution.
 * @returns The phase 1 results for every processed sub-box.
 */
export async function executePhase1Search(
  activeJobs: { box: SubBoxInput; subBox: SubBoxItem }[],
  logger: Logger,
  checkCancelled?: () => boolean,
): Promise<SubBoxResult[]> {
  logger.info("literature_multi_channel_search_start", { hidden: true });

  const phase1Results = await Promise.allSettled(
    activeJobs.map(async ({ box, subBox }): Promise<SubBoxResult> => {
      const rawPapers = await searchMultiChannelForSubBox(
        subBox,
        logger,
        checkCancelled,
      );

      return {
        boxType: box.boxType ?? "PROBLEMATIZATION",
        subBoxDescription: subBox.description ?? "",
        subBox,
        thesisBoxId: subBox.thesisBoxId,
        rawPapers,
      };
    }),
  );

  const fulfilledResults: SubBoxResult[] = [];
  for (const result of phase1Results) {
    if (result.status === "fulfilled") {
      fulfilledResults.push(result.value);
    } else {
      const errorMsg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      logger.error("literature_phase1_subbox_failed", {
        error: errorMsg,
      });
      throw result.reason;
    }
  }

  logger.info("literature_multi_channel_search_success", {
    hidden: true,
    data: { processedBoxes: fulfilledResults.length },
  });

  return fulfilledResults;
}
