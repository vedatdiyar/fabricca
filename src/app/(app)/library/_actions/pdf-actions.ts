"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { boxes, sources, chunks as chunkRows, notes } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  deletePdfFromR2,
  generatePresignedUploadUrl,
  getPdfFromR2,
  deleteR2Object,
} from "@/lib/services/r2";
import { extractPdfMetadata } from "@/lib/services/pdf-metadata";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import { parsePdfWithHybridRouter } from "@/lib/services/pdf-parser";
import { formatApaPdfFileName } from "@/lib/academic/utils";
import { processResourcePdfPipeline } from "../_services/pdf-pipeline";
import type { ThesisBoxType, LibraryResourceItem } from "../_types/types";

/**
 * Best-effort cleanup of a temporary R2 object (e.g. "temp/<uuid>.pdf").
 * Never throws: failures are logged and swallowed so the main flow can
 * return its real error without being interrupted by a cleanup failure.
 *
 * @param tempKey - R2 key of the temporary object to delete.
 * @param log - Logger instance for the current flow.
 */
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

/**
 * Server Action: Deletes a resource's PDF file from Cloudflare R2 and resets DB PDF status.
 *
 * @param resourceId - Target resource ID.
 */
export async function deleteResourcePdfAction(resourceId: number) {
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

/**
 * Server Action (Step 1 of 2): Validates the resource and returns a presigned upload URL
 * so the client can upload the PDF directly to R2, bypassing Vercel's 4.5MB body limit.
 *
 * @param resourceId - Target resource ID.
 * @returns Presigned URL and temporary R2 key.
 */
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

    const resource = await db.query.sources.findFirst({
      where: eq(sources.id, resourceId),
    });

    if (!resource) {
      return { success: false, error: "İlgili akademik eser bulunamadı." };
    }

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

    const tempKey = `temp/${crypto.randomUUID()}.pdf`;
    const presignedUrl = await generatePresignedUploadUrl(
      tempKey,
      "application/pdf",
    );

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
 * Server Action (Step 2 of 2): Fetches the PDF from R2 by its temp key, runs the full
 * metadata extraction + RAG pipeline, and cleans up the temp file.
 *
 * @param resourceId - Target resource ID.
 * @param tempKey - Temporary R2 key where the client uploaded the PDF.
 * @param originalFileName - Original file name (for Unstructured fallback).
 * @returns The updated resource data.
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

    const resource = await db.query.sources.findFirst({
      where: eq(sources.id, resourceId),
      with: { box: true },
    });

    if (!resource) {
      await cleanupTempKey(tempKey, log);
      return { success: false, error: "İlgili akademik eser bulunamadı." };
    }

    if (resource.pdfStatus === "READY" && resource.pdfUrl) {
      await cleanupTempKey(tempKey, log);
      return {
        success: false,
        error:
          "Bu akademik eser için zaten bir PDF yüklü. Tekil kayıt kuralı gereği tekrar PDF yüklenemez.",
      };
    }

    const pipelineStart = performance.now();

    // 1. Fetch PDF buffer from R2 temp key
    log.info("complete_resource_pdf_fetch_from_r2_start", {
      service: "library",
      data: { resourceId, tempKey },
    });
    const buffer = await getPdfFromR2(tempKey);
    log.info("complete_resource_pdf_fetch_from_r2_success", {
      service: "library",
      data: { resourceId, size: buffer.length },
    });

    // 2. Parse via Hybrid Router (local unpdf or Unstructured fallback)
    const chunks = await parsePdfWithHybridRouter(
      buffer,
      originalFileName,
      log,
    );

    // 3. Extract metadata
    const metadata = await extractPdfMetadata(chunks, originalFileName, log);

    // 3b. Sanitize metadata — Cerebras zaten sanitize eder, API yolları eder
    if (metadata.source !== "cerebras") {
      const [sanitizedMeta] = await sanitizeAcademicDataBulk(
        [{ title: metadata.title, author: metadata.authors.join(", ") }],
        log,
      );
      metadata.title = sanitizedMeta.title;
      metadata.authors = sanitizedMeta.author.split(", ").filter(Boolean);
    }

    // 4. Overwrite existing resource metadata
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

    // 5. Generate APA filename
    const apaFileName = formatApaPdfFileName(
      metadata.authors,
      metadata.publicationYear,
      metadata.title,
    );

    // 6. Check for duplicate filename
    const existingDuplicate = await db.query.sources.findFirst({
      where: and(
        eq(sources.pdfFileName, apaFileName),
        eq(sources.pdfStatus, "READY"),
      ),
    });

    if (existingDuplicate && existingDuplicate.id !== resourceId) {
      await cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: `Bu akademik yayın PDF'i (${apaFileName}) sistemde başka bir kayıtta zaten mevcut. Kopya kayıtlara izin verilmemektedir.`,
      };
    }

    // Update status to PROCESSING
    await db
      .update(sources)
      .set({ pdfStatus: "PROCESSING" })
      .where(eq(sources.id, resourceId));

    // 7. Run shared pipeline (uploads to final APA-named key, generates embeddings)
    const pipelineResult = await processResourcePdfPipeline({
      resourceId,
      fileName: apaFileName,
      buffer,
      log,
      precomputedChunks: chunks,
    });

    // 8. Clean up temp file from R2
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
      data: {
        id: resource.id,
        boxType: resource.box.boxType as Exclude<ThesisBoxType, "ALL">,
        subBoxId: resource.box.parentId ? resource.box.id : undefined,
        subBoxTitle: resource.box.parentId ? resource.box.title : undefined,
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Belirtilmemiş",
        publicationYear: metadata.publicationYear,
        doi: metadata.doi || undefined,
        openalexId: resource.openalexId || undefined,
        isRead: resource.isRead,
        pdfUrl: pipelineResult.r2Url,
        pdfFileName: apaFileName,
        pdfFileSize: pipelineResult.finalSize,
        pdfStatus: "READY" as const,
        sourceOrigin: "LITERATURE_EXPANSION" as const,
        createdAt: resource.createdAt.toISOString(),
      },
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

