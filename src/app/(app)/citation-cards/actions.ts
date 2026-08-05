"use server";

import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notes, sources, type noteTypeEnum } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  ensureUserMatrixAndBoxes,
  getOwnedSource,
} from "../library/_services/helpers";
import type { ThesisBoxType } from "@/lib/box-constants";
import type {
  BoxItem,
  CitationCardItem,
  CitationNoteType,
  SourceItem,
} from "./_lib/types";

/** Note type validation schema. */
const noteTypeSchema = z.enum(["DIRECT_QUOTE", "PARAPHRASE", "PERSONAL_NOTE"]);

/** Schema for creating a new citation card. */
const createCitationCardSchema = z.object({
  sourceId: z.number().int().positive("Geçerli bir kaynak seçilmelidir."),
  boxId: z.number().int().positive("Geçerli bir konu kutusu seçilmelidir."),
  noteType: noteTypeSchema,
  pageNumber: z.string().min(1, "Sayfa numarası gereklidir."),
  content: z.string().min(1, "Fiş içeriği boş olamaz."),
});

/** Schema for updating an existing citation card. */
const updateCitationCardSchema = createCitationCardSchema.extend({
  id: z.number().int().positive("Geçerli bir fiş ID'si gereklidir."),
});

/**
 * Server Action: Fetches all topic boxes, sources, and citation notes for the logged-in user.
 *
 * @returns The user's citation cards, boxes, and sources data on success, or an error message on failure.
 */
