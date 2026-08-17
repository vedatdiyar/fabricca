import { and, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { annotations, noteTypeEnum, sources } from "@/core/db/schema";
import {
  ensureUserMatrixAndBoxes,
  getOwnedSource,
} from "@/core/services/box/ownership";
import type { CitationCardItem } from "@/app/(app)/citation-cards/_lib/types";
import type {
  CreateCitationCardInput,
  UpdateCitationCardInput,
} from "@/app/(app)/citation-cards/_lib/schemas";
import { mapAnnotationToCard } from "../_lib/citation-card-mapper";

/**
 * Creates a new citation card (annotation) linked to an owned source and target topic box, syncing the source's box when needed.
 *
 * @param userId - The authenticated user's ID.
 * @param input - The validated creation payload.
 * @returns The created card DTO, or an error when ownership or box validation fails.
 */
export async function createCitationCard(
  userId: number,
  input: CreateCitationCardInput,
): Promise<{ data: CitationCardItem } | { error: string }> {
  const owned = await getOwnedSource(input.sourceId, userId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const sourceRow = owned.source;

  const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(userId);
  const targetBox = userBoxes.find((b) => b.id === input.boxId);
  if (!targetBox) {
    return { error: "Seçilen konu kutusu bulunamadı." };
  }

  if (sourceRow.boxId !== input.boxId) {
    await db
      .update(sources)
      .set({ boxId: input.boxId, updatedAt: new Date() })
      .where(eq(sources.id, sourceRow.id));
  }

  const [newNote] = await db
    .insert(annotations)
    .values({
      sourceId: sourceRow.id,
      userId,
      pageNumber: input.pageNumber.trim(),
      noteType: input.noteType as (typeof noteTypeEnum.enumValues)[number],
      content: input.content.trim(),
      comment: input.comment?.trim() || null,
      sentToCitationCards: true,
    })
    .returning();

  return { data: mapAnnotationToCard(newNote, sourceRow, targetBox) };
}

/**
 * Updates an existing citation card by ID for the given user, syncing the source's box when needed.
 *
 * @param userId - The authenticated user's ID.
 * @param input - The validated update payload.
 * @returns The updated card DTO, or an error when ownership or validation fails.
 */
export async function updateCitationCard(
  userId: number,
  input: UpdateCitationCardInput,
): Promise<{ data: CitationCardItem } | { error: string }> {
  const existingNote = await db.query.annotations.findFirst({
    where: and(eq(annotations.id, input.id), eq(annotations.userId, userId)),
  });

  if (!existingNote) {
    return { error: "Güncellenecek alıntı fişi bulunamadı." };
  }

  const owned = await getOwnedSource(input.sourceId, userId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const sourceRow = owned.source;

  const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(userId);
  const targetBox = userBoxes.find((b) => b.id === input.boxId);
  if (!targetBox) {
    return { error: "Seçilen konu kutusu bulunamadı." };
  }

  if (sourceRow.boxId !== input.boxId) {
    await db
      .update(sources)
      .set({ boxId: input.boxId, updatedAt: new Date() })
      .where(eq(sources.id, sourceRow.id));
  }

  const [updatedNote] = await db
    .update(annotations)
    .set({
      sourceId: sourceRow.id,
      pageNumber: input.pageNumber.trim(),
      noteType: input.noteType as (typeof noteTypeEnum.enumValues)[number],
      content: input.content.trim(),
      comment: input.comment?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(annotations.id, input.id), eq(annotations.userId, userId)))
    .returning();

  return { data: mapAnnotationToCard(updatedNote, sourceRow, targetBox) };
}

/**
 * Deletes a citation card by ID for the given user.
 *
 * @param cardId - The ID of the citation card to delete.
 * @param userId - The authenticated user's ID.
 * @returns Success status, or an error when the card does not exist.
 */
export async function deleteCitationCard(
  cardId: number,
  userId: number,
): Promise<{ success: true } | { error: string }> {
  const deleted = await db
    .delete(annotations)
    .where(and(eq(annotations.id, cardId), eq(annotations.userId, userId)))
    .returning({ id: annotations.id });

  if (deleted.length === 0) {
    return { error: "Silinecek alıntı fişi bulunamadı." };
  }

  return { success: true };
}

/**
 * Moves a citation card's source to a target topic box by ID for the given user.
 *
 * @param userId - The authenticated user's ID.
 * @param cardId - The ID of the citation card note to move.
 * @param targetBoxId - The target box ID.
 * @returns Success status, or an error when the card, source, or box validation fails.
 */
export async function moveCitationCardBox(
  userId: number,
  cardId: number,
  targetBoxId: number,
): Promise<{ success: true } | { error: string }> {
  const targetNote = await db.query.annotations.findFirst({
    where: and(eq(annotations.id, cardId), eq(annotations.userId, userId)),
  });

  if (!targetNote) {
    return { error: "Alıntı fişi bulunamadı." };
  }

  const owned = await getOwnedSource(targetNote.sourceId, userId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(userId);
  const targetBox = userBoxes.find((b) => b.id === targetBoxId);
  if (!targetBox) {
    return { error: "Hedef konu kutusu bulunamadı." };
  }

  await db
    .update(sources)
    .set({ boxId: targetBoxId, updatedAt: new Date() })
    .where(eq(sources.id, targetNote.sourceId));

  return { success: true };
}
