import { db } from "@/db";
import { sources, chunks, type ParsedReference } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { CandidateSource } from "./types";

export interface BackwardExpansionResult {
  selectedCandidates: CandidateSource[];
  shortfall: number;
}

/**
 * Normalizes a title for comparison and duplicate detection.
 *
 * @param title - Raw title string.
 * @returns Cleaned lowercase title string.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Executes backward expansion for a box based on in-text citation frequency.
 *
 * @param boxId - Target Sub-Box ID.
 * @param activeSeedIds - List of active seed source IDs for the box.
 * @param requiredCount - Desired number of backward sources (default 2).
 * @returns BackwardExpansionResult containing selected candidates and any shortfall.
 */
export async function executeBackwardExpansion(
  boxId: number,
  activeSeedIds: number[],
  requiredCount = 2,
): Promise<BackwardExpansionResult> {
  if (activeSeedIds.length === 0) {
    return { selectedCandidates: [], shortfall: requiredCount };
  }

  // 1. Fetch active seed sources
  const seedSources = await db
    .select()
    .from(sources)
    .where(inArray(sources.id, activeSeedIds));

  if (seedSources.length === 0) {
    return { selectedCandidates: [], shortfall: requiredCount };
  }

  // 2. Fetch all existing sources in the box to prevent duplicate additions
  const existingBoxSources = await db
    .select({ title: sources.title, doi: sources.doi })
    .from(sources)
    .where(eq(sources.boxId, boxId));

  const existingTitles = new Set(
    existingBoxSources.map((s) => normalizeTitle(s.title)),
  );
  const existingDois = new Set(
    existingBoxSources.map((s) => s.doi?.toLowerCase().trim()).filter(Boolean),
  );

  // 3. Fetch chunks content for active seed sources to compute in-text citation frequency
  const seedChunks = await db
    .select({ content: chunks.content })
    .from(chunks)
    .where(inArray(chunks.sourceId, activeSeedIds));

  const combinedChunksText = seedChunks.map((c) => c.content).join("\n\n");

  // 4. Collect and aggregate parsed references across the 4 active seed sources
  const referenceFrequencyMap = new Map<
    string,
    {
      ref: ParsedReference;
      frequency: number;
      normTitle: string;
    }
  >();

  for (const source of seedSources) {
    const parsedList = (source.parsedReferences as ParsedReference[]) ?? [];

    for (const ref of parsedList) {
      if (!ref.title || ref.title.trim().length < 5) continue;

      const normTitle = normalizeTitle(ref.title);

      // Skip if already in box by title or DOI
      if (existingTitles.has(normTitle)) continue;
      if (ref.title && existingDois.has(ref.title.toLowerCase().trim()))
        continue;

      if (!referenceFrequencyMap.has(normTitle)) {
        // Calculate in-text citation frequency
        let frequency = 0;

        // Pattern 1: Author surname matching
        const primaryAuthor = ref.authors?.[0]?.name;
        if (primaryAuthor) {
          const surname = primaryAuthor.split(" ").pop() ?? primaryAuthor;
          if (surname.length > 2) {
            const authorRegex = new RegExp(`\\b${surname}\\b`, "gi");
            const matches = combinedChunksText.match(authorRegex);
            if (matches) frequency += matches.length;
          }
        }

        // Pattern 2: Title substring matching if distinct enough
        const titleSnippet = ref.title.substring(0, 30).trim();
        if (titleSnippet.length > 10) {
          const snippetRegex = new RegExp(
            titleSnippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi",
          );
          const snippetMatches = combinedChunksText.match(snippetRegex);
          if (snippetMatches) frequency += snippetMatches.length * 2;
        }

        referenceFrequencyMap.set(normTitle, {
          ref,
          frequency,
          normTitle,
        });
      }
    }
  }

  // 5. Sort candidates by frequency (descending), then publication year (descending)
  const candidatePool = Array.from(referenceFrequencyMap.values()).sort(
    (a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return (b.ref.year ?? 0) - (a.ref.year ?? 0);
    },
  );

  // 6. Select top requiredCount candidates
  const selectedList = candidatePool.slice(0, requiredCount);

  const selectedCandidates: CandidateSource[] = selectedList.map(
    (item): CandidateSource => {
      const authors = item.ref.authors.map((a) => a.name).filter(Boolean);

      return {
        title: item.ref.title ?? "Untitled Reference",
        authors: authors.length > 0 ? authors : ["Unknown Author"],
        publisher: item.ref.publisher ?? item.ref.containerTitle ?? undefined,
        publicationYear: item.ref.year ?? undefined,
        relevanceScore: item.frequency,
        sourceOrigin: "backward",
        rawParsedRef: item.ref.raw,
      };
    },
  );

  const shortfall = requiredCount - selectedCandidates.length;

  return {
    selectedCandidates,
    shortfall: Math.max(0, shortfall),
  };
}
