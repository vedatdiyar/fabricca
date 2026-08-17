import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { sources } from "@/core/db/schema";
import { deletePdfFromR2 } from "@/core/services/storage/r2";
import type { Logger } from "@/lib/logger";
import {
  findReadySourceByPdfName,
  buildDuplicatePdfError,
} from "./pdf-service";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  errorMessage?: string;
}

/**
 * Checks whether a PDF with the given APA name already exists and belongs to a different resource.
 *
 * @param apaFileName - Formatted APA PDF file name.
 * @param createMode - Whether this is a new resource upload.
 * @param targetResourceId - Target resource ID.
 * @returns Duplicate validation outcome.
 */
export async function validateDuplicatePdf(
  apaFileName: string,
  createMode: boolean,
  targetResourceId: number,
): Promise<DuplicateCheckResult> {
  const existingDuplicate = await findReadySourceByPdfName(apaFileName);
  const isSelfDuplicate =
    !createMode && existingDuplicate?.id === targetResourceId;

  if (existingDuplicate && !isSelfDuplicate) {
    return {
      isDuplicate: true,
      errorMessage: buildDuplicatePdfError(apaFileName),
    };
  }

  return { isDuplicate: false };
}

/**
 * Handles cleanup, R2 orphan deletion, and DB rollback when a PDF upload pipeline fails.
 *
 * @param params - Failure rollback parameters.
 */
export async function handleUploadFailureRollback(params: {
  createMode: boolean;
  createdResourceId?: number;
  uploadedPdfFileName?: string;
  resourceId?: number;
  log: Logger;
}): Promise<void> {
  const {
    createMode,
    createdResourceId,
    uploadedPdfFileName,
    resourceId,
    log,
  } = params;

  if (!createMode && resourceId != null) {
    await db
      .update(sources)
      .set({ pdfStatus: "FAILED" })
      .where(eq(sources.id, resourceId));
    return;
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
}
