"use server";

import { and, eq, inArray, isNotNull, asc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { libraryResources, type LibraryResource } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";

/* ---------- Result Types ---------- */

export type GetApprovedResourcesResult =
  | { success: true; data: LibraryResource[] }
  | { success: false; error: string };

export type ToggleReadStatusResult =
  | { success: true }
  | { success: false; error: string };

export type ReplenishResult =
  | { success: true; data: LibraryResource[] }
  | { success: false; error: string };

/* ---------- Server Actions ---------- */

/**
 * Retrieves all APPROVED library resources for a given thesis sub-box.
 * Intended for TanStack Query with 5-minute staleTime.
 *
 * @param boxId - The thesis sub-box ID
 * @returns Approved resources or a user-safe error message
 */
export async function getApprovedResourcesAction(
  boxId: number
): Promise<GetApprovedResourcesResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
    }

    const resources = await db
      .select()
      .from(libraryResources)
      .where(
        and(
          eq(libraryResources.thesisBoxId, boxId),
          eq(libraryResources.status, "APPROVED")
        )
      )
      .orderBy(asc(libraryResources.id));

    return { success: true, data: resources };
  } catch (err) {
    log.error("get_approved_resources_failed", {
      service: "library",
      data: { boxId, error: String(err) },
    });
    return { success: false, error: "Kaynaklar yüklenirken bir hata oluştu." };
  }
}

/**
 * Toggles the isRead flag on a single library resource.
 *
 * @param resourceId - The resource ID to update
 * @param isRead - New boolean read state
 */
export async function toggleResourceReadStatusAction(
  resourceId: number,
  isRead: boolean
): Promise<ToggleReadStatusResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
    }

    await db
      .update(libraryResources)
      .set({ isRead })
      .where(eq(libraryResources.id, resourceId));

    return { success: true };
  } catch (err) {
    log.error("toggle_read_status_failed", {
      service: "library",
      data: { resourceId, isRead, error: String(err) },
    });
    return {
      success: false,
      error: "Okuma durumu güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Replenishes approved resources from the RESERVED pool.
 *
 * 1. Verifies that every currently APPROVED resource for this box is read.
 * 2. Promotes the next 5 RESERVED resources (oldest first) to APPROVED + isRead:false.
 * 3. If the remaining RESERVED pool drops below 5, triggers the async resource
 *    pipeline (fire-and-forget) to fetch new articles from external APIs.
 * 4. Returns the newly promoted resources.
 *
 * @param boxId - The thesis sub-box ID
 * @returns Newly approved resources or a user-safe error
 */
export async function replenishFromReservedAction(
  boxId: number
): Promise<ReplenishResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
    }

    /* ---- 1. Verify all APPROVED resources are read ---- */
    const approvedResources = await db
      .select()
      .from(libraryResources)
      .where(
        and(
          eq(libraryResources.thesisBoxId, boxId),
          eq(libraryResources.status, "APPROVED")
        )
      );

    const allRead =
      approvedResources.length > 0 &&
      approvedResources.every((r) => r.isRead === true);
    if (!allRead) {
      return {
        success: false,
        error: "Tüm kaynaklar okunmadan yeni kaynak yüklenemez.",
      };
    }

    /* ---- 2. Fetch next 5 RESERVED resources (oldest first) ---- */
    const reservedBatch = await db
      .select()
      .from(libraryResources)
      .where(
        and(
          eq(libraryResources.thesisBoxId, boxId),
          eq(libraryResources.status, "RESERVED")
        )
      )
      .orderBy(asc(libraryResources.id))
      .limit(5);

    if (reservedBatch.length === 0) {
      /* ---- 3a. Pool is empty — trigger pipeline, notify user ---- */
      const excludedDois = await collectExistingDois();
      void triggerResourcePipeline(excludedDois, boxId, log);

      return {
        success: false,
        error:
          "Yedek havuz boş. Yeni kaynaklar hazırlanıyor, lütfen kısa süre sonra tekrar deneyin.",
      };
    }

    /* ---- 3b. Promote RESERVED → APPROVED ---- */
    const batchIds = reservedBatch.map((r) => r.id);
    await db
      .update(libraryResources)
      .set({ status: "APPROVED", isRead: false })
      .where(inArray(libraryResources.id, batchIds));

    /* ---- 4. Check RESERVED pool threshold ---- */
    const [{ count: remainingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(libraryResources)
      .where(
        and(
          eq(libraryResources.thesisBoxId, boxId),
          eq(libraryResources.status, "RESERVED")
        )
      );

    if (remainingCount < 5) {
      const excludedDois = await collectExistingDois();
      void triggerResourcePipeline(excludedDois, boxId, log);
    }

    /* ---- 5. Return newly promoted resources ---- */
    const promotedResources = await db
      .select()
      .from(libraryResources)
      .where(inArray(libraryResources.id, batchIds))
      .orderBy(asc(libraryResources.id));

    return { success: true, data: promotedResources };
  } catch (err) {
    log.error("replenish_reserved_failed", {
      service: "library",
      data: { boxId, error: String(err) },
    });
    return { success: false, error: "Kaynaklar yenilenirken bir hata oluştu." };
  }
}

/* ---------- Pipeline Helpers ---------- */

/**
 * Collects all non-null DOIs from library_resources to serve as an
 * exclusion filter when fetching new articles from external APIs.
 */
async function collectExistingDois(): Promise<string[]> {
  const rows = await db
    .select({ doi: libraryResources.doi })
    .from(libraryResources)
    .where(isNotNull(libraryResources.doi));

  return rows.reduce<string[]>((acc, r) => {
    if (r.doi !== null) acc.push(r.doi);
    return acc;
  }, []);
}

/**
 * Fire-and-forget resource pipeline trigger.
 *
 * STUB — Will be fully implemented in Adım 4 with the asynchronous
 * API motor pipeline. Currently logs the trigger intent.
 *
 * Planned behaviour:
 * 1. Call external academic APIs with excludedDois filter
 * 2. Fetch 20 unique new articles
 * 3. Batch insert them as RESERVED for this box
 *
 * @param excludedDois - DOI list to exclude from API results
 * @param boxId - Target thesis box ID for new resources
 * @param log - Logger instance
 */
async function triggerResourcePipeline(
  excludedDois: string[],
  boxId: number,
  log: Logger
): Promise<void> {
  log.info("resource_pipeline_triggered", {
    service: "library",
    data: {
      boxId,
      excludedDoiCount: excludedDois.length,
      message: "Pipeline stub — will be implemented in Adım 4",
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 100));
}
