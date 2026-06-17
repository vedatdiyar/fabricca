"use server";

import { and, eq, inArray, asc, sql } from "drizzle-orm";
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
 * @returns Approved resources array wrapped in a result object, or a user-safe error message
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
 * @returns Success or error result
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
 * 3. Returns the newly promoted resources.
 *
 * @param boxId - The thesis sub-box ID
 * @returns Newly promoted resources wrapped in a result object, or a user-safe error message
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

    /* ---- 2. Atomically fetch and promote RESERVED batch ---- */
    const txResult = await db.transaction(async (tx) => {
      const reservedBatch = await tx
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
        return { promoted: null as LibraryResource[] | null, remainingCount: 0 };
      }

      const batchIds = reservedBatch.map((r) => r.id);
      await tx
        .update(libraryResources)
        .set({ status: "APPROVED", isRead: false })
        .where(inArray(libraryResources.id, batchIds));

      const [{ count: remainingCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(libraryResources)
        .where(
          and(
            eq(libraryResources.thesisBoxId, boxId),
            eq(libraryResources.status, "RESERVED")
          )
        );

      return { promoted: reservedBatch, remainingCount };
    });

    if (!txResult.promoted || txResult.promoted.length === 0) {
      return {
        success: false,
        error:
          "Yedek havuz boş. Yeni kaynaklar hazırlanıyor, lütfen kısa süre sonra tekrar deneyin.",
      };
    }

    const { promoted: reservedBatch } = txResult;

    /* ---- 3. Return newly promoted resources (map in-memory, no re-query) ---- */
    const promotedResources = reservedBatch.map((r) => ({
      ...r,
      status: "APPROVED" as const,
      isRead: false,
    }));

    return { success: true, data: promotedResources };
  } catch (err) {
    log.error("replenish_reserved_failed", {
      service: "library",
      data: { boxId, error: String(err) },
    });
    return { success: false, error: "Kaynaklar yenilenirken bir hata oluştu." };
  }
}


