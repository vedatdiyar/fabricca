"use server";

import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  matrices,
  boxes as boxRows,
  sources,
  notes as noteRows,
} from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { deletePdfFromR2 } from "@/lib/services/r2";
import { getBoxDefaultTitle } from "../_services/helpers";
import type { ThesisBoxType, NoteType } from "../_types/types";

/**
 * Server Action: Fetches all library resources and notes for the current user.
 * Ensures default thesis boxes are seeded if not present.
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

    // Get user's thesis matrix
    const matrix = await db.query.matrices.findFirst({
      where: eq(matrices.userId, session.userId),
      with: {
        boxes: true,
      },
    });

    let boxes = matrix?.boxes || [];

    // If user has no thesis boxes yet, create a default set for the user's matrix
    if (!matrix) {
      const [newMatrix] = await db
        .insert(matrices)
        .values({
          userId: session.userId,
          subjectProblem: "Akademik Araştırma ve Literatür İncelemesi",
          theoreticalFramework: "Kuramsal Temeller ve Metodolojik Yaklaşım",
          methodology: "Nitel ve Nicel Analiz Yöntemleri",
        })
        .returning();

      const defaultBoxes = [
        {
          matrixId: newMatrix.id,
          boxType: "SUBJECT_PROBLEM" as const,
          title: "Konu ve Problem",
        },
        {
          matrixId: newMatrix.id,
          boxType: "THEORETICAL_FRAMEWORK" as const,
          title: "Kuramsal Çerçeve",
        },
        {
          matrixId: newMatrix.id,
          boxType: "PRIMARY_MATERIAL" as const,
          title: "Birincil Malzeme",
        },
        {
          matrixId: newMatrix.id,
          boxType: "METHODOLOGY" as const,
          title: "Metodoloji",
        },
      ];

      boxes = await db.insert(boxRows).values(defaultBoxes).returning();
    } else if (boxes.length === 0) {
      const defaultBoxes = [
        {
          matrixId: matrix.id,
          boxType: "SUBJECT_PROBLEM" as const,
          title: "Konu ve Problem",
        },
        {
          matrixId: matrix.id,
          boxType: "THEORETICAL_FRAMEWORK" as const,
          title: "Kuramsal Çerçeve",
        },
        {
          matrixId: matrix.id,
          boxType: "PRIMARY_MATERIAL" as const,
          title: "Birincil Malzeme",
        },
        {
          matrixId: matrix.id,
          boxType: "METHODOLOGY" as const,
          title: "Metodoloji",
        },
      ];

      boxes = await db.insert(boxRows).values(defaultBoxes).returning();
    }

    const boxIds = boxes.map((b) => b.id);

    // Fetch resources belonging to user's boxes
    const dbResources =
      boxIds.length > 0
        ? await db.query.sources.findMany({
            where: inArray(sources.boxId, boxIds),
            orderBy: [desc(sources.createdAt)],
          })
        : [];

    const resourceIds = dbResources.map((r) => r.id);

    // Fetch notes belonging to user's resources
    const dbNotes =
      resourceIds.length > 0
        ? await db.query.notes.findMany({
            where: inArray(noteRows.sourceId, resourceIds),
            orderBy: [desc(noteRows.createdAt)],
          })
        : [];

    // Map box type helper
    const boxMap = new Map(boxes.map((b) => [b.id, b.boxType]));

    const resources = dbResources.map((r) => ({
      id: r.id,
      boxType: (boxMap.get(r.boxId) || "THEORETICAL_FRAMEWORK") as Exclude<
        ThesisBoxType,
        "ALL"
      >,
      title: r.title,
      authors: r.authors || ["Bilinmeyen Yazar"],
      publisher: r.publisher || "Belirtilmemiş",
      publicationYear: r.publicationYear || new Date().getFullYear(),
      doi: r.doi || undefined,
      url: r.url || undefined,
      isRead: r.isRead,
      pdfUrl: r.pdfUrl || undefined,
      pdfFileName: r.pdfFileName || undefined,
      pdfStatus: r.pdfStatus || "NOT_UPLOADED",
      sourceOrigin: "LITERATURE_EXPANSION" as const,
      abstract: r.abstract || r.comparisonNote || undefined,
      abstractSource: r.abstractSource || undefined,
      createdAt: r.createdAt.toISOString(),
    }));

    const notes = dbNotes.map((n) => ({
      id: n.id,
      resourceId: n.sourceId,
      pageNumber: n.pageNumber,
      noteType: n.noteType as NoteType,
      content: n.content,
      sentToCardIndex: n.sentToCardIndex,
      createdAt: n.createdAt.toISOString(),
    }));

    return { success: true, data: { resources, notes } };
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

/**
 * Server Action: Creates a new library resource item in the database.
 *
 * @param input - Title, authors, publisher, year, doi, url, and box type.
 */
