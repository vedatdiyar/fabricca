/**
 * Candidate analysis and article selection for the literature pipeline.
 */

import type { JuryArticle } from "@/lib/types";
import type { RawPaper } from "./literature-review-papers";
import type { Cluster } from "./clustering";

interface QueueItem {
  subBoxTitle: string;
  boxType: string;
  boxDescription: string;
  candidates: {
    title: string;
    authors: string;
    year: number | null;
    openAlexId: string;
    doi: string | null;
    publisher: string | null;
    cluster: Cluster;
  }[];
  activeWorks: RawPaper[];
  rawPapers: RawPaper[];
}

export interface AnalyzeResult {
  leaderIds: string[];
  refToModernIdx: Map<string, number[]>;
}

/**
 * Analyzes reference frequencies across active works and identifies
 * leader IDs for batch metadata fetch.
 *
 * @param activeWorks - Works with populated referencedWorks
 * @param N - Number of active works (passed separately for clarity)
 * @returns Leader IDs and reference-to-modern-index mapping
 */
export function analyzeReferenceFrequencies(
  activeWorks: RawPaper[],
  N: number,
): AnalyzeResult {
  const refToModernIdx = new Map<string, number[]>();

  for (let mi = 0; mi < N; mi++) {
    const refs = activeWorks[mi].referencedWorks || [];
    for (const refId of refs) {
      if (!refToModernIdx.has(refId)) {
        refToModernIdx.set(refId, []);
      }
      refToModernIdx.get(refId)!.push(mi);
    }
  }

  const refFrequencies = new Map<string, number>();
  for (const refId of refToModernIdx.keys()) {
    refFrequencies.set(refId, 0);
  }
  for (let mi = 0; mi < N; mi++) {
    const refs = activeWorks[mi].referencedWorks || [];
    for (const refId of refs) {
      if (refFrequencies.has(refId)) {
        refFrequencies.set(refId, refFrequencies.get(refId)! + 1);
      }
    }
  }

  let maxFreq = 0;
  for (const freq of refFrequencies.values()) {
    if (freq > maxFreq) maxFreq = freq;
  }

  let leaderIds: string[] = [];
  if (maxFreq >= 3) {
    for (const [refId, freq] of refFrequencies.entries()) {
      if (freq === maxFreq || freq === maxFreq - 1) {
        leaderIds.push(refId);
      }
    }
  } else if (maxFreq === 2) {
    for (const [refId, freq] of refFrequencies.entries()) {
      if (freq === 2) {
        leaderIds.push(refId);
      }
    }
  } else {
    const fallbackIds = new Set<string>();
    const fallbackLimit = Math.min(N, 3);
    for (let mi = 0; mi < fallbackLimit; mi++) {
      const refs = activeWorks[mi].referencedWorks || [];
      for (const refId of refs) {
        fallbackIds.add(refId);
      }
    }
    leaderIds = Array.from(fallbackIds);
  }

  return { leaderIds, refToModernIdx };
}

/**
 * Scores and selects the top 3 related articles from the candidate pool,
 * preferring works that cite the top cluster.
 *
 * @param item - The sub-box queue item with active works and raw papers
 * @param topCluster - The top co-citation cluster (may be null)
 * @returns Up to 3 JuryArticle entries sorted by relevance
 */
export function selectRelatedArticles(
  item: QueueItem,
  topCluster: Cluster | null,
): JuryArticle[] {
  let candidatePool =
    item.activeWorks.length > 0 ? item.activeWorks : item.rawPapers;
  candidatePool = candidatePool.filter((p) => p.title?.trim());

  const topClusterMemberIds = new Set(
    topCluster?.members.map((m) => m.id) ?? [],
  );

  const scoredCandidates = candidatePool.map((paper) => {
    const citesFoundational = topCluster
      ? (paper.referencedWorks || []).some((refId) =>
          topClusterMemberIds.has(refId),
        )
      : false;

    const score =
      0.7 * paper.relevanceScore + 0.3 * (citesFoundational ? 1.0 : 0.0);
    return { paper, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  return scoredCandidates.slice(0, 3).map(
    (it) =>
      ({
        title: it.paper.title!,
        comparisonNote: null,
        badge: null,
        url: it.paper.openAlexId ?? "",
        doi: it.paper.doi,
        publisher: null,
        publicationYear: null,
        authors: it.paper.authors,
        isFoundational: false,
        relevanceScore: Math.round(it.score * 100),
      }) as JuryArticle,
  );
}

export type { QueueItem };