/**
 * Server Action (Step 1 of 2): Generates a presigned upload URL for creating a new
 * resource from a PDF. The client uploads directly to R2, then calls completePdfCreateUploadAction.
 *
 * @returns Presigned URL and temporary R2 key.
 */
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

    const tempKey = `temp/${crypto.randomUUID()}.pdf`;
    const presignedUrl = await generatePresignedUploadUrl(
      tempKey,
      "application/pdf",
    );

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
 * Server Action (Step 2 of 2): Fetches the PDF from R2 by its temp key, extracts metadata,
 * creates a new library resource, runs the full RAG pipeline, and cleans up the temp file.
 *
 * @param tempKey - Temporary R2 key where the client uploaded the PDF.
 * @param originalFileName - Original file name (for Unstructured fallback).
 * @param boxId - Target thesis box ID (a sub-box when the parent has sub-boxes, otherwise the parent box).
 * @returns The newly created resource data.
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

    // 1. Fetch PDF buffer from R2 temp key
    log.info("complete_pdf_create_fetch_from_r2_start", {
      service: "library",
      data: { tempKey },
    });
    const buffer = await getPdfFromR2(tempKey);
    log.info("complete_pdf_create_fetch_from_r2_success", {
      service: "library",
      data: { size: buffer.length },
    });

    // 2. Parse via Hybrid Router (local unpdf or Unstructured fallback)
    const chunks = await parsePdfWithHybridRouter(
      buffer,
      originalFileName,
      log,
    );

    // 3. Extract metadata
    const metadata = await extractPdfMetadata(chunks, originalFileName, log);

    // 3b. Sanitize metadata — Cerebras zaten sanitize eder, API yolları eder
    if (metadata.source !== "cerebras") {
      const [sanitizedMeta] = await sanitizeAcademicDataBulk(
        [{ title: metadata.title, author: metadata.authors.join(", ") }],
        log,
      );
      metadata.title = sanitizedMeta.title;
      metadata.authors = sanitizedMeta.author.split(", ").filter(Boolean);
    }

    // 4. Resolve target thesis box by ID and verify ownership
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

    // 7. Create library resource record
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

    // 8. Generate APA filename
    const apaFileName = formatApaPdfFileName(
      newResource.authors,
      newResource.publicationYear,
      newResource.title,
    );

    // 9. Check for duplicate filename
    const existingDuplicate = await db.query.sources.findFirst({
      where: and(
        eq(sources.pdfFileName, apaFileName),
        eq(sources.pdfStatus, "READY"),
      ),
    });

    const finalFileName = existingDuplicate
      ? `${apaFileName.replace(/\.pdf$/i, "")}_${newResource.id}.pdf`
      : apaFileName;

    uploadedPdfFileName = finalFileName;

    // 10. Run shared RAG pipeline
    const pipelineResult = await processResourcePdfPipeline({
      resourceId: newResource.id,
      fileName: finalFileName,
      buffer,
      log,
      precomputedChunks: chunks,
    });

    // 11. Clean up temp file
    await cleanupTempKey(tempKey, log);

    log.info("complete_pdf_create_success", {
      service: "library",
      data: {
        resourceId: newResource.id,
        title: newResource.title,
        finalFileName,
        pdfUrl: pipelineResult.r2Url,
        chunkCount: pipelineResult.chunkCount,
        durationMs: Math.round(performance.now() - pipelineStart),
      },
    });

    return {
      success: true,
      data: {
        id: newResource.id,
        boxType: (targetBox.boxType || "THEORETICAL_FRAMEWORK") as Exclude<
          ThesisBoxType,
          "ALL"
        >,
        subBoxId: targetBox.parentId ? targetBox.id : undefined,
        subBoxTitle: targetBox.parentId ? targetBox.title : undefined,
        title: newResource.title,
        authors: newResource.authors || ["Bilinmeyen Yazar"],
        publisher: newResource.publisher || "Belirtilmemiş",
        publicationYear:
          newResource.publicationYear || new Date().getFullYear(),
        doi: newResource.doi || undefined,
        openalexId: newResource.openalexId || undefined,
        isRead: false,
        pdfUrl: pipelineResult.r2Url,
        pdfFileName: finalFileName,
        pdfStatus: "READY" as const,
        sourceOrigin: "LITERATURE_EXPANSION" as const,
        createdAt: newResource.createdAt.toISOString(),
      },
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
      error:
        err instanceof Error
          ? err.message
          : "PDF yüklenirken ve künye bilgileri çıkarılırken bir hata oluştu.",
    };
  }
}
