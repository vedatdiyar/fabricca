"use server";

import { eq, asc, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { libraryResources, type LibraryResource } from "@/db/schema";
import { getSession } from "@/session";
import { createFlowId, Logger } from "@/lib/logger";

/* ---------- Result Types ---------- */

export type GetBoxResourcesResult =
  | { success: true; data: LibraryResource[] }
  | { success: false; error: string };

export type ToggleReadStatusResult =
  | { success: true }
  | { success: false; error: string };

/* ---------- Server Actions ---------- */

/**
 * Retrieves the top 5 library resources for a given thesis sub-box,
 * ordered by isFoundational (foundational first), then relevanceScore descending,
 * then id ascending for deterministic ordering.
 *
 * @param boxId - The thesis sub-box ID
 * @returns Resources array wrapped in a result object, or a user-safe error message
 */
export async function getBoxResourcesAction(
  boxId: number,
): Promise<GetBoxResourcesResult> {
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
      .where(eq(libraryResources.thesisBoxId, boxId))
      .orderBy(
        desc(libraryResources.isFoundational),
        desc(libraryResources.relevanceScore),
        asc(libraryResources.id),
      )
      .limit(5);

    return { success: true, data: resources };
  } catch (err) {
    log.error("get_box_resources_failed", {
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
  isRead: boolean,
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
