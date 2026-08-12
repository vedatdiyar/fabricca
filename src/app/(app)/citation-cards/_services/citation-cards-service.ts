import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  annotations,
  noteTypeEnum,
  sources,
  type Annotation,
  type Box,
  type Source,
} from "@/db/schema";
import { type ThesisBoxType } from "@/lib/box-constants";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";
import {
  ensureUserMatrixAndBoxes,
  getOwnedSource,
} from "@/services/box/ownership";
import type {
  BoxItem,
  CitationCardItem,
  CitationNoteType,
  SourceItem,
} from "../_lib/types";
import type {
  CreateCitationCardInput,
  UpdateCitationCardInput,
} from "../_lib/schemas";

/**
 * Shapes an annotation DB row into a client-facing citation card DTO using its linked source and topic box.
 *
 * @param annotation - The annotation (note) DB row.
 * @param source - The linked source row.
 * @param box - The topic box the source belongs to.
 * @returns The citation card DTO.
 */
export function mapAnnotationToCard(
  annotation: Annotation,
  source: Source,
  box: Box,
): CitationCardItem {
  return {
    id: annotation.id,
    sourceId: source.id,
    sourceTitle: source.title,
    sourceAuthors: formatResourceAuthors({
      authors: source.authors,
      publisher: source.publisher,
      boxType: box.boxType,
    }),
    sourceYear: source.publicationYear ?? new Date().getFullYear(),
    boxId: box.id,
    boxType: (box.boxType ?? "SUBJECT_PROBLEM") as ThesisBoxType,
    boxTitle: box.title,
    pageNumber: annotation.pageNumber,
    noteType: annotation.noteType as CitationNoteType,
    content: annotation.content,
    comment: annotation.comment ?? undefined,
    sentToCitationCards: annotation.sentToCitationCards,
    createdAt: annotation.createdAt.toISOString(),
    updatedAt: annotation.updatedAt.toISOString(),
  };
}

/**
 * Fetches the user's topic boxes, sources, and citation annotations, assembling client-facing card, box, and source DTOs.
 *
 * @param userId - The authenticated user's ID.
 * @returns The assembled citation card, box, and source DTO arrays.
 */
export async function fetchCitationCardsData(userId: number): Promise<{
  cards: CitationCardItem[];
  boxes: BoxItem[];
  sources: SourceItem[];
}> {
  const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(userId);
  const boxIds = userBoxes.map((b) => b.id);

  const dbSources =
    boxIds.length > 0
      ? await db.query.sources.findMany({
          where: inArray(sources.boxId, boxIds),
          orderBy: [desc(sources.createdAt)],
        })
      : [];

  const dbNotes = await db.query.annotations.findMany({
    where: eq(annotations.userId, userId),
    orderBy: [desc(annotations.createdAt)],
  });

  const boxMap = new Map(userBoxes.map((b) => [b.id, b]));
  const sourceMap = new Map(dbSources.map((s) => [s.id, s]));

  const cardCountMap = new Map<number, number>();
  for (const box of userBoxes) {
    cardCountMap.set(box.id, 0);
  }

  const cards: CitationCardItem[] = [];
  for (const noteRow of dbNotes) {
    const sourceRow = sourceMap.get(noteRow.sourceId);
    if (!sourceRow) continue;

    const boxRow = boxMap.get(sourceRow.boxId);
    if (!boxRow) continue;

    cardCountMap.set(boxRow.id, (cardCountMap.get(boxRow.id) ?? 0) + 1);
    cards.push(mapAnnotationToCard(noteRow, sourceRow, boxRow));
  }

  const formattedBoxes: BoxItem[] = userBoxes.map((b) => ({
    id: b.id,
    boxType: (b.boxType ?? "SUBJECT_PROBLEM") as ThesisBoxType,
    title: b.title,
    description: b.description ?? "",
    cardCount: cardCountMap.get(b.id) ?? 0,
  }));

  const formattedSources: SourceItem[] = dbSources.map((s) => ({
    id: s.id,
    boxId: s.boxId,
    title: s.title,
    authors: formatResourceAuthors({
      authors: s.authors,
      publisher: s.publisher,
      boxType: boxMap.get(s.boxId)?.boxType,
    }),
    publisher: s.publisher ?? "Belirtilmemiş",
    publicationYear: s.publicationYear ?? new Date().getFullYear(),
  }));

  return { cards, boxes: formattedBoxes, sources: formattedSources };
}

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
