/**
 * Intellectual clustering for the OpenAlex reverse-citation pipeline.
 * Groups references by primary author surname and Jaccard similarity (>70%).
 */

import type { RefMetadata } from "./literature-review-papers";
import {
  tokenizeTitle,
  jaccardSimilarity,
  extractPrimarySurname,
} from "./normalization";

export interface Cluster {
  surname: string;
  members: RefMetadata[];
  combinedFrequency: number;
  citingModernIndices: number[];
}

/**
 * Groups reference metadata by primary surname and clusters them using
 * Jaccard similarity (>70%). Returns clusters sorted by combined frequency
 * (descending).
 *
 * @param refMetadata - Full metadata for candidate references
 * @param refToModernIdx - Map from reference ID → modern work indices
 * @returns Sorted clusters of co-cited works
 */
export function clusterRefMetadata(
  refMetadata: RefMetadata[],
  refToModernIdx: Map<string, number[]>,
): Cluster[] {
  const validRefs = refMetadata.filter(
    (ref) => ref.title?.trim() && ref.authors.length > 0,
  );

  const surnameGroups = new Map<string, RefMetadata[]>();
  for (const ref of validRefs) {
    const surname = extractPrimarySurname(ref.authors);
    if (!surname) continue;
    if (!surnameGroups.has(surname)) {
      surnameGroups.set(surname, []);
    }
    surnameGroups.get(surname)!.push(ref);
  }

  const clusters: Cluster[] = [];
  for (const [surname, refs] of surnameGroups) {
    if (refs.length < 2) {
      const singleId = refs[0].id;
      const modernIdxs = refToModernIdx.get(singleId) ?? [];
      clusters.push({
        surname,
        members: [refs[0]],
        combinedFrequency: new Set(modernIdxs).size,
        citingModernIndices: [...new Set(modernIdxs)],
      });
      continue;
    }

    const assigned = new Set<number>();
    const localClusters: {
      members: RefMetadata[];
      indices: Set<number>;
    }[] = [];

    for (let i = 0; i < refs.length; i++) {
      if (assigned.has(i)) continue;
      assigned.add(i);

      const clusterMembers: RefMetadata[] = [refs[i]];
      const clusterModernIdxs = new Set<number>(
        refToModernIdx.get(refs[i].id) ?? [],
      );

      for (let j = i + 1; j < refs.length; j++) {
        if (assigned.has(j)) continue;

        const tokensA = tokenizeTitle(refs[i].title);
        const tokensB = tokenizeTitle(refs[j].title);
        const sim = jaccardSimilarity(tokensA, tokensB);

        if (sim > 0.7) {
          assigned.add(j);
          clusterMembers.push(refs[j]);
          for (const idx of refToModernIdx.get(refs[j].id) ?? []) {
            clusterModernIdxs.add(idx);
          }
        }
      }

      localClusters.push({
        members: clusterMembers,
        indices: clusterModernIdxs,
      });
    }

    for (const lc of localClusters) {
      clusters.push({
        surname,
        members: lc.members,
        combinedFrequency: lc.indices.size,
        citingModernIndices: [...lc.indices],
      });
    }
  }

  clusters.sort((a, b) => b.combinedFrequency - a.combinedFrequency);
  return clusters;
}
