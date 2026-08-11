"use server";

import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  createCitationCardSchema,
  updateCitationCardSchema,
} from "./_lib/schemas";
import {
  createCitationCard,
  deleteCitationCard,
  fetchCitationCardsData,
  moveCitationCardBox,
  updateCitationCard,
} from "./_services/citation-cards-service";
import type {
  BoxItem,
  CitationCardItem,
  CitationNoteType,
  SourceItem,
} from "./_lib/types";

/**
 * Server Action: Fetches all topic boxes, sources, and citation annotations for the logged-in user.
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

    const data = await fetchCitationCardsData(session.userId);

    log.info("get_citation_cards_data_success", {
      service: "citation-cards",
      data: {
        cardsCount: data.cards.length,
        boxesCount: data.boxes.length,
        sourcesCount: data.sources.length,
        durationMs: Date.now() - startTime,
      },
    });

    return {
      success: true,
      data,
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
 * @param input.comment - Optional personal meta-comment / annotation attached to the card.
 * @returns The created citation card on success, or an error message on failure.
 */
export async function createCitationCardAction(input: {
  sourceId: number;
  boxId: number;
  noteType: CitationNoteType;
  pageNumber: string;
  content: string;
  comment?: string;
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

    const result = await createCitationCard(session.userId, parsed.data);
    if ("error" in result) {
      return { success: false, error: result.error };
    }

    log.info("create_citation_card_success", {
      service: "citation-cards",
      data: { noteId: result.data.id, sourceId: result.data.sourceId },
    });

    return {
      success: true,
      data: result.data,
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
 * @param input.comment - Optional personal meta-comment / annotation attached to the card.
 * @returns The updated citation card on success, or an error message on failure.
 */
export async function updateCitationCardAction(input: {
  id: number;
  sourceId: number;
  boxId: number;
  noteType: CitationNoteType;
  pageNumber: string;
  content: string;
  comment?: string;
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

    const result = await updateCitationCard(session.userId, parsed.data);
    if ("error" in result) {
      return { success: false, error: result.error };
    }

    log.info("update_citation_card_success", {
      service: "citation-cards",
      data: { noteId: result.data.id },
    });

    return {
      success: true,
      data: result.data,
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

    const result = await deleteCitationCard(cardId, session.userId);
    if ("error" in result) {
      return { success: false, error: result.error };
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

    const result = await moveCitationCardBox(
      session.userId,
      input.cardId,
      input.targetBoxId,
    );
    if ("error" in result) {
      return { success: false, error: result.error };
    }

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
