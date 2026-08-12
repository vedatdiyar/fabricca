"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources, chunks as chunkRows, annotations } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { deletePdfFromR2 } from "@/services/storage/r2";
import { generateTempPdfUploadUrl } from "./_services/pdf-service";
import { getOwnedSource } from "@/services/box/ownership";
import { completePdfUploadCore } from "./_services/pdf-upload-complete";
import type { LibraryResourceItem } from "./_lib/types";

/**
 * Server Action: Deletes a resource's PDF from Cloudflare R2 and resets its DB status.
 *
 * @param resourceId - The ID of the resource whose PDF will be deleted.
 * @returns A success flag, or an error message on failure.
 */
export async function deleteResourcePdfAction(resourceId: number) {
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
        log.info("r2_delete_file_info", { service: "library", error: err });
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(chunkRows).where(eq(chunkRows.sourceId, resourceId));

      await tx.delete(annotations).where(eq(annotations.sourceId, resourceId));

      await tx
        .update(sources)
        .set({
          pdfUrl: null,
          pdfFileName: null,
          pdfFileSize: null,
          pdfStatus: "NOT_UPLOADED",
        })
        .where(eq(sources.id, resourceId));
    });

    log.info("delete_resource_pdf_success", {
      service: "library",
      data: { resourceId, cleanedEmbeddings: true, cleanedNotes: true },
    });

    return { success: true };
  } catch (err) {
    log.error("delete_resource_pdf_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "PDF silinirken bir hata oluştu." };
  }
}

/**
 * Server Action (Step 1 of 2): Validates the resource and returns a presigned R2 upload URL.
 *
 * @param resourceId - The ID of the resource receiving the PDF upload.
 * @returns The presigned upload URL and temp key on success, or an error message on failure.
 */
export async function requestResourcePdfUploadAction(
  resourceId: number,
): Promise<
  | { success: true; presignedUrl: string; tempKey: string; flowId: string }
  | { success: false; error: string }
> {
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

    if (resource.pdfStatus === "READY" && resource.pdfUrl) {
      return {
        success: false,
        error:
          "Bu akademik eser için zaten bir PDF yüklü. Tekil kayıt kuralı gereği tekrar PDF yüklenemez.",
      };
    }

    log.info("request_resource_pdf_upload_url_start", {
      service: "library",
      data: { resourceId },
    });

    const { presignedUrl, tempKey } = await generateTempPdfUploadUrl();

    log.info("request_resource_pdf_upload_url_success", {
      service: "library",
      data: { resourceId, tempKey },
    });

    log.info("pdf_browser_upload_start", {
      service: "library",
    });

    return { success: true, presignedUrl, tempKey, flowId };
  } catch (err) {
    log.error("request_resource_pdf_upload_url_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Yükleme bağlantısı oluşturulurken bir hata oluştu.",
    };
  }
}

/**
 * Server Action (Step 2 of 2): Processes the uploaded PDF — extracts metadata, runs the RAG pipeline, and cleans up the temp file.
 *
 * When `pdfBuffer` is provided the server skips the R2 re-fetch round-trip
 * (the client already uploaded via presigned URL and passes the buffer directly).
 *
 * @param resourceId - The ID of the resource to attach the processed PDF to.
 * @param tempKey - The R2 temp object key of the uploaded PDF.
 * @param originalFileName - The original file name of the uploaded PDF.
 * @param flowId - Optional flow identifier for logging.
 * @param uploadStartedAt - Optional timestamp when the upload started (for duration logging).
 * @param pdfBuffer - Optional pre-loaded PDF buffer (Uint8Array-serializable) that skips the R2 read.
 * @returns The updated resource item on success, or an error message on failure.
 */
export async function completeResourcePdfUploadAction(
  resourceId: number,
  tempKey: string,
  originalFileName: string,
  flowId?: string,
  uploadStartedAt?: number,
  pdfBuffer?: number[],
): Promise<
  | { success: true; data: LibraryResourceItem }
  | { success: false; error: string }
> {
  return completePdfUploadCore({
    createMode: false,
    resourceId,
    tempKey,
    fileName: originalFileName,
    flowId,
    uploadStartedAt,
    pdfBuffer,
  });
}

/**
 * Server Action (Step 1 of 2): Generates a presigned upload URL for creating a new resource from a PDF.
 *
 * @returns The presigned upload URL and temp key on success, or an error message on failure.
 */
export async function requestPdfCreateUploadAction(): Promise<
  | { success: true; presignedUrl: string; tempKey: string; flowId: string }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    log.info("request_pdf_create_upload_url_start", {
      service: "library",
    });

    const { presignedUrl, tempKey } = await generateTempPdfUploadUrl();

    log.info("request_pdf_create_upload_url_success", {
      service: "library",
      data: { tempKey },
    });

    log.info("pdf_browser_upload_start", {
      service: "library",
    });

    return { success: true, presignedUrl, tempKey, flowId };
  } catch (err) {
    log.error("request_pdf_create_upload_url_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Yükleme bağlantısı oluşturulurken bir hata oluştu.",
    };
  }
}

/**
 * Server Action (Step 2 of 2): Processes the uploaded PDF — creates a new resource, runs the full RAG pipeline, and cleans up the temp file.
 *
 * When `pdfBuffer` is provided the server skips the R2 re-fetch round-trip.
 *
 * @param tempKey - The R2 temp object key of the uploaded PDF.
 * @param originalFileName - The original file name of the uploaded PDF.
 * @param boxId - The ID of the box the new resource will be placed in.
 * @param flowId - Optional flow identifier for logging.
 * @param uploadStartedAt - Optional timestamp when the upload started.
 * @param pdfBuffer - Optional pre-loaded PDF buffer (Uint8Array-serializable) that skips the R2 read.
 * @returns The created resource item on success, or an error message on failure.
 */
export async function completePdfCreateUploadAction(
  tempKey: string,
  originalFileName: string,
  boxId: number,
  flowId?: string,
  uploadStartedAt?: number,
  pdfBuffer?: number[],
): Promise<
  | { success: true; data: LibraryResourceItem }
  | { success: false; error: string }
> {
  return completePdfUploadCore({
    createMode: true,
    boxId,
    tempKey,
    fileName: originalFileName,
    flowId,
    uploadStartedAt,
    pdfBuffer,
  });
}