export async function getCitationCardsDataAction(): Promise<
  | {
      success: true;
      data: {
        cards: CitationCardItem[];
        boxes: BoxItem[];
        sources: SourceItem[];
      };
    }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = Date.now();

  try {
    log.info("get_citation_cards_data_start", { service: "citation-cards" });

    const session = await getSession();
    if (!session) {
      return {
        success: false,
        error: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      };
    }

    const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(session.userId);
    const boxIds = userBoxes.map((b) => b.id);

    const dbSources =
      boxIds.length > 0
        ? await db.query.sources.findMany({
            where: inArray(sources.boxId, boxIds),
            orderBy: [desc(sources.createdAt)],
          })
        : [];

    const dbNotes = await db.query.notes.findMany({
      where: eq(notes.userId, session.userId),
      orderBy: [desc(notes.createdAt)],
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

      cards.push({
        id: noteRow.id,
        sourceId: sourceRow.id,
        sourceTitle: sourceRow.title,
        sourceAuthors:
          sourceRow.authors && sourceRow.authors.length > 0
            ? sourceRow.authors
            : ["Bilinmeyen Yazar"],
        sourceYear: sourceRow.publicationYear ?? new Date().getFullYear(),
        boxId: boxRow.id,
        boxType: (boxRow.boxType ?? "SUBJECT_PROBLEM") as ThesisBoxType,
        boxTitle: boxRow.title,
        pageNumber: noteRow.pageNumber,
        noteType: noteRow.noteType as CitationNoteType,
        content: noteRow.content,
        sentToCitationCards: noteRow.sentToCitationCards,
        createdAt: noteRow.createdAt.toISOString(),
        updatedAt: noteRow.updatedAt.toISOString(),
      });
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
      authors:
        s.authors && s.authors.length > 0 ? s.authors : ["Bilinmeyen Yazar"],
      publisher: s.publisher ?? "Belirtilmemiş",
      publicationYear: s.publicationYear ?? new Date().getFullYear(),
    }));

    log.info("get_citation_cards_data_success", {
      service: "citation-cards",
      data: {
        cardsCount: cards.length,
        boxesCount: formattedBoxes.length,
        sourcesCount: formattedSources.length,
        durationMs: Date.now() - startTime,
      },
    });

    return {
      success: true,
      data: {
        cards,
        boxes: formattedBoxes,
        sources: formattedSources,
      },
    };
  } catch (err) {
    log.error("get_citation_cards_data_failed", {
      service: "citation-cards",
      error: err,
    });
    return {
      success: false,
      error: "Alıntı fişleri verileri yüklenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Creates a new citation card (note) linked to a source and topic box.
 *
 * @param input - The card creation payload.
 * @param input.sourceId - The ID of the resource to link the note to.
 * @param input.boxId - The target topic box ID.
 * @param input.noteType - The academic note type enum value.
 * @param input.pageNumber - The page number or page range string.
 * @param input.content - The citation note content.
 * @returns The created citation card on success, or an error message on failure.
 */
export async function createCitationCardAction(input: {
  sourceId: number;
  boxId: number;
  noteType: CitationNoteType;
  pageNumber: string;
  content: string;
}): Promise<
  { success: true; data: CitationCardItem } | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = createCitationCardSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : "Geçersiz veri.",
      };
    }

    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const owned = await getOwnedSource(parsed.data.sourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const sourceRow = owned.source;

    const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(session.userId);
    const targetBox = userBoxes.find((b) => b.id === parsed.data.boxId);
    if (!targetBox) {
      return { success: false, error: "Seçilen konu kutusu bulunamadı." };
    }

    if (sourceRow.boxId !== parsed.data.boxId) {
      await db
        .update(sources)
        .set({ boxId: parsed.data.boxId, updatedAt: new Date() })
        .where(eq(sources.id, sourceRow.id));
    }

    const [newNote] = await db
      .insert(notes)
      .values({
        sourceId: sourceRow.id,
        userId: session.userId,
        pageNumber: parsed.data.pageNumber.trim(),
        noteType: parsed.data
          .noteType as (typeof noteTypeEnum.enumValues)[number],
        content: parsed.data.content.trim(),
        sentToCitationCards: true,
      })
      .returning();

    log.info("create_citation_card_success", {
      service: "citation-cards",
      data: { noteId: newNote.id, sourceId: sourceRow.id },
    });

    return {
      success: true,
      data: {
        id: newNote.id,
        sourceId: sourceRow.id,
        sourceTitle: sourceRow.title,
        sourceAuthors:
          sourceRow.authors && sourceRow.authors.length > 0
            ? sourceRow.authors
            : ["Bilinmeyen Yazar"],
        sourceYear: sourceRow.publicationYear ?? new Date().getFullYear(),
        boxId: targetBox.id,
        boxType: (targetBox.boxType ?? "SUBJECT_PROBLEM") as ThesisBoxType,
        boxTitle: targetBox.title,
        pageNumber: newNote.pageNumber,
        noteType: newNote.noteType as CitationNoteType,
        content: newNote.content,
        sentToCitationCards: newNote.sentToCitationCards,
        createdAt: newNote.createdAt.toISOString(),
        updatedAt: newNote.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    log.error("create_citation_card_failed", {
      service: "citation-cards",
      error: err,
    });
    return { success: false, error: "Alıntı fişi eklenirken bir hata oluştu." };
  }
}

/**
 * Server Action: Updates an existing citation card by ID.
 *
 * @param input - The card update payload.
 * @param input.id - The ID of the citation card note to update.
 * @param input.sourceId - The ID of the resource linked to the note.
 * @param input.boxId - The target topic box ID.
 * @param input.noteType - The academic note type enum value.
 * @param input.pageNumber - The page number or page range string.
 * @param input.content - The citation note content.
 * @returns The updated citation card on success, or an error message on failure.
 */
export async function updateCitationCardAction(input: {
  id: number;
  sourceId: number;
  boxId: number;
  noteType: CitationNoteType;
  pageNumber: string;
  content: string;
}): Promise<
  { success: true; data: CitationCardItem } | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = updateCitationCardSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : "Geçersiz veri.",
      };
    }

    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const existingNote = await db.query.notes.findFirst({
      where: and(
        eq(notes.id, parsed.data.id),
        eq(notes.userId, session.userId),
      ),
    });

    if (!existingNote) {
      return { success: false, error: "Güncellenecek alıntı fişi bulunamadı." };
    }

    const owned = await getOwnedSource(parsed.data.sourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const sourceRow = owned.source;

    const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(session.userId);
    const targetBox = userBoxes.find((b) => b.id === parsed.data.boxId);
    if (!targetBox) {
      return { success: false, error: "Seçilen konu kutusu bulunamadı." };
    }

    if (sourceRow.boxId !== parsed.data.boxId) {
      await db
        .update(sources)
        .set({ boxId: parsed.data.boxId, updatedAt: new Date() })
        .where(eq(sources.id, sourceRow.id));
    }

    const [updatedNote] = await db
      .update(notes)
      .set({
        sourceId: sourceRow.id,
        pageNumber: parsed.data.pageNumber.trim(),
        noteType: parsed.data
          .noteType as (typeof noteTypeEnum.enumValues)[number],
        content: parsed.data.content.trim(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(notes.id, parsed.data.id), eq(notes.userId, session.userId)),
      )
      .returning();

    log.info("update_citation_card_success", {
      service: "citation-cards",
      data: { noteId: updatedNote.id },
    });

    return {
      success: true,
      data: {
        id: updatedNote.id,
        sourceId: sourceRow.id,
        sourceTitle: sourceRow.title,
        sourceAuthors:
          sourceRow.authors && sourceRow.authors.length > 0
            ? sourceRow.authors
            : ["Bilinmeyen Yazar"],
        sourceYear: sourceRow.publicationYear ?? new Date().getFullYear(),
        boxId: targetBox.id,
        boxType: (targetBox.boxType ?? "SUBJECT_PROBLEM") as ThesisBoxType,
        boxTitle: targetBox.title,
        pageNumber: updatedNote.pageNumber,
        noteType: updatedNote.noteType as CitationNoteType,
        content: updatedNote.content,
        sentToCitationCards: updatedNote.sentToCitationCards,
        createdAt: updatedNote.createdAt.toISOString(),
        updatedAt: updatedNote.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    log.error("update_citation_card_failed", {
      service: "citation-cards",
      error: err,
    });
    return {
      success: false,
      error: "Alıntı fişi güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Deletes a citation card by ID for the logged in user.
 *
 * @param cardId - The ID of the citation card to delete.
 * @returns Success status or an error message.
 */
export async function deleteCitationCardAction(
  cardId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const deleted = await db
      .delete(notes)
      .where(and(eq(notes.id, cardId), eq(notes.userId, session.userId)))
      .returning({ id: notes.id });

    if (deleted.length === 0) {
      return { success: false, error: "Silinecek alıntı fişi bulunamadı." };
    }

    log.info("delete_citation_card_success", {
      service: "citation-cards",
      data: { cardId },
    });

    return { success: true };
  } catch (err) {
    log.error("delete_citation_card_failed", {
      service: "citation-cards",
      error: err,
    });
    return { success: false, error: "Alıntı fişi silinirken bir hata oluştu." };
  }
}

/**
 * Server Action: Moves a citation card's source to a target box by ID.
 *
 * @param input - The payload containing card and target box IDs.
 * @param input.cardId - The ID of the citation card note to move.
 * @param input.targetBoxId - The target box ID.
 * @returns Success status or error message.
 */
export async function moveCitationCardBoxAction(input: {
  cardId: number;
  targetBoxId: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const targetNote = await db.query.notes.findFirst({
      where: and(eq(notes.id, input.cardId), eq(notes.userId, session.userId)),
    });

    if (!targetNote) {
      return { success: false, error: "Alıntı fişi bulunamadı." };
    }

    const owned = await getOwnedSource(targetNote.sourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(session.userId);
    const targetBox = userBoxes.find((b) => b.id === input.targetBoxId);
    if (!targetBox) {
      return { success: false, error: "Hedef konu kutusu bulunamadı." };
    }

    await db
      .update(sources)
      .set({ boxId: input.targetBoxId, updatedAt: new Date() })
      .where(eq(sources.id, targetNote.sourceId));

    log.info("move_citation_card_box_success", {
      service: "citation-cards",
      data: { cardId: input.cardId, targetBoxId: input.targetBoxId },
    });

    return { success: true };
  } catch (err) {
    log.error("move_citation_card_box_failed", {
      service: "citation-cards",
      error: err,
    });
    return { success: false, error: "Fiş taşınırken bir hata oluştu." };
  }
}