export async function createLibraryResourceAction(input: {
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear: number;
  doi?: string;
  url?: string;
  boxType: Exclude<ThesisBoxType, "ALL">;
}) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!input.title.trim()) {
      return { success: false, error: "Lütfen eser başlığını giriniz." };
    }

    // Find or create thesis box corresponding to boxType
    const matrix = await db.query.matrices.findFirst({
      where: eq(matrices.userId, session.userId),
      with: { boxes: true },
    });

    let targetBox = matrix?.boxes.find((b) => b.boxType === input.boxType);

    if (!targetBox) {
      let matrixId = matrix?.id;
      if (!matrixId) {
        const [newM] = await db
          .insert(matrices)
          .values({
            userId: session.userId,
            subjectProblem: "Genel Konu ve Problem",
            theoreticalFramework: "Kuramsal Çerçeve",
            methodology: "Yöntem",
          })
          .returning();
        matrixId = newM.id;
      }

      const [newBox] = await db
        .insert(boxRows)
        .values({
          matrixId: matrixId,
          boxType: input.boxType,
          title: getBoxDefaultTitle(input.boxType),
        })
        .returning();

      targetBox = newBox;
    }

    const [newResource] = await db
      .insert(sources)
      .values({
        boxId: targetBox.id,
        title: input.title.trim(),
        authors:
          input.authors.length > 0 ? input.authors : ["Bilinmeyen Yazar"],
        publisher: input.publisher?.trim() || "Belirtilmemiş",
        publicationYear: input.publicationYear || new Date().getFullYear(),
        doi: input.doi?.trim() || null,
        url: input.url?.trim() || null,
        isRead: false,
        pdfStatus: "NOT_UPLOADED",
      })
      .returning();

    log.info("create_library_resource_success", {
      service: "library",
      data: { resourceId: newResource.id, title: newResource.title },
    });

    return {
      success: true,
      data: {
        id: newResource.id,
        boxType: input.boxType,
        title: newResource.title,
        authors: newResource.authors || [],
        publisher: newResource.publisher || "",
        publicationYear:
          newResource.publicationYear || new Date().getFullYear(),
        doi: newResource.doi || undefined,
        url: newResource.url || undefined,
        isRead: false,
        pdfStatus: "NOT_UPLOADED" as const,
        sourceOrigin: "LITERATURE_EXPANSION" as const,
        createdAt: newResource.createdAt.toISOString(),
      },
    };
  } catch (err) {
    log.error("create_library_resource_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "Yeni eser eklenirken bir hata oluştu." };
  }
}

/**
 * Server Action: Toggles the read status of a library resource.
 *
 * @param resourceId - Target resource ID.
 */
export async function toggleResourceReadStatusAction(resourceId: number) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const resource = await db.query.sources.findFirst({
      where: eq(sources.id, resourceId),
    });

    if (!resource) {
      return { success: false, error: "Eser bulunamadı." };
    }

    const newIsRead = !resource.isRead;

    await db
      .update(sources)
      .set({ isRead: newIsRead })
      .where(eq(sources.id, resourceId));

    log.info("toggle_resource_read_status_success", {
      service: "library",
      data: { resourceId, isRead: newIsRead },
    });

    return { success: true, isRead: newIsRead };
  } catch (err) {
    log.error("toggle_resource_read_status_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Okunma durumu güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Permanently deletes a library resource along with its
 * Cloudflare R2 PDF file (if any), DB cascade handles embeddings & notes cleanup.
 *
 * @param resourceId - Target resource ID.
 */
export async function deleteLibraryResourceAction(resourceId: number) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const resource = await db.query.sources.findFirst({
      where: eq(sources.id, resourceId),
    });

    if (!resource) {
      return { success: false, error: "Eser bulunamadı." };
    }

    // Attempt R2 PDF deletion — log warning but never block the DB cleanup
    if (resource.pdfFileName) {
      try {
        await deletePdfFromR2(resource.pdfFileName);
      } catch (err) {
        log.info("r2_delete_file_info", {
          service: "library",
          error: err,
          data: { resourceId, pdfFileName: resource.pdfFileName },
        });
      }
    }

    await db.delete(sources).where(eq(sources.id, resourceId));

    return { success: true };
  } catch (err) {
    log.error("delete_library_resource_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "Eser silinirken bir hata oluştu." };
  }
}
