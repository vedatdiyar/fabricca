"use server";

import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  libraryResourceNotes,
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
    const matrix = await db.query.thesisMatrices.findFirst({
      where: eq(thesisMatrices.userId, session.userId),
      with: {
        thesisBoxes: true,
      },
    });

    let boxes = matrix?.thesisBoxes || [];

    // If user has no thesis boxes yet, create a default set for the user's matrix
    if (!matrix) {
      const [newMatrix] = await db
        .insert(thesisMatrices)
        .values({
          userId: session.userId,
          subjectProblem: "Akademik Araştırma ve Literatür İncelemesi",
          theoreticalFramework: "Kuramsal Temeller ve Metodolojik Yaklaşım",
          methodology: "Nitel ve Nicel Analiz Yöntemleri",
        })
        .returning();

      const defaultBoxes = [
        {
          thesisMatrixId: newMatrix.id,
          boxType: "SUBJECT_PROBLEM" as const,
          title: "Konu ve Problem",
        },
        {
          thesisMatrixId: newMatrix.id,
          boxType: "THEORETICAL_FRAMEWORK" as const,
          title: "Kuramsal Çerçeve",
        },
        {
          thesisMatrixId: newMatrix.id,
          boxType: "PRIMARY_MATERIAL" as const,
          title: "Birincil Malzeme",
        },
        {
          thesisMatrixId: newMatrix.id,
          boxType: "METHODOLOGY" as const,
          title: "Metodoloji",
        },
      ];

      boxes = await db.insert(thesisBoxes).values(defaultBoxes).returning();
    } else if (boxes.length === 0) {
      const defaultBoxes = [
        {
          thesisMatrixId: matrix.id,
          boxType: "SUBJECT_PROBLEM" as const,
          title: "Konu ve Problem",
        },
        {
          thesisMatrixId: matrix.id,
          boxType: "THEORETICAL_FRAMEWORK" as const,
          title: "Kuramsal Çerçeve",
        },
        {
          thesisMatrixId: matrix.id,
          boxType: "PRIMARY_MATERIAL" as const,
          title: "Birincil Malzeme",
        },
        {
          thesisMatrixId: matrix.id,
          boxType: "METHODOLOGY" as const,
          title: "Metodoloji",
        },
      ];

      boxes = await db.insert(thesisBoxes).values(defaultBoxes).returning();
    }

    const boxIds = boxes.map((b) => b.id);

    // Fetch resources belonging to user's boxes
    const dbResources =
      boxIds.length > 0
        ? await db.query.libraryResources.findMany({
            where: inArray(libraryResources.thesisBoxId, boxIds),
            orderBy: [desc(libraryResources.createdAt)],
          })
        : [];

    const resourceIds = dbResources.map((r) => r.id);

    // Fetch notes belonging to user's resources
    const dbNotes =
      resourceIds.length > 0
        ? await db.query.libraryResourceNotes.findMany({
            where: inArray(libraryResourceNotes.libraryResourceId, resourceIds),
            orderBy: [desc(libraryResourceNotes.createdAt)],
          })
        : [];

    // Map box type helper
    const boxMap = new Map(boxes.map((b) => [b.id, b.boxType]));

    const resources = dbResources.map((r) => ({
      id: r.id,
      boxType: (boxMap.get(r.thesisBoxId) ||
        "THEORETICAL_FRAMEWORK") as Exclude<ThesisBoxType, "ALL">,
      title: r.title,
      authors: r.authors || ["Bilinmeyen Yazar"],
      publisher: r.publisher || "Akademik Yayın",
      publicationYear: r.publicationYear || new Date().getFullYear(),
      doi: r.doi || undefined,
      url: r.url || undefined,
      isRead: r.isRead,
      pdfUrl: r.pdfUrl || undefined,
      pdfFileName: r.pdfFileName || undefined,
      pdfStatus: r.pdfStatus || "NOT_UPLOADED",
      sourceOrigin: "LITERATURE_EXPANSION" as const,
      createdAt: r.createdAt.toISOString(),
    }));

    const notes = dbNotes.map((n) => ({
      id: n.id,
      resourceId: n.libraryResourceId,
      pageNumber: n.pageNumber,
      noteType: n.noteType as NoteType,
      content: n.content,
      sentToCardIndex: n.sentToCardIndex,
      createdAt: n.createdAt.toISOString(),
    }));

    log.info("library_resources_fetched", {
      service: "library",
      data: { resourceCount: resources.length, noteCount: notes.length },
    });

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
    const matrix = await db.query.thesisMatrices.findFirst({
      where: eq(thesisMatrices.userId, session.userId),
      with: { thesisBoxes: true },
    });

    let targetBox = matrix?.thesisBoxes.find(
      (b) => b.boxType === input.boxType,
    );

    if (!targetBox) {
      let matrixId = matrix?.id;
      if (!matrixId) {
        const [newM] = await db
          .insert(thesisMatrices)
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
        .insert(thesisBoxes)
        .values({
          thesisMatrixId: matrixId,
          boxType: input.boxType,
          title: getBoxDefaultTitle(input.boxType),
        })
        .returning();

      targetBox = newBox;
    }

    const [newResource] = await db
      .insert(libraryResources)
      .values({
        thesisBoxId: targetBox.id,
        title: input.title.trim(),
        authors:
          input.authors.length > 0 ? input.authors : ["Bilinmeyen Yazar"],
        publisher: input.publisher?.trim() || "Akademik Yayın",
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

    const resource = await db.query.libraryResources.findFirst({
      where: eq(libraryResources.id, resourceId),
    });

    if (!resource) {
      return { success: false, error: "Eser bulunamadı." };
    }

    const newIsRead = !resource.isRead;

    await db
      .update(libraryResources)
      .set({ isRead: newIsRead })
      .where(eq(libraryResources.id, resourceId));

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

    const resource = await db.query.libraryResources.findFirst({
      where: eq(libraryResources.id, resourceId),
    });

    if (!resource) {
      return { success: false, error: "Eser bulunamadı." };
    }

    // Attempt R2 PDF deletion — log warning but never block the DB cleanup
    if (resource.pdfFileName) {
      try {
        await deletePdfFromR2(resource.pdfFileName);
      } catch (err) {
        log.warn("r2_delete_file_warning", {
          service: "library",
          error: err,
          data: { resourceId, pdfFileName: resource.pdfFileName },
        });
      }
    }

    await db
      .delete(libraryResources)
      .where(eq(libraryResources.id, resourceId));

    log.info("delete_library_resource_success", {
      service: "library",
      data: { resourceId, hadPdf: !!resource.pdfFileName },
    });

    return { success: true };
  } catch (err) {
    log.error("delete_library_resource_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "Eser silinirken bir hata oluştu." };
  }
}
