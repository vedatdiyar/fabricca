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
import { deletePdfFromR2 } from "@/lib/services/r2";
import { extractPdfMetadata } from "@/lib/services/pdf-metadata";
import { parsePdfWithUnstructured } from "@/lib/services/unstructured";
import { formatApaPdfFileName } from "@/lib/academic/utils";
import { processResourcePdfPipeline } from "../_services/pdf-pipeline";
import { getBoxDefaultTitle } from "../_services/helpers";
import type { ThesisBoxType } from "../_types/types";

/**
 * Server Action: Uploads a PDF file for an existing resource, extracts text, chunks it, and vectorizes embeddings.
 *
 * @param resourceId - Target resource ID.
 * @param formData - FormData containing the file.
 */
export async function uploadResourcePdfAction(
  resourceId: number,
  formData: FormData,
) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "Lütfen bir PDF dosyası seçiniz." };
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    // 1. Fetch resource metadata & check existing PDF status
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

    // 2. Generate standardized APA format filename
    const apaFileName = formatApaPdfFileName(
      resource.authors,
      resource.publicationYear,
      resource.title,
    );

    // 3. Check for duplicate PDF filename across all records
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Run shared RAG ingestion pipeline
    const pipelineResult = await processResourcePdfPipeline({
      resourceId,
      fileName: apaFileName,
      buffer,
      log,
    });

    log.info("upload_resource_pdf_success", {
      service: "library",
      data: {
        resourceId,
        apaFileName,
        pdfUrl: pipelineResult.r2Url,
        initialSize: bytes.byteLength,
        finalSize: pipelineResult.finalSize,
        chunkCount: pipelineResult.chunkCount,
        maxPage: pipelineResult.maxPage,
      },
    });

    return {
      success: true,
      data: {
        pdfUrl: pipelineResult.r2Url,
        pdfFileName: apaFileName,
        pdfStatus: "READY" as const,
      },
    };
  } catch (err) {
    log.error("upload_resource_pdf_failed", {
      service: "library",
      error: err,
    });

    await db
      .update(libraryResources)
      .set({ pdfStatus: "FAILED" })
      .where(eq(libraryResources.id, resourceId));

    return {
      success: false,
      error: "PDF yüklenirken ve vektörleştirilirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action: Uploads a PDF file, extracts metadata via Unstructured + DOI/Crossref/Gemini,
 * creates a new library resource item, and runs the full RAG pipeline.
 *
 * @param formData - FormData containing the file and boxType.
 */
export async function createResourceFromPdfAction(formData: FormData) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const file = formData.get("file") as File | null;
    const boxType =
      (formData.get("boxType") as Exclude<ThesisBoxType, "ALL">) ||
      "THEORETICAL_FRAMEWORK";

    if (!file) {
      return { success: false, error: "Lütfen bir PDF dosyası seçiniz." };
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const initialSize = buffer.length;

    // 1. TEK Unstructured çağrısı — hem metadata hem chunk'lar için
    log.info("create_resource_pdf_unstructured_start", {
      service: "library",
      data: { fileName: file.name, size: initialSize, boxType },
    });
    const chunks = await parsePdfWithUnstructured(buffer, file.name);

    // 2. Metadata çıkarımı (DOI → Crossref, yoksa Gemini, yoksa filename fallback)
    const metadata = await extractPdfMetadata(chunks, file.name, log);

    // 3. Find or create target thesis box
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

    // 4. Create library resource record with extracted metadata
    const [newResource] = await db
      .insert(libraryResources)
      .values({
        thesisBoxId: targetBox.id,
        title: metadata.title,
        authors: metadata.authors,
        publisher: metadata.publisher || "Akademik Yayın",
        publicationYear: metadata.publicationYear,
        doi: metadata.doi || null,
        url: null,
        isRead: false,
        pdfStatus: "PROCESSING",
      })
      .returning();

    // 5. Generate standardized APA format filename
    const apaFileName = formatApaPdfFileName(
      newResource.authors,
      newResource.publicationYear,
      newResource.title,
    );

    // 6. Check for duplicate PDF filename across READY records
    const existingDuplicate = await db.query.libraryResources.findFirst({
      where: and(
        eq(libraryResources.pdfFileName, apaFileName),
        eq(libraryResources.pdfStatus, "READY"),
      ),
    });

    const finalFileName = existingDuplicate
      ? `${apaFileName.replace(/\.pdf$/i, "")}_${newResource.id}.pdf`
      : apaFileName;

    // 7. Run shared RAG ingestion pipeline (Unstructured ATLANDI — precomputedChunks kullanılır)
    const pipelineResult = await processResourcePdfPipeline({
      resourceId: newResource.id,
      fileName: finalFileName,
      buffer,
      log,
      precomputedChunks: chunks,
    });

    log.info("create_resource_from_pdf_success", {
      service: "library",
      data: {
        resourceId: newResource.id,
        title: newResource.title,
        finalFileName,
        pdfUrl: pipelineResult.r2Url,
        chunkCount: pipelineResult.chunkCount,
      },
    });

    return {
      success: true,
      data: {
        id: newResource.id,
        boxType,
        title: newResource.title,
        authors: newResource.authors || ["Bilinmeyen Yazar"],
        publisher: newResource.publisher || "Akademik Yayın",
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
    log.error("create_resource_from_pdf_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "PDF yüklenirken ve künye bilgileri çıkarılırken bir hata oluştu.",
    };
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
        log.warn("r2_delete_file_warning", { service: "library", error: err });
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
