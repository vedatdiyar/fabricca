import { db } from "@/db";
import { boxes, matrices, sources } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { CandidateSource } from "./types";
import type { Logger } from "@/lib/logger";
import { fetchOpenAlexForwardCitations } from "./openalex-expansion-client";
import { fetchSemanticScholarRecommendations } from "./semantic-scholar-client";
import { rerankWithCohere } from "@/services/ai/cohere";

/**
 * Extended candidate representation carrying joint service presence flags.
 */
interface JointCandidate {
  candidate: CandidateSource;
  inOpenAlex: boolean;
  inSemanticScholar: boolean;
  isIntersected: boolean;
}

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
 * Executes forward expansion using parallel OpenAlex & Semantic Scholar fetching,
 * joint candidate intersection matching, and Cohere Rerank against the Thesis Matrix.
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

  if (box?.matrixId) {
    const matrixRows = await db
      .select({
        subjectProblem: matrices.subjectProblem,
        theoreticalFramework: matrices.theoreticalFramework,
      })
      .from(matrices)
      .where(eq(matrices.id, box.matrixId));

    const m = matrixRows[0];
    if (m) {
      thesisContextQuery += `. ${m.subjectProblem} ${m.theoreticalFramework}`;
    }
  }

  // 2. Fetch seed sources metadata
  const seedSources = await db
    .select({
      doi: sources.doi,
      openalexId: sources.openalexId,
    })
    .from(sources)
    .where(inArray(sources.id, activeSeedIds));

  const seedDois: string[] = [];
  const openAlexSeedIds: string[] = [];
  const s2PaperIds: string[] = [];

  for (const s of seedSources) {
    if (s.doi) {
      const cleanDoi = s.doi.replace("https://doi.org/", "").trim();
      seedDois.push(cleanDoi);
      s2PaperIds.push(`DOI:${cleanDoi}`);
    }
    if (s.openalexId) {
      openAlexSeedIds.push(s.openalexId);
    }
  }

  logger?.info("forward_expansion_start", {
    service: "literature",
    data: {
      boxId,
      targetCount,
      doiSeedCount: seedDois.length,
      openAlexSeedCount: openAlexSeedIds.length,
    },
  });

  // 3. Fetch existing sources in box to deduplicate
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

  // 4. Query OpenAlex & Semantic Scholar IN PARALLEL (No fallback, joint execution)
  const openAlexSeedQuery =
    openAlexSeedIds.length > 0 ? openAlexSeedIds : seedDois;

  const searchQueryText = box?.semanticQuery
    ? box.semanticQuery.substring(0, 150)
    : "Kurdish political movement Turkey";

  const [openAlexCandidates, s2Candidates] = await Promise.all([
    fetchOpenAlexForwardCitations(openAlexSeedQuery, searchQueryText, 50),
    fetchSemanticScholarRecommendations(s2PaperIds, 50),
  ]);

  // 5. Merge, intersect, and map candidate sources from both providers
  const jointCandidateMap = new Map<string, JointCandidate>();

  // Process OpenAlex candidates
  for (const c of openAlexCandidates) {
    if (!c.title || c.title.trim().length < 5) continue;
    const normTitle = normalizeTitle(c.title);
    if (existingTitles.has(normTitle)) continue;
    if (c.doi && existingDois.has(c.doi.toLowerCase().trim())) continue;

    jointCandidateMap.set(normTitle, {
      candidate: { ...c },
      inOpenAlex: true,
      inSemanticScholar: false,
      isIntersected: false,
    });
  }

  // Process Semantic Scholar candidates & find intersection matches
  for (const c of s2Candidates) {
    if (!c.title || c.title.trim().length < 5) continue;
    const normTitle = normalizeTitle(c.title);
    if (existingTitles.has(normTitle)) continue;
    if (c.doi && existingDois.has(c.doi.toLowerCase().trim())) continue;

    const existing = jointCandidateMap.get(normTitle);

    if (existing) {
      // INTERSECTION MATCH: Present in BOTH OpenAlex and Semantic Scholar!
      existing.inSemanticScholar = true;
      existing.isIntersected = true;
      if (!existing.candidate.doi && c.doi) existing.candidate.doi = c.doi;
      if (!existing.candidate.corpusId && c.corpusId)
        existing.candidate.corpusId = c.corpusId;
      if (!existing.candidate.pdfUrl && c.pdfUrl)
        existing.candidate.pdfUrl = c.pdfUrl;

      existing.candidate.influentialCitationCount = Math.max(
        existing.candidate.influentialCitationCount ?? 0,
        c.influentialCitationCount ?? 0,
      );
      existing.candidate.citationCount = Math.max(
        existing.candidate.citationCount ?? 0,
        c.citationCount ?? 0,
      );
      existing.candidate.sourceOrigin = "forward_openalex";
    } else {
      jointCandidateMap.set(normTitle, {
        candidate: { ...c },
        inOpenAlex: false,
        inSemanticScholar: true,
        isIntersected: false,
      });
    }
  }

  const jointCandidateList = Array.from(jointCandidateMap.values());

  if (jointCandidateList.length === 0) {
    logger?.info("forward_expansion_success", {
      service: "literature",
      blank: "none",
      data: { boxId, poolSize: 0, selectedCount: 0, reason: "empty_pool" },
    });
    return [];
  }

  let selectedCandidates: CandidateSource[] = [];
  let rerankUsed = false;

  // 6. Rerank joint candidate pool using Cohere Rerank v4.0 Pro
  if (process.env.COHERE_API_KEY) {
    try {
      const documents = jointCandidateList.map(
        (item) =>
          `${item.candidate.title}. Yazar: ${item.candidate.authors.join(", ")}. Yayıncı: ${item.candidate.publisher ?? ""}`,
      );

      const rerankResults = await rerankWithCohere({
        query: thesisContextQuery.substring(0, 4000),
        documents,
      });

      // Apply intersection boost to rerank score for candidates present in BOTH services
      const scoredList = rerankResults.map((res) => {
        const item = jointCandidateList[res.index];
        // Give 25% boost to papers appearing in BOTH OpenAlex and Semantic Scholar
        const boostMultiplier = item.isIntersected ? 1.25 : 1.0;
        const finalScore = res.relevanceScore * boostMultiplier;

        return {
          candidate: {
            ...item.candidate,
            relevanceScore: Number(finalScore.toFixed(4)),
          },
          finalScore,
          isIntersected: item.isIntersected,
        };
      });

      scoredList.sort((a, b) => b.finalScore - a.finalScore);

      selectedCandidates = scoredList
        .slice(0, targetCount)
        .map((s) => s.candidate);
      rerankUsed = true;
    } catch {
      // Fallback to sorting by intersection and citation count if Cohere is offline
    }
  }

  if (!rerankUsed) {
    // Pure intersection & citation count ranking fallback
    jointCandidateList.sort((a, b) => {
      if (a.isIntersected !== b.isIntersected) {
        return a.isIntersected ? -1 : 1;
      }
      return (
        (b.candidate.citationCount ?? 0) - (a.candidate.citationCount ?? 0)
      );
    });

    selectedCandidates = jointCandidateList
      .slice(0, targetCount)
      .map((item) => item.candidate);
  }

  logger?.info("forward_expansion_success", {
    service: "literature",
    blank: "none",
    data: {
      boxId,
      openAlexCandidates: openAlexCandidates.length,
      s2Candidates: s2Candidates.length,
      intersected: jointCandidateList.filter((i) => i.isIntersected).length,
      poolSize: jointCandidateList.length,
      rerank: rerankUsed ? "cohere" : "fallback",
      selectedCount: selectedCandidates.length,
    },
  });

  return selectedCandidates;
}
