import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { sources } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { formatApaPdfFileName } from "@/lib/academic/utils";
import { processResourcePdfPipeline } from "./pdf-pipeline";
import { fetchAndExtractPdf } from "./pdf-upload";
import { cleanupTempKey } from "./pdf-service";
import type { LibraryResourceItem } from "@/app/(app)/library/_lib/types";
import { resolveCreateTarget, resolveUpgradeTarget } from "./upload-target";
import { buildCompletionResourceItem } from "./upload-result-mapper";
import {
  validateDuplicatePdf,
  handleUploadFailureRollback,
} from "./upload-guards";

/** Shared PDF upload completion parameters for both flows. */
export interface CompletePdfUploadBaseParams {
  /** R2 temp object key of the uploaded PDF. */
  tempKey: string;
  /** Original file name of the uploaded PDF. */
  fileName: string;
  /** Optional flow identifier for logging. */
  flowId?: string;
  /** Optional timestamp when the upload started (for duration logging). */
  uploadStartedAt?: number;
  /** Optional pre-loaded PDF buffer (Uint8Array-serializable) that skips the R2 read. */
  pdfBuffer?: number[];
}

/** Upgrades an existing resource with the uploaded PDF. */
export interface CompleteResourcePdfUploadParams extends CompletePdfUploadBaseParams {
  createMode: false;
  resourceId: number;
}

/** Creates a brand-new resource from the uploaded PDF inside the given box. */
export interface CompletePdfCreateUploadParams extends CompletePdfUploadBaseParams {
  createMode: true;
  boxId: number;
}

export type CompletePdfUploadParams =
  CompleteResourcePdfUploadParams | CompletePdfCreateUploadParams;

export type CompletePdfUploadResult =
  | { success: true; data: LibraryResourceItem }
  | { success: false; error: string };

/**
 * Shared PDF upload completion: validates the session and file type, extracts the
 * PDF, attaches it to an existing resource or a freshly created one, runs the full
 * RAG pipeline, cleans up the temp object, and rolls back on failure.
 *
 * @param params - Discriminated upload completion parameters.
 * @returns The updated or created resource item, or an error message on failure.
 */
export async function completePdfUploadCore(
  params: CompletePdfUploadParams,
): Promise<CompletePdfUploadResult> {
  const { createMode, tempKey, fileName, flowId, uploadStartedAt, pdfBuffer } =
    params;
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

    if (!fileName.toLowerCase().endsWith(".pdf")) {
      cleanupTempKey(tempKey, log);
      return {
        success: false,
        error: "Yalnızca PDF formatındaki dosyalar yüklenebilir.",
      };
    }

    const preloadedBuffer = pdfBuffer ? Buffer.from(pdfBuffer) : undefined;

    const { buffer, chunks, metadata, parsedReferences } =
      await fetchAndExtractPdf(tempKey, fileName, log, preloadedBuffer);

    const apaFileName = formatApaPdfFileName(
      metadata.authors,
      metadata.publicationYear,
      metadata.title,
    );

    const resolution = createMode
      ? await resolveCreateTarget(
          session.userId,
          params.boxId,
          metadata,
          tempKey,
          log,
        )
      : await resolveUpgradeTarget(
          params.resourceId,
          session.userId,
          metadata,
          tempKey,
          log,
        );

    if (!resolution.ok) {
      return { success: false, error: resolution.error };
    }

    const { target } = resolution;
    createdResourceId = target.createdResourceId;

    const duplicateCheck = await validateDuplicatePdf(
      apaFileName,
      createMode,
      target.targetResourceId,
    );

    if (duplicateCheck.isDuplicate) {
      cleanupTempKey(tempKey, log);
      if (createMode && createdResourceId != null) {
        await db.delete(sources).where(eq(sources.id, createdResourceId));
      }
      return {
        success: false,
        error:
          duplicateCheck.errorMessage ?? "Aynı ada sahip bir PDF zaten mevcut.",
      };
    }

    if (!createMode) {
      await db
        .update(sources)
        .set({ pdfStatus: "PROCESSING" })
        .where(eq(sources.id, target.targetResourceId));
    }

    uploadedPdfFileName = apaFileName;

    const pipelineResult = await processResourcePdfPipeline({
      resourceId: target.targetResourceId,
      fileName: apaFileName,
      buffer,
      log,
      precomputedChunks: chunks,
      precomputedMetadata: metadata,
      precomputedReferences: parsedReferences,
    });

    cleanupTempKey(tempKey, log);

    log.total(
      createMode ? "complete_pdf_create" : "complete_resource_pdf",
      Math.round(performance.now() - pipelineStart),
      {
        service: "library",
        data: createMode
          ? {
              resourceId: target.targetResourceId,
              title: target.targetResource.title,
              finalFileName: apaFileName,
              pdfUrl: pipelineResult.r2Url,
              chunkCount: pipelineResult.chunkCount,
            }
          : {
              resourceId: target.targetResourceId,
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
      data: buildCompletionResourceItem(
        createMode,
        target.targetResource,
        target.boxMeta,
        metadata,
        pipelineResult,
      ),
    };
  } catch (err) {
    log.error(
      createMode
        ? "complete_pdf_create_failed"
        : "complete_resource_pdf_failed",
      {
        service: "library",
        error: err,
      },
    );

    cleanupTempKey(tempKey, log);

    await handleUploadFailureRollback({
      createMode,
      createdResourceId,
      uploadedPdfFileName,
      resourceId: !createMode ? params.resourceId : undefined,
      log,
    });

    return {
      success: false,
      error: createMode
        ? "PDF yüklenirken ve künye bilgileri çıkarılırken bir hata oluştu."
        : "PDF yüklenirken, metadata çıkarılırken veya vektörleştirilirken bir hata oluştu.",
    };
  }
}
