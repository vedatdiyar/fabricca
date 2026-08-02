import type { RefMetadata } from "./literature-review-papers";
import { normalizeCleanTitle } from "@/lib/academic/utils";

/** A deduplicated cluster of references representing a single unique work. */
export interface Cluster {
  id: string;
  canonicalTitle: string;
  members: RefMetadata[];
  combinedFrequency: number;
  /** Kept for interface compatibility. */
  citingModernIndices: number[];
}

/**
 * Deduplicates references into clusters of unique works, sorted by combined citations.
 *
 * @param refMetadata - The reference metadata records to cluster.
 * @returns The deduplicated clusters sorted by combined citations.
 */
export function clusterRefMetadata(refMetadata: RefMetadata[]): Cluster[] {
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

      if (validRefs[j].id && validRefs[j].id === validRefs[i].id) {
        assigned.add(j);
        members.push(validRefs[j]);
        continue;
      }

      const normalizedJ = normalizeCleanTitle(validRefs[j].title);
      if (normalizedI === normalizedJ) {
        assigned.add(j);
        members.push(validRefs[j]);
        continue;
      }
    }

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
