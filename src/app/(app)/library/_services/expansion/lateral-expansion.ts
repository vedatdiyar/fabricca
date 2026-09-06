import { db } from "@/core/db";
import { boxes, sources } from "@/core/db/schema";
import { eq, inArray, and, ne } from "drizzle-orm";
import type { CandidateSource } from "./types";
import type { Logger } from "@/lib/logger";
import { fetchSemanticScholarRecommendations } from "./semanticscholar-expansion-client";
import { rerankWithCohere } from "@/core/services/ai/cohere";

/**
 * Normalizes a title string for deduplication.
 *
 * @param title - Title string.
 * @returns Normalized title string.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Extracts the numeric OpenAlex work id for MAG lookup.
 *
 * @param openalexId - Raw OpenAlex id or URL.
 * @returns Numeric id string, or null when unparseable.
 */
function extractOpenAlexNumericId(openalexId: string): string | null {
  const match = openalexId.trim().match(/W(\d+)\s*$/i);
  return match?.[1] ? match[1] : null;
}

/**
 * Executes lateral literature expansion using Semantic Scholar Recommendations API v1.0
 * with positive active seeds and optional negative sibling box seeds, followed by
 * Cohere Rerank v4.0 against the Sub-Box thematic context.
 *
 * @param boxId - Target Sub-Box ID.
 * @param activeSeedIds - IDs of the active seed sources.
 * @param targetCount - Number of lateral candidates required.
 * @param logger - Optional structured logger.
 * @param negativeSeedDois - Optional explicit negative seed DOIs (e.g. from sibling boxes).
 * @returns Array of selected CandidateSource items.
 */
export async function executeLateralExpansion(
  boxId: number,
  activeSeedIds: number[],
  targetCount: number,
  logger?: Logger,
  negativeSeedDois?: string[],
): Promise<CandidateSource[]> {
  if (targetCount <= 0 || activeSeedIds.length === 0) {
    return [];
  }

  // 1. Fetch box information and linked Thesis Matrix
  const boxRows = await db
    .select({
      id: boxes.id,
      title: boxes.title,
      description: boxes.description,
      matrixId: boxes.matrixId,
    })
    .from(boxes)
    .where(eq(boxes.id, boxId));

  const box = boxRows[0];
  let thesisContextQuery = box?.title ?? "";
  if (box?.description) {
    thesisContextQuery += `. ${box.description}`;
  }

  // 2. Fetch seed source identities (hydrated S2 id first, then DOI, then MAG numeric id)
  const seedSources = await db
    .select({
      id: sources.id,
      doi: sources.doi,
      openalexId: sources.openalexId,
      semanticScholarId: sources.semanticScholarId,
      title: sources.title,
    })
    .from(sources)
    .where(inArray(sources.id, activeSeedIds));

  const positiveIds: string[] = [];
  for (const s of seedSources) {
    const hydrated = s.semanticScholarId?.trim();
    if (hydrated && hydrated.length > 4) {
      positiveIds.push(hydrated);
      continue;
    }
    const doi = s.doi?.trim();
    if (doi && doi.length > 5) {
      positiveIds.push(doi.startsWith("DOI:") ? doi : `DOI:${doi}`);
      continue;
    }
    const numericId = s.openalexId
      ? extractOpenAlexNumericId(s.openalexId)
      : null;
    if (numericId) {
      positiveIds.push(`MAG:${numericId}`);
    }
  }

  if (positiveIds.length === 0) {
    logger?.info("lateral_expansion_skipped_no_seed_ids", {
      service: "literature",
      hidden: true,
      data: { boxId, reason: "no_usable_seed_ids" },
    });
    return [];
  }

  // 3. Collect negative seed DOIs from sibling boxes if not explicitly provided
  let negativeDois = negativeSeedDois;
  if (!negativeDois && box?.matrixId) {
    try {
      const siblingSources = await db
        .select({ doi: sources.doi })
        .from(sources)
        .innerJoin(boxes, eq(sources.boxId, boxes.id))
        .where(
          and(
            eq(boxes.matrixId, box.matrixId),
            ne(boxes.id, boxId),
          ),
        )
        .limit(20);

      negativeDois = siblingSources
        .map((s) => s.doi?.trim())
        .filter((d): d is string => Boolean(d && d.length > 5));
    } catch {
      negativeDois = [];
    }
  }

  // 4. Collect existing box source titles and DOIs to prevent re-expansion duplication
  const existingBoxSources = await db
    .select({
      title: sources.title,
      doi: sources.doi,
    })
    .from(sources)
    .where(eq(sources.boxId, boxId));

  const existingTitles = new Set(
    existingBoxSources.map((s) => normalizeTitle(s.title)),
  );
  const existingDois = new Set(
    existingBoxSources.map((s) => s.doi?.toLowerCase().trim()).filter(Boolean),
  );

  // 5. Query Semantic Scholar Recommendations API
  const s2Candidates = await fetchSemanticScholarRecommendations({
    positiveIds,
    negativeIds: negativeDois ?? [],
    limit: 50,
  });

  // 6. Deduplicate candidates against existing sources
  const candidateMap = new Map<string, CandidateSource>();

  for (const c of s2Candidates) {
    if (!c.title || c.title.trim().length < 5) continue;
    const normTitle = normalizeTitle(c.title);
    if (existingTitles.has(normTitle)) continue;
    if (c.doi && existingDois.has(c.doi.toLowerCase().trim())) continue;

    candidateMap.set(normTitle, { ...c });
  }

  const candidateList = Array.from(candidateMap.values());

  if (candidateList.length === 0) {
    logger?.info("lateral_expansion_success", {
      service: "literature",
      hidden: true,
      blank: "none",
      data: { boxId, poolSize: 0, selectedCount: 0, reason: "empty_pool" },
    });
    return [];
  }

  let selectedCandidates: CandidateSource[] = [];
  let rerankUsed = false;

  // 7. Rerank candidate pool using Cohere Rerank v4.0 Pro
  if (process.env.COHERE_API_KEY) {
    try {
      const documents = candidateList.map(
        (c) =>
          `${c.title}. Yazar: ${c.authors.join(", ")}. Yayıncı: ${c.publisher ?? ""}`,
      );

      const rerankResults = await rerankWithCohere({
        query: thesisContextQuery.substring(0, 4000),
        documents,
      });

      const scoredList = rerankResults.map((res) => {
        const item = candidateList[res.index];
        const finalScore = res.relevanceScore;

        return {
          candidate: {
            ...item,
            relevanceScore: Number(finalScore.toFixed(4)),
          },
          finalScore,
        };
      });

      scoredList.sort((a, b) => b.finalScore - a.finalScore);

      selectedCandidates = scoredList
        .slice(0, targetCount)
        .map((s) => s.candidate);
      rerankUsed = true;
    } catch {
      // Fallback to sorting by influential citations if Cohere is offline
    }
  }

  if (!rerankUsed) {
    candidateList.sort((a, b) => {
      const scoreA =
        (a.influentialCitationCount ?? 0) * 5 + (a.citationCount ?? 0);
      const scoreB =
        (b.influentialCitationCount ?? 0) * 5 + (b.citationCount ?? 0);
      return scoreB - scoreA;
    });
    selectedCandidates = candidateList.slice(0, targetCount);
  }

  logger?.info("lateral_expansion_success", {
    service: "literature",
    hidden: true,
    blank: "none",
    data: {
      boxId,
      s2RawCount: s2Candidates.length,
      poolSize: candidateList.length,
      rerank: rerankUsed ? "cohere" : "influential_citations",
      selectedCount: selectedCandidates.length,
    },
  });

  return selectedCandidates;
}
