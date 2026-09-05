import { db } from "@/core/db";
import { boxes, sources, matrices } from "@/core/db/schema";
import { eq, inArray, count, and } from "drizzle-orm";
import { Logger, createFlowId } from "@/lib/logger";
import { sanitizeTargetedArticles } from "@/core/services/academic";
import type { CandidateSource, ExpansionResult } from "./types";
import { executeBackwardExpansion } from "./backward-expansion";
import { executeForwardExpansion } from "./forward-expansion";
import { executeLateralExpansion } from "./lateral-expansion";
import { persistExpansionResult } from "./expansion-persistence";
import { calculateTimelineMetrics } from "@/core/services/timeline/timeline-engine";

/**
 * Main orchestrator for Sub-Box automatic literature expansion.
 * Executes Tri-Directional expansion algorithm:
 * 1. Backward Expansion (Foundations / historical references) - Target: 1
 * 2. Forward Expansion (Successors / OpenAlex forward citations) - Target: 1
 * 3. Lateral Expansion (Conceptual peers / Semantic Scholar Recommendations API) - Target: 2 + shortfalls
 *
 * Enforces:
 * 1. Global Literature Source Ceiling (80 Master / 180 Doctorate).
 * 2. Academic Calendar Freeze Date (Literature frozen in Phase >= 2).
 * 3. Sub-Box thematic isolation using sibling box seed DOIs as negative seeds in S2.
 *
 * @param boxId - Sub-Box ID to expand literature for.
 * @returns ExpansionResult detailing previous and new active seed source IDs.
 */
