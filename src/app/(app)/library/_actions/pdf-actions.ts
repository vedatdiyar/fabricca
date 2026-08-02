"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { boxes, sources, chunks as chunkRows, notes } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  deletePdfFromR2,
  generatePresignedUploadUrl,
  deleteR2Object,
} from "@/lib/services/r2";
import { formatApaPdfFileName } from "@/lib/academic/utils";
import { processResourcePdfPipeline } from "../_services/pdf-pipeline";
import { fetchAndExtractPdf } from "../_services/pdf-upload";
import { getOwnedSource } from "../_services/helpers";
import { mapSourceToResource } from "../_services/resource-mapper";
import type { LibraryResourceItem } from "../_types/types";

async function cleanupTempKey(tempKey: string, log: Logger): Promise<void> {
  if (!tempKey) return;
  try {
    await deleteR2Object(tempKey);
  } catch {
    log.info("r2_temp_cleanup_failed", {
      service: "library",
      data: { tempKey },
    });
  }
}

async function generateTempPdfUploadUrl() {
  const tempKey = `temp/${crypto.randomUUID()}.pdf`;
  const presignedUrl = await generatePresignedUploadUrl(
    tempKey,
    "application/pdf",
  );
  return { presignedUrl, tempKey };
}

async function findReadySourceByPdfName(apaFileName: string) {
  return db.query.sources.findFirst({
    where: and(
      eq(sources.pdfFileName, apaFileName),
      eq(sources.pdfStatus, "READY"),
    ),
  });
}

function buildDuplicatePdfError(apaFileName: string) {
  return `Bu akademik yayın PDF'i (${apaFileName}) sistemde başka bir kayıtta zaten mevcut. Kopya kayıtlara izin verilmemektedir.`;
}

/** Server Action: Deletes a resource's PDF from Cloudflare R2 and resets its DB status. */
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

    await db.delete(notes).where(eq(notes.sourceId, resourceId));

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

/** Server Action (Step 1 of 2): Validates the resource and returns a presigned R2 upload URL. */
export async function requestResourcePdfUploadAction(
  resourceId: number,
): Promise<
  | { success: true; presignedUrl: string; tempKey: string }
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

    return { success: true, presignedUrl, tempKey };
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
 * Server Action (Step 2 of 2): Fetches the PDF from R2, runs the metadata
 * extraction + RAG pipeline, and cleans up the temp file.
 */
export async function completeResourcePdfUploadAction(
  resourceId: number,
  tempKey: string,
  originalFileName: string,
): Promise<
  | { success: true; data: LibraryResourceItem }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      await cleanupTempKey(tempKey, log);
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!originalFileName.toLowerCase().endsWith(".pdf")) {
      await cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    const owned = await getOwnedSource(resourceId, session.userId);
    if ("error" in owned) {
      await cleanupTempKey(tempKey, log);
      return { success: false, error: owned.error };
    }
    const resource = owned.source;

    if (resource.pdfStatus === "READY" && resource.pdfUrl) {
      await cleanupTempKey(tempKey, log);
      return {
        success: false,
        error:
          "Bu akademik eser için zaten bir PDF yüklü. Tekil kayıt kuralı gereği tekrar PDF yüklenemez.",
      };
    }

    const pipelineStart = performance.now();

    const { buffer, chunks, metadata } = await fetchAndExtractPdf(
      tempKey,
      originalFileName,
      log,
    );

    await db
      .update(sources)
      .set({
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Belirtilmemiş",
        publicationYear: metadata.publicationYear,
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
      await cleanupTempKey(tempKey, log);
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
    });

    await cleanupTempKey(tempKey, log);

    log.info("complete_resource_pdf_success", {
      service: "library",
      data: {
        resourceId,
        apaFileName,
        pdfUrl: pipelineResult.r2Url,
        initialSize: buffer.length,
        finalSize: pipelineResult.finalSize,
        chunkCount: pipelineResult.chunkCount,
        durationMs: Math.round(performance.now() - pipelineStart),
      },
    });

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

    await cleanupTempKey(tempKey, log);

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

/** Server Action (Step 1 of 2): Generates a presigned upload URL for creating a new resource from a PDF. */
export async function requestPdfCreateUploadAction(): Promise<
  | { success: true; presignedUrl: string; tempKey: string }
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

    return { success: true, presignedUrl, tempKey };
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
 * Server Action (Step 2 of 2): Fetches the PDF from R2, creates a new resource,
 * runs the full RAG pipeline, and cleans up the temp file. Targets a sub-box when
 * the parent has sub-boxes, otherwise the parent box.
 */
export async function completePdfCreateUploadAction(
  tempKey: string,
  originalFileName: string,
  boxId: number,
): Promise<
  | { success: true; data: LibraryResourceItem }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  let createdResourceId: number | undefined;
  let uploadedPdfFileName: string | undefined;

  try {
    const session = await getSession();
    if (!session) {
      await cleanupTempKey(tempKey, log);
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!originalFileName.toLowerCase().endsWith(".pdf")) {
      await cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    const pipelineStart = performance.now();

    const { buffer, chunks, metadata } = await fetchAndExtractPdf(
      tempKey,
      originalFileName,
      log,
    );

    const targetBox = await db.query.boxes.findFirst({
      where: eq(boxes.id, boxId),
      with: { matrix: true },
    });

    if (!targetBox || targetBox.matrix.userId !== session.userId) {
      await cleanupTempKey(tempKey, log);
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
        publicationYear: metadata.publicationYear,
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
      await cleanupTempKey(tempKey, log);
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
    });

    await cleanupTempKey(tempKey, log);

    log.info("complete_pdf_create_success", {
      service: "library",
      data: {
        resourceId: newResource.id,
        title: newResource.title,
        finalFileName: apaFileName,
        pdfUrl: pipelineResult.r2Url,
        chunkCount: pipelineResult.chunkCount,
        durationMs: Math.round(performance.now() - pipelineStart),
      },
    });

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

    await cleanupTempKey(tempKey, log);

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
