/**
 * Deduplication-only clustering for the literature pipeline.
 *
 * Instead of co-citation analysis, this identifies the same work across
 * different OpenAlex IDs or title variations and merges them into clusters.
 * Each cluster represents a unique work.
 */

import type { RefMetadata } from "./literature-review-papers";
import { normalizeCleanTitle } from "@/lib/academic/utils";

export interface Cluster {
  /** Primary OpenAlex ID of the canonical work */
  id: string;
  /** Normalized title used for matching */
  canonicalTitle: string;
  /** All deduplicated members (same work, different IDs/title variations) */
  members: RefMetadata[];
  /** Combined citedByCount of the best member */
  combinedFrequency: number;
  /** Modern work indices — for interface compatibility */
  citingModernIndices: number[];
}

/**
 * Deduplicates reference metadata: groups the same work (identified by
 * normalized title similarity > 80% or matching OpenAlex IDs) into a single
 * cluster. Returns clusters sorted by combined citedByCount descending.
 *
 * @param refMetadata - Full metadata for candidate references
 * @param _refToModernIdx - Ignored (interface compatibility kept)
 * @returns Sorted clusters of unique works
 */
export function clusterRefMetadata(
  refMetadata: RefMetadata[],
  _refToModernIdx?: Map<string, number[]>,
): Cluster[] {
  const validRefs = refMetadata.filter(
    (ref) => ref.title?.trim() && ref.authors.length > 0,
  );

  const clusters: Cluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < validRefs.length; i++) {
    if (assigned.has(i)) continue;
    assigned.add(i);

    const members: RefMetadata[] = [validRefs[i]];
    const normalizedI = normalizeCleanTitle(validRefs[i].title);

    for (let j = i + 1; j < validRefs.length; j++) {
      if (assigned.has(j)) continue;

      // Same OpenAlex ID → definitely same work
      if (validRefs[j].id && validRefs[j].id === validRefs[i].id) {
        assigned.add(j);
        members.push(validRefs[j]);
        continue;
      }

      // Normalized title match → same work
      const normalizedJ = normalizeCleanTitle(validRefs[j].title);
      if (normalizedI === normalizedJ) {
        assigned.add(j);
        members.push(validRefs[j]);
        continue;
      }
    }

    // Sort members by citedByCount descending; pick best as canonical
    members.sort((a, b) => (b.citedByCount ?? 0) - (a.citedByCount ?? 0));
    const best = members[0];
    const totalCitations = members.reduce(
      (sum, m) => sum + (m.citedByCount ?? 0),
      0,
    );

    clusters.push({
      id: best.id,
      canonicalTitle: normalizedI,
      members,
      combinedFrequency: totalCitations,
      citingModernIndices: [],
    });
  }

  clusters.sort((a, b) => b.combinedFrequency - a.combinedFrequency);
  return clusters;
}
