import type { ParsedReference } from "@/services/pdf/parsed-reference";
import type { CandidateSource } from "./types";
import { normKey } from "./fuzzy-dedup";

/** A single co-citation entry keyed by normalized title across the seed pool. */
export interface CoCitationEntry {
  ref: ParsedReference;
  coCitationCount: number;
  seedTitles: string[];
}

/**
 * Aggregates parsed references across all seed sources into a co-citation map,
 * keyed by normalized title. A single seed listing the same work twice only
 * counts once.
 *
 * @param seedSources - The active seed source rows.
 * @returns Map of normalized title → co-citation entry.
 */
export function aggregateCoCitations(
  seedSources: Array<{ title: string; parsedReferences: unknown }>,
): Map<string, CoCitationEntry> {
  const coCitationMap = new Map<string, CoCitationEntry>();

  for (const seed of seedSources) {
    const parsedList = (seed.parsedReferences as ParsedReference[]) ?? [];
    const seenInThisSeed = new Set<string>();

    for (const ref of parsedList) {
      if (!ref.title || ref.title.trim().length < 5) continue;

      const key = normKey(ref.title);
      if (!key) continue;
      if (seenInThisSeed.has(key)) continue;
      seenInThisSeed.add(key);

      const existing = coCitationMap.get(key);
      if (existing) {
        existing.coCitationCount += 1;
        existing.seedTitles.push(seed.title);
      } else {
        coCitationMap.set(key, {
          ref,
          coCitationCount: 1,
          seedTitles: [seed.title],
        });
      }
    }
  }

  return coCitationMap;
}

/**
 * Ranks the co-citation map into a CandidateSource array, ordered by
 * co-citation count (primary) then publication year descending (secondary).
 *
 * @param coCitationMap - The aggregated co-citation map.
 * @returns Ranked backward candidates.
 */
export function toRankedCandidates(
  coCitationMap: Map<string, CoCitationEntry>,
): CandidateSource[] {
  const sorted = Array.from(coCitationMap.values()).sort((a, b) => {
    if (b.coCitationCount !== a.coCitationCount) {
      return b.coCitationCount - a.coCitationCount;
    }
    return (b.ref.year ?? 0) - (a.ref.year ?? 0);
  });

  return sorted.map((item) => {
    const authors = item.ref.authors.map((a) => a.name).filter(Boolean);
    return {
      title: item.ref.title ?? "Untitled Reference",
      authors: authors.length > 0 ? authors : ["Unknown Author"],
      publisher: item.ref.publisher ?? item.ref.containerTitle ?? undefined,
      publicationYear: item.ref.year ?? undefined,
      relevanceScore: item.coCitationCount,
      sourceOrigin: "backward",
      rawParsedRef: item.ref.raw,
    };
  });
}
