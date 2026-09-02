import { db } from "@/core/db";
import { boxes, sources } from "@/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { CandidateSource } from "./types";
import type { Logger } from "@/lib/logger";
import { fetchOpenAlexForwardCitations } from "./openalex-expansion-client";
import { rerankWithCohere } from "@/core/services/ai/cohere";
import { parseDualSemanticQuery } from "@/lib/academic/utils";

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
 * Executes forward expansion using OpenAlex forward citation fetching
 * and Cohere Rerank against the Thesis Matrix.
 *
 * @param boxId - Target Sub-Box ID.
 * @param activeSeedIds - List of active seed source IDs.
 * @param targetCount - Number of forward candidates required (2 + shortfall).
 * @param logger - Optional logger for structured event tracking.
 * @returns Array of selected CandidateSource items.
 */
export async function executeForwardExpansion(
  boxId: number,
  activeSeedIds: number[],
  targetCount: number,
  logger?: Logger,
): Promise<CandidateSource[]> {
  if (targetCount <= 0 || activeSeedIds.length === 0) return [];

  // 1. Fetch box information and linked Thesis Matrix
  const boxRows = await db
    .select({
      id: boxes.id,
      title: boxes.title,
      description: boxes.description,
      semanticQuery: boxes.semanticQuery,
      concepts: boxes.concepts,
      matrixId: boxes.matrixId,
    })
    .from(boxes)
    .where(eq(boxes.id, boxId));

  const box = boxRows[0];

  let thesisContextQuery = box?.title ?? "";
  if (box?.description) {
    thesisContextQuery += `. ${box.description}`;
  }

  // 2. Fetch seed sources metadata (DOIs and OpenAlex IDs)
  const seedSources = await db
    .select({
      id: sources.id,
      doi: sources.doi,
      openalexId: sources.openalexId,
      title: sources.title,
    })
    .from(sources)
    .where(inArray(sources.id, activeSeedIds));

  const seedDois = seedSources
    .map((s) => s.doi?.trim())
    .filter((d): d is string => Boolean(d && d.length > 5));

  const openAlexSeedIds = seedSources
    .map((s) => s.openalexId?.trim())
    .filter((id): id is string => Boolean(id && id.length > 3));

  // 3. Collect existing box source titles and DOIs to prevent re-expansion duplication
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

  // 4. Query OpenAlex Forward Citations
  const openAlexSeedQuery =
    openAlexSeedIds.length > 0 ? openAlexSeedIds : seedDois;

  const parsedDualQuery = parseDualSemanticQuery(box?.semanticQuery);
  const searchQueryText =
    parsedDualQuery.openAlexQuery.substring(0, 150) ||
    thesisContextQuery.substring(0, 150) ||
    "academic research literature";

  const openAlexCandidates = await fetchOpenAlexForwardCitations(
    openAlexSeedQuery,
    searchQueryText,
    60,
  );

  // 5. Deduplicate candidates against existing sources
  const candidateMap = new Map<string, CandidateSource>();

  for (const c of openAlexCandidates) {
    if (!c.title || c.title.trim().length < 5) continue;
    const normTitle = normalizeTitle(c.title);
    if (existingTitles.has(normTitle)) continue;
    if (c.doi && existingDois.has(c.doi.toLowerCase().trim())) continue;

    candidateMap.set(normTitle, { ...c });
  }

  const candidateList = Array.from(candidateMap.values());

  if (candidateList.length === 0) {
    logger?.info("forward_expansion_success", {
      service: "literature",
      hidden: true,
      blank: "none",
      data: { boxId, poolSize: 0, selectedCount: 0, reason: "empty_pool" },
    });
    return [];
  }

  let selectedCandidates: CandidateSource[] = [];
  let rerankUsed = false;

  // 6. Rerank candidate pool using Cohere Rerank v4.0 Pro
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
      // Fallback to sorting by citation count if Cohere is offline
    }
  }

  if (!rerankUsed) {
    candidateList.sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
    selectedCandidates = candidateList.slice(0, targetCount);
  }

  logger?.info("forward_expansion_success", {
    service: "literature",
    hidden: true,
    blank: "none",
    data: {
      boxId,
      openAlexCandidates: openAlexCandidates.length,
      poolSize: candidateList.length,
      rerank: rerankUsed ? "cohere" : "fallback",
      selectedCount: selectedCandidates.length,
    },
  });

  return selectedCandidates;
}
