import type { JuryArticle } from "@/lib/types";
import type { RawPaper } from "./literature-review-papers";
import type { Cluster } from "./clustering";
import { normalizeCleanTitle, extractOpenAlexId } from "@/lib/academic/utils";

interface QueueItem {
  subBoxTitle: string;
  boxType: string;
  boxDescription: string;
  candidates: {
    title: string;
    authors: string[];
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
 * Analyzes reference frequencies across active works and returns leader IDs for metadata fetch.
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
 * Scores candidates and selects up to 3 related articles, deduplicating titles globally.
 */
export function selectRelatedArticles(
  item: QueueItem,
  _topCluster: Cluster | null,
  assignedTitles?: Set<string>,
  foundationalTitle?: string,
): JuryArticle[] {
  const candidatePool = item.rawPapers.filter((p) => p.title?.trim());
  const normalizedFoundational = foundationalTitle
    ? normalizeCleanTitle(foundationalTitle)
    : "";

  const scoredCandidates = candidatePool
    .map((paper) => ({ paper, score: paper.relevanceScore }))
    .sort((a, b) => b.score - a.score);

  const selected: typeof scoredCandidates = [];

  for (const it of scoredCandidates) {
    const normTitle = normalizeCleanTitle(it.paper.title!);
    if (normTitle === normalizedFoundational) {
      continue;
    }
    if (assignedTitles && assignedTitles.has(normTitle)) {
      continue;
    }

    selected.push(it);
    if (selected.length === 3) break;
  }

  if (selected.length < 3) {
    for (const it of scoredCandidates) {
      const normTitle = normalizeCleanTitle(it.paper.title!);
      if (normTitle === normalizedFoundational) {
        continue;
      }
      if (
        selected.some((s) => normalizeCleanTitle(s.paper.title!) === normTitle)
      ) {
        continue;
      }

      selected.push(it);
      if (selected.length === 3) break;
    }
  }

  return selected.map(
    (it) =>
      ({
        title: it.paper.title!,
        comparisonNote: null,
        openalexId: extractOpenAlexId(it.paper.openAlexId),
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