export async function runLiteratureExpansion(
  boxId: number,
): Promise<ExpansionResult> {
  const flowId = createFlowId();
  const logger = new Logger(flowId);

  logger.info("literature_expansion_start", {
    service: "literature",
    status: "START",
    silentStart: true,
    data: { boxId },
  });

  // 1. Fetch box, matrix, and enforce global academic limits
  const boxRows = await db
    .select({
      id: boxes.id,
      matrixId: boxes.matrixId,
      activeSeedIds: boxes.activeSeedIds,
      expansionCycle: boxes.expansionCycle,
    })
    .from(boxes)
    .where(eq(boxes.id, boxId));

  const box = boxRows[0];
  if (!box) {
    logger.error("literature_expansion_box_not_found", {
      service: "literature",
      status: "FAILED",
      error: `Box with ID ${boxId} not found`,
    });
    throw new Error(`Box with ID ${boxId} not found.`);
  }

  // Load matrix for timeline and degree ceiling checks
  const matrixRows = await db
    .select()
    .from(matrices)
    .where(eq(matrices.id, box.matrixId));
  const userMatrix = matrixRows[0];

  if (userMatrix) {
    const totalSourcesRows = await db
      .select({ count: count() })
      .from(sources)
      .innerJoin(boxes, eq(sources.boxId, boxes.id))
      .where(eq(boxes.matrixId, userMatrix.id));
    const totalSourcesCount = Number(totalSourcesRows[0]?.count ?? 0);

    const readSourcesRows = await db
      .select({ count: count() })
      .from(sources)
      .innerJoin(boxes, eq(sources.boxId, boxes.id))
      .where(and(eq(boxes.matrixId, userMatrix.id), eq(sources.isRead, true)));
    const readSourcesCount = Number(readSourcesRows[0]?.count ?? 0);

    const timeline = calculateTimelineMetrics({
      startDate: userMatrix.createdAt,
      targetDate: userMatrix.targetCompletionDate,
      degree: userMatrix.thesisDegree,
      weeklyHours: userMatrix.weeklyTargetHours,
      currentSources: totalSourcesCount,
      readSources: readSourcesCount,
    });

    if (timeline.isSourceLimitReached) {
      const errorMsg = `Bu tez için belirlenen azami akademik kaynak tavanına (${timeline.maxSourceLimit} kaynak) ulaşıldı. Literatür doygunluğu sağlandığından yeni genişletme yapılamaz.`;
      logger.warn("literature_expansion_limit_reached", {
        service: "literature",
        status: "FAILED",
        error: errorMsg,
      });
      throw new Error(errorMsg);
    }

    if (timeline.isLiteratureFrozen) {
      const errorMsg = `Tez takviminizin ${timeline.currentPhase?.phaseNumber ?? 2}. aşamasındasınız (${timeline.currentPhase?.title ?? "Fişleme & Taslak"}). Bu aşamada literatür dondurulmuştur; lütfen mevcut kaynakları fişleyip tez planına bağlamaya odaklanın.`;
      logger.warn("literature_expansion_frozen_phase", {
        service: "literature",
        status: "FAILED",
        error: errorMsg,
      });
      throw new Error(errorMsg);
    }
  }

  let activeSeedIds = (box.activeSeedIds as number[]) ?? [];

  // Fallback: If activeSeedIds is empty, populate with first 4 sources in box
  if (activeSeedIds.length === 0) {
    const existingSources = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.boxId, boxId))
      .limit(4);

    activeSeedIds = existingSources.map((s) => s.id);
  }

  // Determine whether any active seed exposes a usable identifier for
  // forward expansion (OpenAlex). If not, only backward
  // expansion runs and every candidate must come from the parsed references.
  const seedIdentifierRows = await db
    .select({ doi: sources.doi, openalexId: sources.openalexId })
    .from(sources)
    .where(inArray(sources.id, activeSeedIds));

  const hasUsableIdentifiers = seedIdentifierRows.some(
    (s) => s.doi || s.openalexId,
  );

  // 2. Execute Tri-Directional Expansion (Backward, Forward, Lateral S2)
  // Target: 4 total candidates (1 Backward + 1 Forward + 2 Lateral S2)
  // When active seeds expose no usable identifiers, all 4 come from Backward.
  let allSelectedCandidates: CandidateSource[] = [];

  if (!hasUsableIdentifiers) {
    const backwardResult = await executeBackwardExpansion(
      boxId,
      activeSeedIds,
      4,
      logger,
    );
    allSelectedCandidates = backwardResult.selectedCandidates;
  } else {
    // 2a. Backward Expansion (Target: 1 foundational source)
    const backwardResult = await executeBackwardExpansion(
      boxId,
      activeSeedIds,
      1,
      logger,
    );
    const backwardShortfall = Math.max(
      0,
      1 - backwardResult.selectedCandidates.length,
    );

    // 2b. Forward Expansion via OpenAlex (Target: 1 citing source)
    const forwardCandidates = await executeForwardExpansion(
      boxId,
      activeSeedIds,
      1,
      logger,
    );
    const forwardShortfall = Math.max(0, 1 - forwardCandidates.length);

    // 2c. Lateral Expansion via Semantic Scholar Recommendations (Target: 2 + shortfalls)
    const lateralTarget = 2 + backwardShortfall + forwardShortfall;
    const lateralCandidates = await executeLateralExpansion(
      boxId,
      activeSeedIds,
      lateralTarget,
      logger,
    );

    allSelectedCandidates = [
      ...backwardResult.selectedCandidates,
      ...forwardCandidates,
      ...lateralCandidates,
    ];

    // Resilience: If still under quota of 4, attempt to fill remaining slots from Forward
    if (allSelectedCandidates.length < 4) {
      const remainingNeeded = 4 - allSelectedCandidates.length;
      const extraForward = await executeForwardExpansion(
        boxId,
        activeSeedIds,
        remainingNeeded,
        logger,
      );
      for (const ef of extraForward) {
        if (
          !allSelectedCandidates.some(
            (c) =>
              c.title.toLowerCase().trim() === ef.title.toLowerCase().trim(),
          )
        ) {
          allSelectedCandidates.push(ef);
          if (allSelectedCandidates.length >= 4) break;
        }
      }
    }
  }

  // Cap strictly at 4 candidates
  allSelectedCandidates = allSelectedCandidates.slice(0, 4);

  if (allSelectedCandidates.length === 0) {
    logger.error("literature_expansion_no_candidates", {
      service: "literature",
      status: "FAILED",
      error: "No candidates found for expansion",
    });
    throw new Error("Literatür genişletme için uygun yeni kaynak bulunamadı.");
  }

  // Sanitize titles & authors with Gemini Flash
  try {
    const sanitizeInput = allSelectedCandidates.map((c) => ({
      title: c.title,
      author: c.authors.join(", "),
    }));
    const sanitized = await sanitizeTargetedArticles(sanitizeInput, logger);
    for (let i = 0; i < allSelectedCandidates.length; i++) {
      const item = allSelectedCandidates[i];
      const clean = sanitized[i];
      if (clean) {
        item.title = clean.title.trim();
        item.authors = clean.author
          .split(", ")
          .map((a) => a.trim())
          .filter(Boolean);
      }
    }
  } catch (err) {
    logger.error("literature_expansion_sanitization_failed", {
      service: "literature",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("literature_db_write_start", {
    service: "literature",
    status: "START",
    data: { boxId, insertCount: allSelectedCandidates.length },
  });

  const nextCycle = (box.expansionCycle ?? 1) + 1;

  const insertedSources = await persistExpansionResult({
    boxId,
    nextCycle,
    previousActiveSeedIds: activeSeedIds,
    candidates: allSelectedCandidates,
  });

  const newActiveSeedIds = insertedSources.map((s) => s.id);

  logger.info("literature_db_write_success", {
    service: "literature",
    status: "SUCCESS",
    blank: "none",
    data: {
      boxId,
      insertedCount: insertedSources.length,
      nextCycle,
    },
  });

  logger.info("literature_expansion_success", {
    service: "literature",
    status: "SUCCESS",
    blank: "before",
    data: {
      boxId,
      newCycle: nextCycle,
      previousSeedCount: activeSeedIds.length,
      newSeedCount: newActiveSeedIds.length,
      insertedCount: insertedSources.length,
    },
  });

  return {
    boxId,
    expansionCycle: nextCycle,
    previousActiveSeedIds: activeSeedIds,
    newActiveSeedIds,
    addedSources: insertedSources.map((s, idx) => ({
      id: s.id,
      title: s.title,
      sourceOrigin: allSelectedCandidates[idx]?.sourceOrigin ?? "unknown",
    })),
  };
}
