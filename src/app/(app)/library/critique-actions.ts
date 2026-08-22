"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/core/db";
import { critiques, annotations, matrices } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { getOwnedSource } from "@/core/services/box/ownership";
import { evaluateResourceNotesAndCritique } from "./_services/critique-evaluator";
import type {
  LibraryResourceNote,
  NoteType,
  NoteVerificationStatus,
} from "./_lib/types";

/** Validation schema for saving the 1:1 article analysis of a library source. */
const saveResourceCritiqueSchema = z.object({
  resourceId: z.number().int().positive("Geçerli bir kaynak seçilmelidir."),
  researchQuestion: z.string().trim().max(10000).optional(),
  theoreticalFramework: z.string().trim().max(10000).optional(),
  methodology: z.string().trim().max(10000).optional(),
  mainArgument: z.string().trim().max(10000).optional(),
  literatureGap: z.string().trim().max(10000).optional(),
});

/**
 * Server Action: Upserts the 1:1 article analysis (research question, theoretical framework,
 * methodology, main argument, literature gap) for a library source.
 *
 * @param input - The critique payload.
 * @param input.resourceId - The ID of the resource the analysis belongs to.
 * @param input.researchQuestion - What the study tries to solve or understand.
 * @param input.theoreticalFramework - The theory, concepts, or key terms the study relies on.
 * @param input.methodology - The research method used.
 * @param input.mainArgument - The author's main conclusion and defended thesis.
 * @param input.literatureGap - Where the author fell short or what future work remains.
 * @returns The saved critique on success, or an error message on failure.
 */
export async function saveResourceCritiqueAction(input: {
  resourceId: number;
  researchQuestion?: string;
  theoreticalFramework?: string;
  methodology?: string;
  mainArgument?: string;
  literatureGap?: string;
}) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = saveResourceCritiqueSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : "Geçersiz veri.",
      };
    }

    const valid = parsed.data;

    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const owned = await getOwnedSource(valid.resourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const fieldValues = {
      researchQuestion: valid.researchQuestion?.trim() || null,
      theoreticalFramework: valid.theoreticalFramework?.trim() || null,
      methodology: valid.methodology?.trim() || null,
      mainArgument: valid.mainArgument?.trim() || null,
      literatureGap: valid.literatureGap?.trim() || null,
    };

    const [critique] = await db
      .insert(critiques)
      .values({
        sourceId: valid.resourceId,
        userId: session.userId,
        ...fieldValues,
      })
      .onConflictDoUpdate({
        target: critiques.sourceId,
        set: {
          ...fieldValues,
          updatedAt: new Date(),
        },
      })
      .returning();

    log.info("save_resource_critique_success", {
      service: "library",
      data: { critiqueId: critique.id, resourceId: valid.resourceId },
    });

    return {
      success: true,
      data: {
        resourceId: critique.sourceId,
        researchQuestion: critique.researchQuestion ?? undefined,
        theoreticalFramework: critique.theoreticalFramework ?? undefined,
        methodology: critique.methodology ?? undefined,
        mainArgument: critique.mainArgument ?? undefined,
        literatureGap: critique.literatureGap ?? undefined,
        aiEvaluation: critique.aiEvaluation ?? undefined,
        evaluatedAt: critique.evaluatedAt?.toISOString(),
        updatedAt: critique.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    log.error("save_resource_critique_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Eser analizi kaydedilirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Evaluates all notes, personal annotations, and the 5-field critique for a resource
 * against the researcher's thesis matrix using Gemini Flash-Lite.
 *
 * @param resourceId - Target library resource ID.
 * @returns The holistic audit report on success.
 */
export async function evaluateResourceNotesAction(resourceId: number) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const owned = await getOwnedSource(resourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    // 1. Fetch all notes for this resource
    const dbNotes = await db.query.annotations.findMany({
      where: eq(annotations.sourceId, resourceId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    const notes: LibraryResourceNote[] = dbNotes.map((n) => ({
      id: n.id,
      resourceId: n.sourceId,
      pageNumber: n.pageNumber,
      noteType: n.noteType as NoteType,
      content: n.content,
      comment: n.comment ?? undefined,
      sentToCitationCards: n.sentToCitationCards,
      verificationStatus: n.verificationStatus as NoteVerificationStatus,
      verificationData: n.verificationData ?? undefined,
      createdAt: n.createdAt.toISOString(),
    }));

    // 2. Fetch critique if present
    const existingCritique = await db.query.critiques.findFirst({
      where: eq(critiques.sourceId, resourceId),
    });

    // 3. Fetch user's thesis matrix
    const matrix = await db.query.matrices.findFirst({
      where: eq(matrices.userId, session.userId),
    });

    const evaluation = await evaluateResourceNotesAndCritique({
      resource: {
        title: owned.source.title,
        authors: owned.source.authors ?? undefined,
        publicationYear: owned.source.publicationYear,
        documentType: owned.source.documentType ?? undefined,
      },
      critique: existingCritique
        ? {
            researchQuestion: existingCritique.researchQuestion ?? undefined,
            theoreticalFramework:
              existingCritique.theoreticalFramework ?? undefined,
            methodology: existingCritique.methodology ?? undefined,
            mainArgument: existingCritique.mainArgument ?? undefined,
            literatureGap: existingCritique.literatureGap ?? undefined,
          }
        : undefined,
      notes,
      thesisMatrix: matrix
        ? {
            subjectProblem: matrix.subjectProblem,
            theoreticalFramework: matrix.theoreticalFramework,
            methodology: matrix.methodology,
          }
        : null,
      logger: log,
    });

    const now = new Date();

    // 4. Save evaluation report to database
    await db
      .insert(critiques)
      .values({
        sourceId: resourceId,
        userId: session.userId,
        aiEvaluation: evaluation,
        evaluatedAt: now,
      })
      .onConflictDoUpdate({
        target: critiques.sourceId,
        set: {
          aiEvaluation: evaluation,
          evaluatedAt: now,
          updatedAt: now,
        },
      });

    log.info("evaluate_resource_notes_success", {
      service: "library",
      data: { resourceId, overallScore: evaluation.overallScore },
    });

    return {
      success: true,
      data: evaluation,
    };
  } catch (err) {
    log.error("evaluate_resource_notes_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Notlar değerlendirilirken bir hata oluştu.",
    };
  }
}
