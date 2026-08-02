"use server";

import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sources, notes as noteRows } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { deletePdfFromR2 } from "@/lib/services/r2";
import { ensureUserMatrixAndBoxes, getOwnedSource } from "../_services/helpers";
import { mapSourceToResource } from "../_services/resource-mapper";
import type { NoteType } from "../_types/types";

/** Server Action: Fetches all library resources and notes for the current user, seeding default boxes if absent. */
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

    const { boxes } = await ensureUserMatrixAndBoxes(session.userId);

    const boxIds = boxes.map((b) => b.id);

    const dbResources =
      boxIds.length > 0
        ? await db.query.sources.findMany({
            where: inArray(sources.boxId, boxIds),
            orderBy: [desc(sources.createdAt)],
          })
        : [];

    const resourceIds = dbResources.map((r) => r.id);

    const dbNotes =
      resourceIds.length > 0
        ? await db.query.notes.findMany({
            where: inArray(noteRows.sourceId, resourceIds),
            orderBy: [desc(noteRows.createdAt)],
          })
        : [];

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

    const notes = dbNotes.map((n) => ({
      id: n.id,
      resourceId: n.sourceId,
      pageNumber: n.pageNumber,
      noteType: n.noteType as NoteType,
      content: n.content,
      sentToCitationCards: n.sentToCitationCards,
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

/** Server Action: Toggles the read status of a library resource. */
export async function toggleResourceReadStatusAction(resourceId: number) {
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
    const resource = owned.source;

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

/** Server Action: Permanently deletes a resource, its R2 PDF, and all related data. */
export async function deleteLibraryResourceAction(resourceId: number) {
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
    const resource = owned.source;

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

/** Server Action: Updates a resource's metadata (title, authors, publisher, year, DOI, box). */
export async function updateLibraryResourceAction(input: {
  resourceId: number;
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear: number;
  doi?: string;
  boxId?: number;
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

    const owned = await getOwnedSource(input.resourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }
    const existingResource = owned.source;

    const { boxes: userBoxes } = await ensureUserMatrixAndBoxes(session.userId);
    const userBoxIds = userBoxes.map((b) => b.id);

    let targetBoxId = existingResource.boxId;
    if (input.boxId && userBoxIds.includes(input.boxId)) {
      targetBoxId = input.boxId;
    }

    const [updated] = await db
      .update(sources)
      .set({
        boxId: targetBoxId,
        title: input.title.trim(),
        authors:
          input.authors.length > 0
            ? input.authors.map((a) => a.trim()).filter(Boolean)
            : ["Bilinmeyen Yazar"],
        publisher: input.publisher?.trim() || "Belirtilmemiş",
        publicationYear: input.publicationYear || new Date().getFullYear(),
        doi: input.doi?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, input.resourceId))
      .returning();

    const targetBox = userBoxes.find((b) => b.id === updated.boxId);

    log.info("update_library_resource_success", {
      service: "library",
      data: { resourceId: updated.id, title: updated.title },
    });

    return {
      success: true,
      data: mapSourceToResource(updated, {
        boxType: targetBox?.boxType ?? null,
        title: targetBox?.title ?? "Genel",
        parentId: targetBox?.parentId ?? null,
      }),
    };
  } catch (err) {
    log.error("update_library_resource_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Eser metadataları güncellenirken bir hata oluştu.",
    };
  }
}
