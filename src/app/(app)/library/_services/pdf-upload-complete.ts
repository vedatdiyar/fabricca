import { eq } from "drizzle-orm";
import { db } from "@/db";
import { boxes, sources } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { deletePdfFromR2 } from "@/services/storage/r2";
import { formatApaPdfFileName } from "@/lib/academic/utils";
import { getOwnedSource } from "@/services/box/ownership";
import { processResourcePdfPipeline } from "./pdf-pipeline";
import { fetchAndExtractPdf, type ExtractedPdfContent } from "./pdf-upload";
import {
  mapSourceToResource,
  type ResourceBoxContext,
} from "./resource-mapper";
import {
  cleanupTempKey,
  findReadySourceByPdfName,
  buildDuplicatePdfError,
} from "./pdf-service";
import type { LibraryResourceItem } from "../_lib/types";

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

/** Source row shape consumed by the resource mapper. */
type ResourceSourceRow = Parameters<typeof mapSourceToResource>[0];

/** Resolved upload target shared by the create and upgrade flows. */
interface ResolvedUploadTarget {
  createdResourceId?: number;
  targetResource: ResourceSourceRow;
  targetResourceId: number;
  boxMeta: ResourceBoxContext;
}

type TargetResolution =
  { ok: true; target: ResolvedUploadTarget } | { ok: false; error: string };

/**
 * Creates a brand-new source row from the extracted metadata inside the given box,
 * verifying that the box belongs to the current user first.
 *
 * @param sessionUserId - The authenticated user's ID.
 * @param boxId - The target topic box ID.
 * @param metadata - The extracted PDF metadata.
 * @param tempKey - The R2 temp key cleaned up on failure.
 * @param log - The structured logger instance.
 * @returns The resolved create target, or an error message on failure.
 */
async function resolveCreateTarget(
  sessionUserId: number,
  boxId: number,
  metadata: ExtractedPdfContent["metadata"],
  tempKey: string,
  log: Logger,
): Promise<TargetResolution> {
  const targetBox = await db.query.boxes.findFirst({
    where: eq(boxes.id, boxId),
    with: { matrix: true },
  });

  if (!targetBox || targetBox.matrix.userId !== sessionUserId) {
    cleanupTempKey(tempKey, log);
    return {
      ok: false,
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

  return {
    ok: true,
    target: {
      createdResourceId: newResource.id,
      targetResource: newResource,
      targetResourceId: newResource.id,
      boxMeta: {
        boxType: targetBox.boxType,
        title: targetBox.title,
        parentId: targetBox.parentId,
      },
    },
  };
}

/**
 * Attaches the uploaded PDF to an existing owned resource, rejecting uploads when the
 * resource already carries a READY PDF and refreshing the bibliographic metadata from
 * the extracted PDF before returning.
 *
 * @param resourceId - The existing resource to upgrade.
 * @param sessionUserId - The authenticated user's ID.
 * @param metadata - The extracted PDF metadata.
 * @param tempKey - The R2 temp key cleaned up on failure.
 * @param log - The structured logger instance.
 * @returns The resolved upgrade target, or an error message on failure.
 */
async function resolveUpgradeTarget(
  resourceId: number,
  sessionUserId: number,
  metadata: ExtractedPdfContent["metadata"],
  tempKey: string,
  log: Logger,
): Promise<TargetResolution> {
  const owned = await getOwnedSource(resourceId, sessionUserId);
  if ("error" in owned) {
    cleanupTempKey(tempKey, log);
    return { ok: false, error: owned.error };
  }
  const resource = owned.source;

  if (resource.pdfStatus === "READY" && resource.pdfUrl) {
    cleanupTempKey(tempKey, log);
    return {
      ok: false,
      error:
        "Bu akademik eser için zaten bir PDF yüklü. Tekil kayıt kuralı gereği tekrar PDF yüklenemez.",
    };
  }

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

  return {
    ok: true,
    target: {
      targetResource: resource,
      targetResourceId: resource.id,
      boxMeta: {
        boxType: resource.box.boxType,
        title: resource.box.title,
        parentId: resource.box.parentId,
      },
    },
  };
}

/**
 * Builds the final client-facing resource item with the freshly extracted metadata
 * and pipeline PDF results, using the create vs upgrade field overrides.
 *
 * @param createMode - Whether this is a new-resource or existing-resource flow.
 * @param targetResource - The resolved source row.
 * @param boxMeta - The box context for the target resource.
 * @param metadata - The extracted PDF metadata.
 * @param pipelineResult - The pipeline result with R2 URL and chunk data.
 * @returns The mapped LibraryResourceItem DTO.
 */
function buildCompletionResourceItem(
  createMode: boolean,
  targetResource: ResourceSourceRow,
  boxMeta: ResourceBoxContext,
  metadata: ExtractedPdfContent["metadata"],
  pipelineResult: {
    r2Url: string;
    finalFileName: string;
    finalSize: number;
  },
): LibraryResourceItem {
  return mapSourceToResource(
    targetResource,
    boxMeta,
    createMode
      ? {
          isRead: false,
          pdfUrl: pipelineResult.r2Url,
          pdfFileName: pipelineResult.finalFileName,
          pdfFileSize: pipelineResult.finalSize,
          pdfStatus: "READY",
        }
      : {
          title: metadata.title,
          authors: metadata.authors,
          publisher: metadata.publisher || "Belirtilmemiş",
          publicationYear: metadata.publicationYear,
          doi: metadata.doi || undefined,
          pdfUrl: pipelineResult.r2Url,
          pdfFileName: pipelineResult.finalFileName,
          pdfFileSize: pipelineResult.finalSize,
          pdfStatus: "READY",
        },
  );
}

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

    const existingDuplicate = await findReadySourceByPdfName(apaFileName);
    const isSelfDuplicate =
      !createMode && existingDuplicate?.id === target.targetResourceId;
    if (existingDuplicate && !isSelfDuplicate) {
      cleanupTempKey(tempKey, log);
      if (createMode && createdResourceId != null) {
        await db.delete(sources).where(eq(sources.id, createdResourceId));
      }
      return {
        success: false,
        error: buildDuplicatePdfError(apaFileName),
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

    if (!createMode) {
      await db
        .update(sources)
        .set({ pdfStatus: "FAILED" })
        .where(eq(sources.id, params.resourceId));

      return {
        success: false,
        error:
          "PDF yüklenirken, metadata çıkarılırken veya vektörleştirilirken bir hata oluştu.",
      };
    }

    if (createdResourceId != null) {
      if (uploadedPdfFileName) {
        try {
          await deletePdfFromR2(uploadedPdfFileName);
        } catch (err) {
          log.warn("r2_orphan_pdf_cleanup_failed", {
            service: "library",
            data: { uploadedPdfFileName },
            error: err,
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
