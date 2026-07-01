/**
 * OpenAlex search collector.
 *
 * Rate-limit management is delegated to the global gap-enforced queue
 * in openalex/client.ts (1000ms gap between requests, cross-caller).
 * This file provides a higher-level batched interface with retry logging.
 */

import { searchOpenAlex } from "./openalex/client";
import { mergePapers } from "./literature-review-papers";
import type { RawPaper, ValidatedPaper } from "./literature-review-papers";
import type { Logger } from "@/lib/logger";

/**
 * Runs an OpenAlex search for all given queries. Calls are dispatched
 * concurrently — the global gap-enforced queue in client.ts serialises
 * them with the required 1000ms gap.
 *
 * @param queries - Array of semantic search query strings
 * @param logger - Logger instance
 * @returns Deduplicated validated papers
 */
export async function collectOpenAlexResults(
  queries: string[],
  logger: Logger,
): Promise<ValidatedPaper[]> {
  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      if (!query.trim()) return [] as RawPaper[];
      try {
        return await searchOpenAlex(query);
      } catch (err) {
        logger.error("openalex_collect_failed", {
          service: "literature",
          filePath:
            "onboarding/literature-review/_services/openalex-collector.ts",
          data: {
            query: query.substring(0, 120),
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return [] as RawPaper[];
      }
    }),
  );

  const semanticRaw: RawPaper[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      semanticRaw.push(...r.value);
    }
  }

  return mergePapers(semanticRaw);
}
