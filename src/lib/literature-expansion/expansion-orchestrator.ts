import { db } from "@/db";
import { boxes, sources, type NewSource } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Logger, createFlowId } from "@/lib/logger";
import type { ExpansionResult } from "./types";
import { executeBackwardExpansion } from "./backward-expansion";
import { executeForwardExpansion } from "./forward-expansion";

/**
 * Main orchestrator for Sub-Box automatic literature expansion.
 * Executes 2 backward + 2 forward expansion algorithm, inserts new sources into DB,
 * updates box activeSeedIds, and increments expansionCycle.
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
    data: { boxId },
  });

  // 1. Fetch box and current activeSeedIds
  const boxRows = await db
    .select({
      id: boxes.id,
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

  // 2. Execute Backward Expansion (Target: 2)
  const backwardResult = await executeBackwardExpansion(
    boxId,
    activeSeedIds,
    2,
  );

  // 3. Execute Forward Expansion (Target: 2 + backward shortfall)
  const forwardTargetCount = 2 + backwardResult.shortfall;

  const forwardCandidates = await executeForwardExpansion(
    boxId,
    activeSeedIds,
    forwardTargetCount,
  );

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

  // 4. Insert selected candidates into sources table
  const newSourceRecords: NewSource[] = allSelectedCandidates.map((c) => ({
    boxId,
    title: c.title,
    authors: c.authors,
    publisher: c.publisher,
    publicationYear: c.publicationYear,
    doi: c.doi,
    openalexId: c.openalexId,
    relevanceScore: c.relevanceScore,
    isRead: false,
    isFoundational: c.isFoundational ?? false,
    pdfUrl: c.pdfUrl,
    pdfStatus: c.pdfUrl ? "PROCESSING" : "NOT_UPLOADED",
  }));

  const insertedSources = await db
    .insert(sources)
    .values(newSourceRecords)
    .returning({
      id: sources.id,
      title: sources.title,
    });

  const newActiveSeedIds = insertedSources.map((s) => s.id);
  const nextCycle = (box.expansionCycle ?? 1) + 1;

  // 5. Update Sub-Box activeSeedIds and expansionCycle
  await db
    .update(boxes)
    .set({
      activeSeedIds: newActiveSeedIds,
      expansionCycle: nextCycle,
      updatedAt: new Date(),
    })
    .where(eq(boxes.id, boxId));

  logger.info("literature_expansion_success", {
    service: "literature",
    status: "SUCCESS",
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
