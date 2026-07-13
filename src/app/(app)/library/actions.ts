"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  thesisBoxes,
  libraryResources,
  type LibraryResource,
} from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { sortLibraryResources } from "@/lib/academic/utils";

/* ---------- Zod Schemas ---------- */

const boxIdSchema = z
  .number()
  .int()
  .positive("Box ID must be a positive integer.");
const toggleReadSchema = z.object({
  resourceId: z
    .number()
    .int()
    .positive("Resource ID must be a positive integer."),
  isRead: z.boolean(),
});

/* ---------- Result Types ---------- */

export type GetBoxResourcesResult =
  | { success: true; data: LibraryResource[] }
  | { success: false; error: string };

export type ToggleReadStatusResult =
  { success: true } | { success: false; error: string };

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
  const parsed = boxIdSchema.safeParse(boxId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid box ID.",
    };
  }

  const flowId = createFlowId();
  const log = new Logger(flowId);

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  try {
    // If the box is a master box, also include resources from its sub-boxes
    const subBoxIds = await db
      .select({ id: thesisBoxes.id })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.parentId, parsed.data));
    const allIds = [parsed.data, ...subBoxIds.map((s) => s.id)];

    const rawResources = await db
      .select()
      .from(libraryResources)
      .where(inArray(libraryResources.thesisBoxId, allIds));

    const sortedResources = sortLibraryResources(rawResources);

    return { success: true, data: sortedResources.slice(0, 5) };
  } catch (err) {
    log.error("get_box_resources_failed", {
      service: "library",
      data: { boxId, error: String(err) },
    });
    return { success: false, error: "Failed to load resources." };
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
  const parsed = toggleReadSchema.safeParse({ resourceId, isRead });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const flowId = createFlowId();
  const log = new Logger(flowId);

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  try {
    const [res] = await db
      .select({ badge: libraryResources.badge })
      .from(libraryResources)
      .where(eq(libraryResources.id, parsed.data.resourceId));

    if (res?.badge === "CRITICAL_OVERLAP") {
      return {
        success: false,
        error:
          "Kritik çakışma riski taşıyan tez adayları için okuma durumu değiştirilemez.",
      };
    }

    await db
      .update(libraryResources)
      .set({ isRead: parsed.data.isRead })
      .where(eq(libraryResources.id, parsed.data.resourceId));

    return { success: true };
  } catch (err) {
    log.error("toggle_read_status_failed", {
      service: "library",
      data: { resourceId, isRead, error: String(err) },
    });
    return {
      success: false,
      error: "Failed to update read status.",
    };
  }
}
