import { db } from "@/core/db";
import { boxes, expansions, sources, type NewSource } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import type { CandidateSource } from "./types";

export interface PersistExpansionParams {
  boxId: number;
  nextCycle: number;
  previousActiveSeedIds: number[];
  candidates: CandidateSource[];
}

export interface PersistedExpansionItem {
  id: number;
  title: string;
}

/**
 * Inserts expanded literature candidates into the database, updates the sub-box activeSeedIds
 * and cycle counter, and records history into the expansions table for undo capability.
 *
 * @param params - Configuration including boxId, nextCycle, previousActiveSeedIds, and candidate sources.
 * @returns Array of created sources with IDs and titles.
 */
export async function persistExpansionResult(
  params: PersistExpansionParams,
): Promise<PersistedExpansionItem[]> {
  const { boxId, nextCycle, previousActiveSeedIds, candidates } = params;

  const newSourceRecords: NewSource[] = candidates.map((c) => ({
    boxId,
    title: c.title,
    authors: c.authors,
    publisher: c.publisher,
    publicationYear: c.publicationYear,
    doi: c.doi,
    openalexId: c.openalexId,
    relevanceScore: c.relevanceScore,
    isRead: false,
    pdfUrl: c.pdfUrl,
    pdfStatus: c.pdfUrl ? "PROCESSING" : "NOT_UPLOADED",
  }));

  return db.transaction(async (tx) => {
    const created = await tx
      .insert(sources)
      .values(newSourceRecords)
      .returning({
        id: sources.id,
        title: sources.title,
      });

    const newActiveSeedIds = created.map((s) => s.id);

    // Update Sub-Box activeSeedIds and expansionCycle
    await tx
      .update(boxes)
      .set({
        activeSeedIds: newActiveSeedIds,
        expansionCycle: nextCycle,
        updatedAt: new Date(),
      })
      .where(eq(boxes.id, boxId));

    // Persist history so the latest cycle can be undone
    await tx.insert(expansions).values({
      boxId,
      cycle: nextCycle,
      previousActiveSeedIds,
      newActiveSeedIds,
    });

    return created;
  });
}
