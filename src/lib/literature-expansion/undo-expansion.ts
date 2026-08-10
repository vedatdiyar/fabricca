import { db } from "@/db";
import { boxes, expansions, sources } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { deletePdfFromR2 } from "@/lib/services/r2";
import { Logger, createFlowId } from "@/lib/logger";

/**
 * Result returned when the latest literature expansion cycle is reverted.
 */
export interface UndoExpansionResult {
  boxId: number;
  /** The restored (previous) cycle number after undo. */
  expansionCycle: number;
  previousActiveSeedIds: number[];
  newActiveSeedIds: number[];
  removedSourceIds: number[];
  removedSourceCount: number;
}

/**
 * Reverts the latest literature expansion for a Sub-Box: deletes the sources
 * added by that expansion (including any uploaded R2 PDFs) and restores the
 * box's previous activeSeedIds and expansionCycle from the persisted history.
 * Only the most recent cycle is undoable.
 *
 * @param boxId - Sub-Box ID whose latest expansion should be undone.
 * @returns UndoExpansionResult detailing restored seed state and removed sources.
 */
export async function undoLiteratureExpansion(
  boxId: number,
): Promise<UndoExpansionResult> {
  const flowId = createFlowId();
  const logger = new Logger(flowId);

  logger.info("literature_undo_start", {
    service: "literature",
    status: "START",
    silentStart: true,
    data: { boxId },
  });

  const historyRow = await db
    .select()
    .from(expansions)
    .where(eq(expansions.boxId, boxId))
    .orderBy(desc(expansions.id))
    .limit(1);

  const history = historyRow[0];
  if (!history) {
    logger.error("literature_undo_no_history", {
      service: "literature",
      status: "FAILED",
      error: `No expansion history found for box ID ${boxId}`,
    });
    throw new Error("Geri alınacak bir genişletme döngüsü bulunamadı.");
  }

  const addedSourceIds = history.newActiveSeedIds;
  const previousCycle = Math.max(1, history.cycle - 1);

  // Clean up any uploaded R2 PDFs attached to the newly added sources before
  // deleting the rows (expansion candidates normally have none, but stay safe).
  const addedSourceRows = addedSourceIds.length
    ? await db
        .select({ id: sources.id, pdfFileName: sources.pdfFileName })
        .from(sources)
        .where(inArray(sources.id, addedSourceIds))
    : [];

  for (const source of addedSourceRows) {
    if (source.pdfFileName) {
      try {
        await deletePdfFromR2(source.pdfFileName);
      } catch (err) {
        logger.info("literature_undo_r2_delete_info", {
          service: "literature",
          error: err,
          data: { boxId, sourceId: source.id },
        });
      }
    }
  }

  await db.transaction(async (tx) => {
    if (addedSourceIds.length > 0) {
      await tx.delete(sources).where(inArray(sources.id, addedSourceIds));
    }

    await tx
      .update(boxes)
      .set({
        activeSeedIds: history.previousActiveSeedIds,
        expansionCycle: previousCycle,
        updatedAt: new Date(),
      })
      .where(eq(boxes.id, boxId));

    await tx
      .delete(expansions)
      .where(eq(expansions.id, history.id));
  });

  logger.info("literature_undo_success", {
    service: "literature",
    status: "SUCCESS",
    blank: "none",
    data: {
      boxId,
      previousCycle,
      removedCount: addedSourceIds.length,
    },
  });

  return {
    boxId,
    expansionCycle: previousCycle,
    previousActiveSeedIds: history.previousActiveSeedIds,
    newActiveSeedIds: addedSourceIds,
    removedSourceIds: addedSourceIds,
    removedSourceCount: addedSourceIds.length,
  };
}
