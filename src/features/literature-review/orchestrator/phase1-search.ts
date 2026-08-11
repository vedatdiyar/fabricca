import { Logger } from "@/lib/logger";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type { SubBoxInput, SubBoxItem } from "../literature-review-papers";
import { searchOpenAlex } from "../openalex/client";
import type { SubBoxResult } from "./types";

/**
 * Executes Phase 1 search across sub-boxes using OpenAlex semantic search.
 * Throws if a sub-box is missing a semanticQuery — no silent skips.
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
  logger.info("literature_openalex_search_start");

  const limiter = createConcurrencyLimiter(3);

  const phase1Results = await Promise.allSettled(
    activeJobs.map(({ box, subBox }) =>
      limiter.exec(async (): Promise<SubBoxResult> => {
        const query = subBox.semanticQuery?.trim();

        if (!query) {
          return {
            boxType: box.boxType ?? "PRIMARY_MATERIAL",
            subBoxDescription: subBox.description ?? "",
            subBox,
            thesisBoxId: subBox.thesisBoxId,
            rawPapers: [],
          };
        }

        const rawPapers = await searchOpenAlex(query, 25, checkCancelled);

        return {
          boxType: box.boxType ?? "PROBLEMATIZATION",
          subBoxDescription: subBox.description ?? "",
          subBox,
          thesisBoxId: subBox.thesisBoxId,
          rawPapers,
        };
      }),
    ),
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

  logger.info("literature_openalex_search_success");

  return fulfilledResults;
}
