import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { boxes, sources } from "@/core/db/schema";
import type { Logger } from "@/lib/logger";
import { getOwnedSource } from "@/core/services/box/ownership";
import type { ExtractedPdfContent } from "./pdf-upload";
import {
  mapSourceToResource,
  type ResourceBoxContext,
} from "./resource-mapper";
import { cleanupTempKey } from "./pdf-service";

export type ResourceSourceRow = Parameters<typeof mapSourceToResource>[0];

export interface ResolvedUploadTarget {
  createdResourceId?: number;
  targetResource: ResourceSourceRow;
  targetResourceId: number;
  boxMeta: ResourceBoxContext;
}

export type TargetResolution =
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
export async function resolveCreateTarget(
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
export async function resolveUpgradeTarget(
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
