import { db } from "@/db";
import { sources, type Source } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";
import { toNumericId } from "./mutation-types";

/**
 * Captures the current source fields for the undo preview.
 *
 * @param args - The proposed mutation arguments.
 * @returns The existing source field values, or undefined.
 */
async function getSourcePreviousState(
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const sourceId = toNumericId(args.sourceId);
  if (!sourceId) return undefined;
  const sourceItem = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });
  if (!sourceItem) return undefined;
  return {
    title: sourceItem.title,
    isRead: sourceItem.isRead,
  };
}

/**
 * Updates the title, read status, and/or comparison note of a source.
 *
 * @param args - The proposed mutation arguments.
 * @returns The update result with the captured previous state.
 */
async function executeUpdateSource(
  args: Record<string, unknown>,
): Promise<MutationToolResult> {
  const sourceId = args.sourceId as number;
  const existingSource = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });
  if (!existingSource) {
    return { success: false, error: "Kaynak bulunamadı." };
  }

  const previousState: Record<string, unknown> = {
    title: existingSource.title,
    isRead: existingSource.isRead,
    comparisonNote: existingSource.comparisonNote,
  };

  const updateData: Partial<Source> = {};
  if (typeof args.title === "string") updateData.title = args.title;
  if (typeof args.isRead === "boolean") updateData.isRead = args.isRead;
  if (typeof args.comparisonNote === "string")
    updateData.comparisonNote = args.comparisonNote;

  await db
    .update(sources)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(sources.id, sourceId));

  return {
    success: true,
    message: "Kaynak bilgileri güncellendi.",
    previousState,
  };
}

/**
 * Deletes a source from the user's library.
 *
 * @param args - The proposed mutation arguments.
 * @returns The deletion result with the captured previous state.
 */
async function executeDeleteSource(
  args: Record<string, unknown>,
): Promise<MutationToolResult> {
  const sourceId = args.sourceId as number;
  const existingSource = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });
  if (!existingSource) {
    return { success: false, error: "Silinecek kaynak bulunamadı." };
  }

  const previousState: Record<string, unknown> = {
    boxId: existingSource.boxId,
    title: existingSource.title,
    authors: existingSource.authors,
    publicationYear: existingSource.publicationYear,
    doi: existingSource.doi,
    isRead: existingSource.isRead,
    comparisonNote: existingSource.comparisonNote,
    pdfUrl: existingSource.pdfUrl,
    pdfFileName: existingSource.pdfFileName,
    pdfFileSize: existingSource.pdfFileSize,
    pdfStatus: existingSource.pdfStatus,
  };

  await db.delete(sources).where(eq(sources.id, sourceId));
  return {
    success: true,
    message: "Kaynak kütüphaneden silindi.",
    previousState,
  };
}

/** Mutation handlers for the source tools. */
export const sourceMutations: Record<string, MutationToolHandler> = {
  updateSource: {
    execute: executeUpdateSource,
    getPreviousState: getSourcePreviousState,
  },
  deleteSource: {
    execute: executeDeleteSource,
    getPreviousState: getSourcePreviousState,
  },
};
