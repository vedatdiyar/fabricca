"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/core/db";
import { sources } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { deletePdfFromR2 } from "@/core/services/storage/r2";
import {
  ensureUserMatrixAndBoxes,
  getOwnedSource,
} from "@/core/services/box/ownership";
import { mapSourceToResource } from "@/app/(app)/library/_services/resource-mapper";

/**
 * Server Action: Sets (or toggles) the read status of a library resource.
 *
 * @param resourceId - The ID of the resource to update.
 * @param isRead - Optional explicit read state; when omitted the current state is toggled.
 * @returns The new read status on success, or an error message on failure.
 */
export async function toggleResourceReadStatusAction(
  resourceId: number,
  isRead?: boolean,
) {
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

    const newIsRead = isRead ?? !resource.isRead;

    await db
      .update(sources)
      .set({ isRead: newIsRead })
      .where(eq(sources.id, resourceId));

    log.info("toggle_resource_read_status_success", {
      service: "library",
      data: { resourceId, isRead: newIsRead },
    });

    revalidatePath("/dashboard");
    revalidatePath("/library");

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
 * Server Action: Permanently deletes a resource, its R2 PDF, and all related data.
 *
 * @param resourceId - The ID of the resource to delete.
 * @returns A success flag, or an error message on failure.
 */
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

    revalidatePath("/dashboard");
    revalidatePath("/library");

    return { success: true };
  } catch (err) {
    log.error("delete_library_resource_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "Eser silinirken bir hata oluştu." };
  }
}

/**
 * Server Action: Updates a resource's metadata (title, authors, publisher, year, DOI, box).
 *
 * @param input - The metadata update payload.
 * @param input.resourceId - The ID of the resource to update.
 * @param input.title - The new resource title.
 * @param input.authors - The new list of author names.
 * @param input.publisher - The optional publisher name.
 * @param input.publicationYear - The new publication year.
 * @param input.doi - The optional DOI.
 * @param input.boxId - The optional ID of the box to move the resource into.
 * @returns The updated resource on success, or an error message on failure.
 */
export async function updateLibraryResourceAction(input: {
  resourceId: number;
  title: string;
  authors: string[];
  containerTitle?: string;
  documentType?: string;
  publisher?: string;
  publicationYear?: number | null;
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
            : null,
        containerTitle: input.containerTitle?.trim() || null,
        documentType: input.documentType?.trim() || null,
        publisher: input.publisher?.trim() || "Belirtilmemiş",
        publicationYear: input.publicationYear ?? null,
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
