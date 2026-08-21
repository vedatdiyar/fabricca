import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import {
  annotations,
  boxes,
  matrices,
  outlines,
  outlineAnnotations,
  sources,
} from "@/core/db/schema";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { Logger } from "@/lib/logger";
import {
  buildCardMappingPromptPayload,
  cardMappingJsonSchema,
  cardMappingResponseSchema,
  type CardMappingResponse,
} from "../_prompts/card-mapping.prompt";

export interface AutoMapCardsResult {
  mappedCount: number;
  mappings: Array<{
    annotationId: number;
    outlineId: number;
    confidenceScore: number;
    rationale: string;
  }>;
}

/**
 * Maps unassigned (or specified) citation cards to the user's thesis outline sections
 * using Gemini Flash structured output.
 *
 * @param userId - Authenticated user ID.
 * @param specificCardIds - Optional subset of citation card IDs to map.
 * @param logger - Optional Logger instance.
 * @returns Summary of mapped cards and their outline assignments.
 */
export async function autoMapCitationCards(
  userId: number,
  specificCardIds?: number[],
  logger?: Logger,
): Promise<{ success: true; data: AutoMapCardsResult } | { success: false; error: string }> {
  try {
    // 1. Fetch user's thesis matrix
    const userMatrix = await db.query.matrices.findFirst({
      where: eq(matrices.userId, userId),
    });

    if (!userMatrix) {
      return { success: false, error: "Tez matrisi bulunamadı." };
    }

    // 2. Fetch all outline sections
    const userOutlines = await db.query.outlines.findMany({
      where: eq(outlines.matrixId, userMatrix.id),
    });

    if (userOutlines.length === 0) {
      return {
        success: false,
        error: "Tez planında henüz bir bölüm bulunmuyor. Lütfen önce iskeleti oluşturun.",
      };
    }

    // 3. Find candidate annotation IDs
    let targetCardIds: number[] = [];
    if (specificCardIds && specificCardIds.length > 0) {
      targetCardIds = specificCardIds;
    } else {
      // Find all existing outline links for the user
      const existingLinks = await db
        .select({ annotationId: outlineAnnotations.annotationId })
        .from(outlineAnnotations);

      const assignedAnnoIds = new Set(existingLinks.map((l) => l.annotationId));

      const allUserNotes = await db.query.annotations.findMany({
        where: eq(annotations.userId, userId),
      });

      targetCardIds = allUserNotes
        .map((n) => n.id)
        .filter((id) => !assignedAnnoIds.has(id));
    }

    if (targetCardIds.length === 0) {
      return {
        success: true,
        data: { mappedCount: 0, mappings: [] },
      };
    }

    // 4. Fetch full note, source, and box data for target cards
    const userBoxes = await db.query.boxes.findMany({
      where: eq(boxes.matrixId, userMatrix.id),
    });
    const boxMap = new Map(userBoxes.map((b) => [b.id, b]));

    const targetNotes = await db.query.annotations.findMany({
      where: inArray(annotations.id, targetCardIds),
    });

    const sourceIds = Array.from(new Set(targetNotes.map((n) => n.sourceId)));
    const targetSources =
      sourceIds.length > 0
        ? await db.query.sources.findMany({
            where: inArray(sources.id, sourceIds),
          })
        : [];
    const sourceMap = new Map(targetSources.map((s) => [s.id, s]));

    const preparedCards = targetNotes.map((note) => {
      const source = sourceMap.get(note.sourceId);
      const box = source ? boxMap.get(source.boxId) : undefined;
      return {
        id: note.id,
        content: note.content,
        noteType: note.noteType,
        comment: note.comment ?? undefined,
        sourceTitle: source?.title ?? "Bilinmeyen Kaynak",
        sourceAuthors: source?.authors ?? [],
        boxTitle: box?.title ?? "Genel Kutu",
        boxType: box?.boxType ?? "SUBJECT_PROBLEM",
      };
    });

    // 5. Build prompt and invoke Gemini Flash
    const payload = buildCardMappingPromptPayload({
      matrix: {
        subjectProblem: userMatrix.subjectProblem,
        theoreticalFramework: userMatrix.theoreticalFramework,
        methodology: userMatrix.methodology,
        primaryMaterial: userMatrix.primaryMaterial,
      },
      outlines: userOutlines.map((o) => ({
        id: o.id,
        parentId: o.parentId,
        title: o.title,
        description: o.description,
        sortOrder: o.sortOrder,
      })),
      cards: preparedCards,
    });

    const response = await generateGeminiStructuredContent<CardMappingResponse>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      cardMappingJsonSchema,
      logger,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        zodSchema: cardMappingResponseSchema,
        seed: GEMINI_SEED,
        payloadStage: "card_outline_auto_mapping",
        quiet: true,
      },
    );

    // 6. Validate valid outline IDs and persist mappings in DB
    const validOutlineIds = new Set(userOutlines.map((o) => o.id));
    const validMappings = response.mappings.filter(
      (m) =>
        validOutlineIds.has(m.suggestedOutlineId) &&
        targetCardIds.includes(m.annotationId),
    );

    if (validMappings.length > 0) {
      await db.transaction(async (tx) => {
        // Delete any existing link for these annotations
        const annoIdsToUpdate = validMappings.map((m) => m.annotationId);
        await tx
          .delete(outlineAnnotations)
          .where(inArray(outlineAnnotations.annotationId, annoIdsToUpdate));

        // Insert new links
        await tx.insert(outlineAnnotations).values(
          validMappings.map((m) => ({
            annotationId: m.annotationId,
            outlineId: m.suggestedOutlineId,
          })),
        );
      });
    }

    return {
      success: true,
      data: {
        mappedCount: validMappings.length,
        mappings: validMappings.map((m) => ({
          annotationId: m.annotationId,
          outlineId: m.suggestedOutlineId,
          confidenceScore: m.confidenceScore,
          rationale: m.rationale,
        })),
      },
    };
  } catch (err) {
    logger?.error("auto_map_citation_cards_failed", {
      service: "citation-cards",
      error: err,
    });
    return {
      success: false,
      error: "Alıntı fişleri yapay zeka ile eşleştirilirken bir hata oluştu.",
    };
  }
}
