import { searchExa, type ExaSearchResult } from "@/core/services/exa";
import { searchTheses } from "@/core/services/thesis-search";
import { searchOpenAlex } from "@/app/(onboarding)/onboarding/literature-review/_services/openalex/openalex-search";
import type { ThesisDetails } from "@/lib/types";
import type { RawPaper } from "@/app/(onboarding)/onboarding/literature-review/_services/literature-review-papers";
import type { QueryDecomposition } from "./schemas";
import type { Logger } from "@/lib/logger";
import type { PipelineRun } from "@/lib/pipeline-logger";

export interface DiscoveryResults {
  webResultsArray: ExaSearchResult[][];
  thesisResultsArray: ThesisDetails[][];
  litResultsArray: RawPaper[][];
}

/**
 * Runs parallel discovery across web, thesis and literature channels.
 *
 * @param queries - Decomposed queries.
 * @param run - Pipeline run for sub-step timing.
 * @param logger - Logger instance for thesis search.
 * @returns Discovery results per channel.
 */
export async function runDiscoverySearches(
  queries: QueryDecomposition,
  run: PipelineRun,
  logger: Logger,
): Promise<DiscoveryResults> {
  const [webResultsArray, thesisResultsArray, litResultsArray] =
    await Promise.all([
      (async () => {
        const t0 = performance.now();
        const res = await Promise.all(
          queries.webQueries.map((q) =>
            searchExa(q, { numResults: 3 }).catch(
              () => [] as ExaSearchResult[],
            ),
          ),
        );
        run.subStep(
          `Exa (x${queries.webQueries.length})`,
          performance.now() - t0,
        );
        return res;
      })(),
      (async () => {
        const t0 = performance.now();
        const res = await Promise.all(
          queries.thesisQueries.map((q) =>
            searchTheses(q, logger, {
              limit: 3,
              rankingScoreThreshold: 0.55,
              silent: true,
            }).catch(() => [] as ThesisDetails[]),
          ),
        );
        run.subStep(
          `Vector Search (x${queries.thesisQueries.length})`,
          performance.now() - t0,
        );
        return res;
      })(),
      (async () => {
        const t0 = performance.now();
        const res = await Promise.all(
          queries.literatureQueries.map((q) =>
            searchOpenAlex(q, 3).catch(() => [] as RawPaper[]),
          ),
        );
        run.subStep(
          `OpenAlex (x${queries.literatureQueries.length})`,
          performance.now() - t0,
        );
        return res;
      })(),
    ]);

  return { webResultsArray, thesisResultsArray, litResultsArray };
}
