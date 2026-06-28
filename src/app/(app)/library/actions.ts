"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  thesisBoxes,
  libraryResources,
  type LibraryResource,
} from "@/db/schema";
import { getSession } from "@/session";
import { createFlowId, Logger } from "@/lib/logger";

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
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
    }

    // Master kutu ise sub-box'larının ID'lerini de ekle
    const subBoxIds = await db
      .select({ id: thesisBoxes.id })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.parentId, boxId));
    const allIds = [boxId, ...subBoxIds.map((s) => s.id)];

    const rawResources = await db
      .select()
      .from(libraryResources)
      .where(inArray(libraryResources.thesisBoxId, allIds));

    // Öncelikli Sıralama:
    // 1. Kurucu Eserler (isFoundational = true)
    // 2. YÖK Tezleri (relevanceScore = 0.99)
    // 3. Normal Makaleler (relevanceScore desc)
    const sortedResources = [...rawResources].sort((a, b) => {
      // 1. Kurucu Eser Önceliği
      if (a.isFoundational && !b.isFoundational) return -1;
      if (!a.isFoundational && b.isFoundational) return 1;

      // 2. YÖK Tezi Önceliği
      if (!a.isFoundational && !b.isFoundational) {
        const isThesisA = a.relevanceScore === 0.99;
        const isThesisB = b.relevanceScore === 0.99;
        if (isThesisA && !isThesisB) return -1;
        if (!isThesisA && isThesisB) return 1;
      }

      // 3. Alaka Düzeyi
      const scoreA = a.relevanceScore ?? 0;
      const scoreB = b.relevanceScore ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      return a.id - b.id;
    });

    return { success: true, data: sortedResources.slice(0, 5) };
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

    const [res] = await db
      .select({ abstract: libraryResources.abstract })
      .from(libraryResources)
      .where(eq(libraryResources.id, resourceId));

    if (res?.abstract?.startsWith("[MUTLAK İKİZ TEHDİDİ]")) {
      return {
        success: false,
        error: "Mutlak ikiz tehdidi içeren tezlerin okuma durumu değiştirilemez.",
      };
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
