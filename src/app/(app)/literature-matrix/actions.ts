"use server";

import { z } from "zod";
import { db } from "@/db";
import { sources, boxes, matrices, critiques, annotations } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionWithOnboarding } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { getOwnedSource } from "@/services/box/ownership";
import type { MatrixSourceRow, CritiqueFieldKey } from "./types";

/** Validation schema for updating a single critique field. */
const updateCritiqueFieldSchema = z.object({
  sourceId: z.number().int().positive("Geçerli bir kaynak seçilmelidir."),
  field: z.enum([
    "researchQuestion",
    "theoreticalFramework",
    "methodology",
    "mainArgument",
    "literatureGap",
  ]),
  value: z.string().trim().max(10000),
});

/** Validation schema for updating a direct source property in the matrix. */
const updateSourceFieldSchema = z.object({
  sourceId: z.number().int().positive("Geçerli bir kaynak seçilmelidir."),
  isRead: z.boolean().optional(),
  comparisonNote: z.string().trim().max(10000).optional(),
});

/**
 * Server Action: Fetches all literature matrix source rows and topic boxes for the authenticated user.
 *
 * @returns Object containing matrix source rows and user boxes on success, or error on failure.
 */
export async function getLiteratureMatrixData() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSessionWithOnboarding();
    if (!session) {
      return { success: false, error: "Oturum açmanız gerekmektedir." };
    }

    // 1. Fetch user matrix ID
    const [userMatrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId))
      .limit(1);

    if (!userMatrix) {
      return {
        success: true,
        data: { rows: [], boxes: [] },
      };
    }

    // 2. Fetch all user boxes
    const userBoxes = await db
      .select({
        id: boxes.id,
        title: boxes.title,
        boxType: boxes.boxType,
      })
      .from(boxes)
      .where(eq(boxes.matrixId, userMatrix.id));

    if (userBoxes.length === 0) {
      return {
        success: true,
        data: { rows: [], boxes: [] },
      };
    }

    const boxIds = userBoxes.map((b) => b.id);
    const boxMap = new Map(userBoxes.map((b) => [b.id, b]));

    // 3. Fetch sources for user boxes
    const rawSources = await db
      .select()
      .from(sources)
      .where(sql`${sources.boxId} IN ${boxIds}`);

    if (rawSources.length === 0) {
      return {
        success: true,
        data: {
          rows: [],
          boxes: userBoxes.map((b) => ({ id: b.id, title: b.title })),
        },
      };
    }

    const sourceIds = rawSources.map((s) => s.id);

    // 4. Fetch critiques for user sources
    const rawCritiques = await db
      .select()
      .from(critiques)
      .where(sql`${critiques.sourceId} IN ${sourceIds}`);

    const critiqueMap = new Map(rawCritiques.map((c) => [c.sourceId, c]));

    // 5. Count annotations per source
    const rawAnnotationCounts = await db
      .select({
        sourceId: annotations.sourceId,
        count: sql<number>`count(${annotations.id})::int`,
      })
      .from(annotations)
      .where(sql`${annotations.sourceId} IN ${sourceIds}`)
      .groupBy(annotations.sourceId);

    const annotationCountMap = new Map(
      rawAnnotationCounts.map((a) => [a.sourceId, a.count]),
    );

    // 6. Build response rows
    const rows: MatrixSourceRow[] = rawSources.map((source) => {
      const box = boxMap.get(source.boxId);
      const critique = critiqueMap.get(source.id);
      const annotationCount = annotationCountMap.get(source.id) ?? 0;

      return {
        id: source.id,
        title: source.title,
        authors: source.authors,
        publicationYear: source.publicationYear,
        publisher: source.publisher,
        doi: source.doi,
        thesisType: source.thesisType,
        isRead: source.isRead,
        pdfStatus: source.pdfStatus,
        comparisonNote: source.comparisonNote,
        boxId: source.boxId,
        boxTitle: box ? box.title : null,
        boxType: box ? box.boxType : null,
        annotationCount,
        critique: critique
          ? {
              id: critique.id,
              researchQuestion: critique.researchQuestion,
              theoreticalFramework: critique.theoreticalFramework,
              methodology: critique.methodology,
              mainArgument: critique.mainArgument,
              literatureGap: critique.literatureGap,
            }
          : null,
      };
    });

    return {
      success: true,
      data: {
        rows,
        boxes: userBoxes.map((b) => ({ id: b.id, title: b.title })),
      },
    };
  } catch (error) {
    log.error("get_literature_matrix_data_failed", {
      service: "literature-matrix",
      error,
    });
    return {
      success: false,
      error: "Literatür matrisi verileri yüklenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Updates a single critique field for a source in the literature matrix.
 *
 * @param sourceId - Target resource ID.
 * @param field - Critique column key to update.
 * @param value - New text content.
 * @returns Success status or error response.
 */
export async function updateMatrixCritiqueAction(
  sourceId: number,
  field: CritiqueFieldKey,
  value: string,
) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = updateCritiqueFieldSchema.safeParse({
      sourceId,
      field,
      value,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : "Geçersiz veri.",
      };
    }

    const session = await getSessionWithOnboarding();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const owned = await getOwnedSource(sourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const trimmedValue = value.trim() || null;

    const [updatedCritique] = await db
      .insert(critiques)
      .values({
        sourceId,
        userId: session.userId,
        [field]: trimmedValue,
      })
      .onConflictDoUpdate({
        target: critiques.sourceId,
        set: {
          [field]: trimmedValue,
          updatedAt: new Date(),
        },
      })
      .returning();

    log.info("update_matrix_critique_success", {
      service: "literature-matrix",
      data: { sourceId, field, critiqueId: updatedCritique.id },
    });

    return {
      success: true,
      data: {
        id: updatedCritique.id,
        researchQuestion: updatedCritique.researchQuestion,
        theoreticalFramework: updatedCritique.theoreticalFramework,
        methodology: updatedCritique.methodology,
        mainArgument: updatedCritique.mainArgument,
        literatureGap: updatedCritique.literatureGap,
      },
    };
  } catch (error) {
    log.error("update_matrix_critique_failed", {
      service: "literature-matrix",
      error,
    });
    return {
      success: false,
      error: "Eser analizi hücresi güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Updates direct properties of a source from the literature matrix grid.
 *
 * @param sourceId - Target resource ID.
 * @param updates - Property changes to apply.
 * @returns Success status or error response.
 */
export async function updateMatrixSourceAction(
  sourceId: number,
  updates: { isRead?: boolean; comparisonNote?: string },
) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = updateSourceFieldSchema.safeParse({
      sourceId,
      ...updates,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : "Geçersiz veri.",
      };
    }

    const session = await getSessionWithOnboarding();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const owned = await getOwnedSource(sourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const updateSet: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof updates.isRead === "boolean") {
      updateSet.isRead = updates.isRead;
    }

    if (typeof updates.comparisonNote === "string") {
      updateSet.comparisonNote = updates.comparisonNote.trim() || null;
    }

    await db.update(sources).set(updateSet).where(eq(sources.id, sourceId));

    log.info("update_matrix_source_success", {
      service: "literature-matrix",
      data: { sourceId, updates },
    });

    return { success: true };
  } catch (error) {
    log.error("update_matrix_source_failed", {
      service: "literature-matrix",
      error,
    });
    return {
      success: false,
      error: "Kaynak güncellenirken bir hata oluştu.",
    };
  }
}
