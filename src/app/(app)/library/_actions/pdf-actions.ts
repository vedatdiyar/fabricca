"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  resourceEmbeddings,
  libraryResourceNotes,
} from "@/db/schema";
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
import { getBoxDefaultTitle } from "../_services/helpers";
import type { ThesisBoxType, LibraryResourceItem } from "../_types/types";

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

    const resource = await db.query.libraryResources.findFirst({
      where: eq(libraryResources.id, resourceId),
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

    await db
      .delete(resourceEmbeddings)
      .where(eq(resourceEmbeddings.libraryResourceId, resourceId));

    await db
      .delete(libraryResourceNotes)
      .where(eq(libraryResourceNotes.libraryResourceId, resourceId));

    await db
      .update(libraryResources)
      .set({
        pdfUrl: null,
        pdfFileName: null,
        pdfFileSize: null,
        pdfStatus: "NOT_UPLOADED",
      })
      .where(eq(libraryResources.id, resourceId));

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

    const resource = await db.query.libraryResources.findFirst({
      where: eq(libraryResources.id, resourceId),
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
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!originalFileName.toLowerCase().endsWith(".pdf")) {
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    const resource = await db.query.libraryResources.findFirst({
      where: eq(libraryResources.id, resourceId),
      with: { thesisBox: true },
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
      .update(libraryResources)
      .set({
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Belirtilmemiş",
        publicationYear: metadata.publicationYear,
        doi: metadata.doi || null,
      })
      .where(eq(libraryResources.id, resourceId));

    // 5. Generate APA filename
    const apaFileName = formatApaPdfFileName(
      metadata.authors,
      metadata.publicationYear,
      metadata.title,
    );

    // 6. Check for duplicate filename
    const existingDuplicate = await db.query.libraryResources.findFirst({
      where: and(
        eq(libraryResources.pdfFileName, apaFileName),
        eq(libraryResources.pdfStatus, "READY"),
      ),
    });

    if (existingDuplicate && existingDuplicate.id !== resourceId) {
      return {
        success: false,
        error: `Bu akademik yayın PDF'i (${apaFileName}) sistemde başka bir kayıtta zaten mevcut. Kopya kayıtlara izin verilmemektedir.`,
      };
    }

    // Update status to PROCESSING
    await db
      .update(libraryResources)
      .set({ pdfStatus: "PROCESSING" })
      .where(eq(libraryResources.id, resourceId));

    // 7. Run shared pipeline (uploads to final APA-named key, generates embeddings)
    const pipelineResult = await processResourcePdfPipeline({
      resourceId,
      fileName: apaFileName,
      buffer,
      log,
      precomputedChunks: chunks,
    });

    // 8. Clean up temp file from R2
    try {
      await deleteR2Object(tempKey);
    } catch {
      log.info("complete_resource_pdf_temp_delete_info", {
        service: "library",
        data: { tempKey },
      });
    }

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
        boxType: resource.thesisBox.boxType as Exclude<ThesisBoxType, "ALL">,
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Belirtilmemiş",
        publicationYear: metadata.publicationYear,
        doi: metadata.doi || undefined,
        url: resource.url || undefined,
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

    await db
      .update(libraryResources)
      .set({ pdfStatus: "FAILED" })
      .where(eq(libraryResources.id, resourceId));

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
 * @param boxType - Target thesis box type for the new resource.
 * @returns The newly created resource data.
 */
export async function completePdfCreateUploadAction(
  tempKey: string,
  originalFileName: string,
  boxType: Exclude<ThesisBoxType, "ALL">,
): Promise<
  | { success: true; data: LibraryResourceItem }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!originalFileName.toLowerCase().endsWith(".pdf")) {
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

    // 4. Find or create target thesis box
    const matrix = await db.query.thesisMatrices.findFirst({
      where: eq(thesisMatrices.userId, session.userId),
      with: { thesisBoxes: true },
    });

    let targetBox = matrix?.thesisBoxes.find((b) => b.boxType === boxType);
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
          boxType: boxType,
          title: getBoxDefaultTitle(boxType),
        })
        .returning();

      targetBox = newBox;
    }

    // 7. Create library resource record
    const [newResource] = await db
      .insert(libraryResources)
      .values({
        thesisBoxId: targetBox.id,
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Belirtilmemiş",
        publicationYear: metadata.publicationYear,
        doi: metadata.doi || null,
        url: null,
        isRead: false,
        pdfStatus: "PROCESSING",
      })
      .returning();

    // 8. Generate APA filename
    const apaFileName = formatApaPdfFileName(
      newResource.authors,
      newResource.publicationYear,
      newResource.title,
    );

    // 9. Check for duplicate filename
    const existingDuplicate = await db.query.libraryResources.findFirst({
      where: and(
        eq(libraryResources.pdfFileName, apaFileName),
        eq(libraryResources.pdfStatus, "READY"),
      ),
    });

    const finalFileName = existingDuplicate
      ? `${apaFileName.replace(/\.pdf$/i, "")}_${newResource.id}.pdf`
      : apaFileName;

    // 10. Run shared RAG pipeline
    const pipelineResult = await processResourcePdfPipeline({
      resourceId: newResource.id,
      fileName: finalFileName,
      buffer,
      log,
      precomputedChunks: chunks,
    });

    // 11. Clean up temp file
    try {
      await deleteR2Object(tempKey);
    } catch {
      log.info("complete_pdf_create_temp_delete_info", {
        service: "library",
        data: { tempKey },
      });
    }

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
        boxType,
        title: newResource.title,
        authors: newResource.authors || ["Bilinmeyen Yazar"],
        publisher: newResource.publisher || "Belirtilmemiş",
        publicationYear:
          newResource.publicationYear || new Date().getFullYear(),
        doi: newResource.doi || undefined,
        url: undefined,
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
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "PDF yüklenirken ve künye bilgileri çıkarılırken bir hata oluştu.",
    };
  }
}
