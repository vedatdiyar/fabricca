"use server";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import {
  sources,
  annotations,
  outlines,
  outlineAnnotations,
} from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { ensureUserMatrixAndBoxes } from "@/core/services/box/ownership";
import { mapSourceToResource } from "@/app/(app)/library/_services/resource-mapper";
import { auditReportSchema } from "./_services/critique-evaluator";
import type {
  LibraryOutlineItem,
  LibraryResourceNote,
  LibraryResourceCritique,
  NoteType,
  NoteVerificationStatus,
} from "./_lib/types";

/**
 * Server Action: Fetches all library resources, notes, critiques, and thesis outline sections for the current user.
 *
 * @returns The resources, notes, critiques, and outlines on success, or an error message on failure.
 */
export async function getLibraryResourcesAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        error: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      };
    }

    const { matrix, boxes } = await ensureUserMatrixAndBoxes(session.userId);

    const boxIds = boxes.map((b) => b.id);

    const dbResources =
      boxIds.length > 0
        ? await db.query.sources.findMany({
            where: inArray(sources.boxId, boxIds),
            orderBy: [desc(sources.createdAt)],
            with: { critique: true },
          })
        : [];

    const resourceIds = dbResources.map((r) => r.id);

    const dbNotes =
      resourceIds.length > 0
        ? await db.query.annotations.findMany({
            where: inArray(annotations.sourceId, resourceIds),
            orderBy: [desc(annotations.createdAt)],
          })
        : [];

    const noteIds = dbNotes.map((n) => n.id);

    // Fetch outline sections for this user's matrix
    const dbOutlines = await db.query.outlines.findMany({
      where: eq(outlines.matrixId, matrix.id),
      orderBy: [asc(outlines.sortOrder)],
    });

    // Fetch outlineAnnotations junction records
    const dbOutlineAnnoLinks =
      noteIds.length > 0
        ? await db.query.outlineAnnotations.findMany({
            where: inArray(outlineAnnotations.annotationId, noteIds),
          })
        : [];

    const noteOutlineMap = new Map<number, number[]>();
    for (const link of dbOutlineAnnoLinks) {
      const existing = noteOutlineMap.get(link.annotationId) ?? [];
      existing.push(link.outlineId);
      noteOutlineMap.set(link.annotationId, existing);
    }

    const boxMap = new Map(boxes.map((b) => [b.id, b.boxType]));
    const boxTitleMap = new Map(boxes.map((b) => [b.id, b.title]));
    const boxParentMap = new Map(boxes.map((b) => [b.id, b.parentId]));

    const resources = dbResources.map((r) =>
      mapSourceToResource(r, {
        boxType: boxMap.get(r.boxId) ?? null,
        title: boxTitleMap.get(r.boxId) ?? "Genel",
        parentId: boxParentMap.get(r.boxId) ?? null,
      }),
    );

    const notes: LibraryResourceNote[] = dbNotes.map((n) => ({
      id: n.id,
      resourceId: n.sourceId,
      pageNumber: n.pageNumber,
      noteType: n.noteType as NoteType,
      content: n.content,
      comment: n.comment ?? undefined,
      outlineIds: noteOutlineMap.get(n.id) ?? [],
      sentToCitationCards: n.sentToCitationCards,
      verificationStatus:
        (n.verificationStatus as NoteVerificationStatus) || "UNVERIFIED",
      verificationData: n.verificationData ?? undefined,
      createdAt: n.createdAt.toISOString(),
    }));

    const critiques: LibraryResourceCritique[] = dbResources
      .map((r) => r.critique)
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => {
        const parsedEvaluation = c.aiEvaluation
          ? auditReportSchema.safeParse(c.aiEvaluation)
          : { success: false as const, data: undefined };

        if (c.aiEvaluation && !parsedEvaluation.success) {
          log.warn("stale_ai_evaluation_ignored", {
            service: "library",
            data: { resourceId: c.sourceId },
          });
        }

        return {
          resourceId: c.sourceId,
          researchQuestion: c.researchQuestion ?? undefined,
          theoreticalFramework: c.theoreticalFramework ?? undefined,
          methodology: c.methodology ?? undefined,
          mainArgument: c.mainArgument ?? undefined,
          literatureGap: c.literatureGap ?? undefined,
          aiEvaluation: parsedEvaluation.success
            ? {
                ...parsedEvaluation.data,
                evaluatedAt: (c.evaluatedAt ?? c.updatedAt).toISOString(),
              }
            : undefined,
          evaluatedAt: c.evaluatedAt?.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        };
      });

    const outlineItems: LibraryOutlineItem[] = dbOutlines.map((o) => ({
      id: o.id,
      parentId: o.parentId,
      title: o.title,
      description: o.description,
      sortOrder: o.sortOrder,
      academicField: o.academicField,
    }));

    return {
      success: true,
      data: { resources, notes, critiques, outlines: outlineItems },
    };
  } catch (err) {
    log.error("get_library_resources_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Kütüphane kaynakları yüklenirken bir hata oluştu.",
    };
  }
}
