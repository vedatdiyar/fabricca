import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";
import type { Logger } from "@/lib/logger";
import {
  deleteR2Object,
  generatePresignedUploadUrl,
} from "@/services/storage/r2";

/**
 * Deletes a temporary R2 object best-effort, logging rather than throwing when deletion fails.
 *
 * @param tempKey - The R2 temp object key to clean up.
 * @param log - The structured logger instance.
 */
export async function cleanupTempKey(
  tempKey: string,
  log: Logger,
): Promise<void> {
  if (!tempKey) return;
  try {
    await deleteR2Object(tempKey);
  } catch (err) {
    log.warn("r2_temp_cleanup_failed", {
      service: "library",
      data: { tempKey },
      error: err,
    });
  }
}

/**
 * Generates a presigned R2 upload URL for a new temp PDF object.
 *
 * @returns The presigned upload URL and the associated temp object key.
 */
export async function generateTempPdfUploadUrl(): Promise<{
  presignedUrl: string;
  tempKey: string;
}> {
  const tempKey = `temp/${crypto.randomUUID()}.pdf`;
  const presignedUrl = await generatePresignedUploadUrl(
    tempKey,
    "application/pdf",
  );
  return { presignedUrl, tempKey };
}

/**
 * Finds a source with READY PDF status whose PDF file name matches the given APA file name.
 *
 * @param apaFileName - The APA-formatted PDF file name to search for.
 * @returns The matching source row, or undefined when not found.
 */
export async function findReadySourceByPdfName(apaFileName: string) {
  return db.query.sources.findFirst({
    where: and(
      eq(sources.pdfFileName, apaFileName),
      eq(sources.pdfStatus, "READY"),
    ),
  });
}

/**
 * Builds the Turkish error message for a duplicate APA-formatted PDF file name.
 *
 * @param apaFileName - The duplicate APA-formatted PDF file name.
 * @returns The duplicate PDF error message.
 */
export function buildDuplicatePdfError(apaFileName: string): string {
  return `Bu akademik yayın PDF'i (${apaFileName}) sistemde başka bir kayıtta zaten mevcut. Kopya kayıtlara izin verilmemektedir.`;
}
