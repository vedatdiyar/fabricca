import { db } from "@/core/db";
import { boxes, sources, matrices } from "@/core/db/schema";
import { eq, inArray, count, and } from "drizzle-orm";
import { Logger, createFlowId } from "@/lib/logger";
import { sanitizeTargetedArticles } from "@/core/services/academic";
import type { ExpansionResult } from "./types";
import { executeBackwardExpansion } from "./backward-expansion";
import { executeForwardExpansion } from "./forward-expansion";
import { persistExpansionResult } from "./expansion-persistence";
import { calculateTimelineMetrics } from "@/core/services/timeline/timeline-engine";

/**
 * Main orchestrator for Sub-Box automatic literature expansion.
 * Executes backward + forward expansion algorithm, inserts new sources into DB,
 * updates box activeSeedIds, and increments expansionCycle. When the active seed
 * sources expose no usable identifiers (DOI / OpenAlex ID), only backward
 * expansion runs and all candidates come from the parsed reference lists.
 *
 * Enforces:
 * 1. Global Literature Source Ceiling (80 Master / 180 Doctorate).
 * 2. Academic Calendar Freeze Date (Literature frozen in Phase >= 2).
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

  // 2. Execute Backward Expansion (Target: 2, or 4 when no usable identifiers)
  const backwardResult = await executeBackwardExpansion(
    boxId,
    activeSeedIds,
    hasUsableIdentifiers ? 2 : 4,
    logger,
  );

  // 3. Execute Forward Expansion (Target: 2 + backward shortfall) only when seeds
  // carry usable identifiers; otherwise all sources must come from backward.
  const forwardCandidates = hasUsableIdentifiers
    ? await executeForwardExpansion(
        boxId,
        activeSeedIds,
        2 + backwardResult.shortfall,
        logger,
      )
    : [];

  // Combine candidates (Total target: 4)
  const allSelectedCandidates = [
    ...backwardResult.selectedCandidates,
    ...forwardCandidates,
  ];

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
