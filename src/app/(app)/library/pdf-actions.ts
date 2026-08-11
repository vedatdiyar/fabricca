"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { boxes, sources, chunks as chunkRows, annotations } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { deletePdfFromR2 } from "@/lib/services/r2";
import { formatApaPdfFileName } from "@/lib/academic/utils";
import { processResourcePdfPipeline } from "./_services/pdf-pipeline";
import { fetchAndExtractPdf } from "./_services/pdf-upload";
import { getOwnedSource } from "./_services/helpers";
import { mapSourceToResource } from "./_services/resource-mapper";
import {
  cleanupTempKey,
  generateTempPdfUploadUrl,
  findReadySourceByPdfName,
  buildDuplicatePdfError,
} from "./_services/pdf-service";
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

    await db.delete(chunkRows).where(eq(chunkRows.sourceId, resourceId));

    await db.delete(annotations).where(eq(annotations.sourceId, resourceId));

    await db
      .update(sources)
      .set({
        pdfUrl: null,
        pdfFileName: null,
        pdfFileSize: null,
        pdfStatus: "NOT_UPLOADED",
      })
      .where(eq(sources.id, resourceId));

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
  const resolvedFlowId = flowId ?? createFlowId();
  const log = new Logger(resolvedFlowId);

  try {
    const pipelineStart = performance.now();

    log.info("pdf_browser_upload_success", {
      service: "library",
      data: {
        durationMs:
          uploadStartedAt != null ? Date.now() - uploadStartedAt : undefined,
      },
    });

    const session = await getSession();
    if (!session) {
      cleanupTempKey(tempKey, log);
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!originalFileName.toLowerCase().endsWith(".pdf")) {
      cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    const owned = await getOwnedSource(resourceId, session.userId);
    if ("error" in owned) {
      cleanupTempKey(tempKey, log);
      return { success: false, error: owned.error };
    }
    const resource = owned.source;

    if (resource.pdfStatus === "READY" && resource.pdfUrl) {
      cleanupTempKey(tempKey, log);
      return {
        success: false,
        error:
          "Bu akademik eser için zaten bir PDF yüklü. Tekil kayıt kuralı gereği tekrar PDF yüklenemez.",
      };
    }

    const preloadedBuffer = pdfBuffer ? Buffer.from(pdfBuffer) : undefined;

    const { buffer, chunks, metadata, parsedReferences } =
      await fetchAndExtractPdf(tempKey, originalFileName, log, preloadedBuffer);

    await db
      .update(sources)
      .set({
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Belirtilmemiş",
        publicationYear: metadata.publicationYear ?? null,
        doi: metadata.doi || null,
      })
      .where(eq(sources.id, resourceId));

    const apaFileName = formatApaPdfFileName(
      metadata.authors,
      metadata.publicationYear,
      metadata.title,
    );

    const existingDuplicate = await findReadySourceByPdfName(apaFileName);
    if (existingDuplicate && existingDuplicate.id !== resourceId) {
      cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: buildDuplicatePdfError(apaFileName),
      };
    }

    await db
      .update(sources)
      .set({ pdfStatus: "PROCESSING" })
      .where(eq(sources.id, resourceId));

    const pipelineResult = await processResourcePdfPipeline({
      resourceId,
      fileName: apaFileName,
      buffer,
      log,
      precomputedChunks: chunks,
      precomputedMetadata: metadata,
      precomputedReferences: parsedReferences,
    });

    cleanupTempKey(tempKey, log);

    log.total(
      "complete_resource_pdf",
      Math.round(performance.now() - pipelineStart),
      {
        service: "library",
        data: {
          resourceId,
          apaFileName,
          pdfUrl: pipelineResult.r2Url,
          initialSize: buffer.length,
          finalSize: pipelineResult.finalSize,
          chunkCount: pipelineResult.chunkCount,
        },
      },
    );

    return {
      success: true,
      data: mapSourceToResource(
        resource,
        {
          boxType: resource.box.boxType,
          title: resource.box.title,
          parentId: resource.box.parentId,
        },
        {
          title: metadata.title,
          authors: metadata.authors,
          publisher: metadata.publisher || "Belirtilmemiş",
          publicationYear: metadata.publicationYear,
          doi: metadata.doi || undefined,
          pdfUrl: pipelineResult.r2Url,
          pdfFileName: apaFileName,
          pdfFileSize: pipelineResult.finalSize,
          pdfStatus: "READY",
        },
      ),
    };
  } catch (err) {
    log.error("complete_resource_pdf_failed", {
      service: "library",
      error: err,
    });

    cleanupTempKey(tempKey, log);

    await db
      .update(sources)
      .set({ pdfStatus: "FAILED" })
      .where(eq(sources.id, resourceId));

    return {
      success: false,
      error:
        "PDF yüklenirken, metadata çıkarılırken veya vektörleştirilirken bir hata oluştu.",
    };
  }
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
  const resolvedFlowId = flowId ?? createFlowId();
  const log = new Logger(resolvedFlowId);

  let createdResourceId: number | undefined;
  let uploadedPdfFileName: string | undefined;

  try {
    const pipelineStart = performance.now();

    log.info("pdf_browser_upload_success", {
      service: "library",
      data: {
        durationMs:
          uploadStartedAt != null ? Date.now() - uploadStartedAt : undefined,
      },
    });

    const session = await getSession();
    if (!session) {
      cleanupTempKey(tempKey, log);
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!originalFileName.toLowerCase().endsWith(".pdf")) {
      cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    const preloadedBuffer = pdfBuffer ? Buffer.from(pdfBuffer) : undefined;

    const { buffer, chunks, metadata, parsedReferences } =
      await fetchAndExtractPdf(tempKey, originalFileName, log, preloadedBuffer);

    const targetBox = await db.query.boxes.findFirst({
      where: eq(boxes.id, boxId),
      with: { matrix: true },
    });

    if (!targetBox || targetBox.matrix.userId !== session.userId) {
      cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: "Seçilen konu kutusu bulunamadı veya bu kullanıcıya ait değil.",
      };
    }

    const [newResource] = await db
      .insert(sources)
      .values({
        boxId: targetBox.id,
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Belirtilmemiş",
        publicationYear: metadata.publicationYear ?? null,
        doi: metadata.doi || null,
        isRead: false,
        pdfStatus: "PROCESSING",
      })
      .returning();
    createdResourceId = newResource.id;

    const apaFileName = formatApaPdfFileName(
      newResource.authors,
      newResource.publicationYear,
      newResource.title,
    );

    const existingDuplicate = await findReadySourceByPdfName(apaFileName);
    if (existingDuplicate) {
      cleanupTempKey(tempKey, log);
      await db.delete(sources).where(eq(sources.id, createdResourceId));
      return {
        success: false,
        error: buildDuplicatePdfError(apaFileName),
      };
    }

    uploadedPdfFileName = apaFileName;

    const pipelineResult = await processResourcePdfPipeline({
      resourceId: newResource.id,
      fileName: apaFileName,
      buffer,
      log,
      precomputedChunks: chunks,
      precomputedMetadata: metadata,
      precomputedReferences: parsedReferences,
    });

    cleanupTempKey(tempKey, log);

    log.total(
      "complete_pdf_create",
      Math.round(performance.now() - pipelineStart),
      {
        service: "library",
        data: {
          resourceId: newResource.id,
          title: newResource.title,
          finalFileName: apaFileName,
          pdfUrl: pipelineResult.r2Url,
          chunkCount: pipelineResult.chunkCount,
        },
      },
    );

    return {
      success: true,
      data: mapSourceToResource(
        newResource,
        {
          boxType: targetBox.boxType,
          title: targetBox.title,
          parentId: targetBox.parentId,
        },
        {
          isRead: false,
          pdfUrl: pipelineResult.r2Url,
          pdfFileName: apaFileName,
          pdfFileSize: pipelineResult.finalSize,
          pdfStatus: "READY",
        },
      ),
    };
  } catch (err) {
    log.error("complete_pdf_create_failed", {
      service: "library",
      error: err,
    });

    cleanupTempKey(tempKey, log);

    if (createdResourceId != null) {
      if (uploadedPdfFileName) {
        try {
          await deletePdfFromR2(uploadedPdfFileName);
        } catch {
          log.info("r2_orphan_pdf_cleanup_failed", {
            service: "library",
            data: { uploadedPdfFileName },
          });
        }
      }
      await db.delete(sources).where(eq(sources.id, createdResourceId));
    }

    return {
      success: false,
      error: "PDF yüklenirken ve künye bilgileri çıkarılırken bir hata oluştu.",
    };
  }
}
