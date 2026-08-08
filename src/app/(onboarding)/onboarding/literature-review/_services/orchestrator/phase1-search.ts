import { Logger } from "@/lib/logger";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type {
  SubBoxInput,
  SubBoxItem,
  RawPaper,
} from "../literature-review-papers";
import {
  searchOpenAlex,
  fetchOpenAlexMetadataBatch,
} from "../openalex/client";
import { extractCleanDoi, extractOpenAlexId } from "@/lib/academic/utils";
import { clusterRefMetadata } from "../clustering";
import { analyzeReferenceFrequencies, type QueueItem } from "../selection";
import type { SubBoxResult, PoolItem } from "./types";

/**
 * Converts a co-citation candidate into a raw paper record.
 *
 * @param c - The co-citation candidate queue item.
 * @returns The raw paper representation.
 */
export function candidateToRawPaper(
  c: QueueItem["candidates"][0],
): RawPaper {
  return {
    source: "openalex",
    title: c.title,
    metadata: `(kurucu eser adayı, atıf sıklığı: ${c.cluster.combinedFrequency})`,
    doi: c.doi,
    authors: c.authors,
    year: c.year,
    publisher: c.publisher,
    openAlexId: extractOpenAlexId(c.openAlexId),
    isFoundational: false,
    relevanceScore: 0,
    citedByCount: c.cluster.combinedFrequency,
    isCoCitationLeader: true,
    ccFreq: c.cluster.combinedFrequency,
  };
}

/**
 * Builds the jury pool for a sub-box from raw papers and co-citation candidates.
 *
 * @param r - The sub-box phase 1 result.
 * @returns The pooled items available for jury evaluation.
 */
export function buildPool(r: SubBoxResult): PoolItem[] {
  const raw: PoolItem[] = r.rawPapers.map((p) => ({
    type: "raw" as const,
    rawPaper: p,
  }));
  const cocitation: PoolItem[] = r.candidates.map((c) => ({
    type: "cocitation" as const,
    rawPaper: candidateToRawPaper(c),
    citationCount: c.cluster.combinedFrequency,
  }));
  return [...raw, ...cocitation];
}

/**
 * Executes Phase 1 search across sub-boxes using OpenAlex search,
 * reference frequency analysis, and fallback candidate generation.
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
            boxType: box.boxType ?? "PROBLEMATIZATION",
            subBoxDescription: subBox.description ?? "",
            subBox,
            thesisBoxId: subBox.thesisBoxId,
            candidates: [],
            activeWorks: [],
            rawPapers: [],
          };
        }

        const rawPapers = await searchOpenAlex(query, 25, checkCancelled);
        const activeWorks = rawPapers.filter(
          (p) =>
            p.referencedWorks &&
            p.referencedWorks.length > 0 &&
            p.title?.trim(),
        );
        const N = activeWorks.length;
        const subBoxCandidates: QueueItem["candidates"] = [];

        if (N > 0) {
          const { leaderIds } = analyzeReferenceFrequencies(activeWorks, N);
          const refMetadata = await fetchOpenAlexMetadataBatch(
            leaderIds,
            checkCancelled,
          );
          const clusters = clusterRefMetadata(refMetadata);

          const mappedCandidates = clusters.slice(0, 5).map((c) => {
            const sortedMembers = [...c.members].sort((a, b) => {
              const hasDoiA = !!a.doi;
              const hasDoiB = !!b.doi;
              if (hasDoiA && !hasDoiB) return -1;
              if (!hasDoiA && hasDoiB) return 1;
              return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
            });
            const chosen = sortedMembers[0];
            return {
              title: chosen.title,
              authors: chosen.authors,
              year: null,
              openAlexId: chosen.id,
              doi: chosen.doi ? extractCleanDoi(chosen.doi) : null,
              publisher: null,
              cluster: c,
            };
          });

          subBoxCandidates.push(...mappedCandidates);
        }

        if (subBoxCandidates.length === 0 && rawPapers.length > 0) {
          const fallbackCandidates = rawPapers
            .filter((p) => p.title?.trim())
            .slice(0, 5)
            .map((p) => ({
              title: p.title!,
              authors: p.authors,
              year: p.year,
              openAlexId: p.openAlexId ?? "",
              doi: p.doi ? extractCleanDoi(p.doi) : null,
              publisher: p.publisher,
              cluster: {
                id: p.openAlexId ?? "",
                canonicalTitle: p.title ?? "",
                members: [],
                combinedFrequency: 1,
                citingModernIndices: [],
              },
            }));
          subBoxCandidates.push(...fallbackCandidates);
        }

        return {
          boxType: box.boxType ?? "PROBLEMATIZATION",
          subBoxDescription: subBox.description ?? "",
          subBox,
          thesisBoxId: subBox.thesisBoxId,
          candidates: subBoxCandidates,
          activeWorks,
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
