"use server";

import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sources, annotations } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { ensureUserMatrixAndBoxes } from "@/services/box/ownership";
import { mapSourceToResource } from "@/features/library/services/resource-mapper";
import type { NoteType } from "./_lib/types";

/**
 * Server Action: Fetches all library resources and notes for the current user, seeding default boxes if absent.
 *
 * @returns The resources and notes on success, or an error message on failure.
 */
export async function getLibraryResourcesAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        error: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      };
    }

    const { boxes } = await ensureUserMatrixAndBoxes(session.userId);

    const boxIds = boxes.map((b) => b.id);

    const dbResources =
      boxIds.length > 0
        ? await db.query.sources.findMany({
            where: inArray(sources.boxId, boxIds),
            orderBy: [desc(sources.createdAt)],
            with: { critique: true },
          })
        : [];

    const resourceIds = dbResources.map((r) => r.id);

    const dbNotes =
      resourceIds.length > 0
        ? await db.query.annotations.findMany({
            where: inArray(annotations.sourceId, resourceIds),
            orderBy: [desc(annotations.createdAt)],
          })
        : [];

    const boxMap = new Map(boxes.map((b) => [b.id, b.boxType]));
    const boxTitleMap = new Map(boxes.map((b) => [b.id, b.title]));
    const boxParentMap = new Map(boxes.map((b) => [b.id, b.parentId]));

    const resources = dbResources.map((r) =>
      mapSourceToResource(r, {
        boxType: boxMap.get(r.boxId) ?? null,
        title: boxTitleMap.get(r.boxId) ?? "Genel",
        parentId: boxParentMap.get(r.boxId) ?? null,
      }),
    );

    const notes = dbNotes.map((n) => ({
      id: n.id,
      resourceId: n.sourceId,
      pageNumber: n.pageNumber,
      noteType: n.noteType as NoteType,
      content: n.content,
      comment: n.comment ?? undefined,
      sentToCitationCards: n.sentToCitationCards,
      createdAt: n.createdAt.toISOString(),
    }));

    const critiques = dbResources
      .map((r) => r.critique)
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => ({
        resourceId: c.sourceId,
        researchQuestion: c.researchQuestion ?? undefined,
        theoreticalFramework: c.theoreticalFramework ?? undefined,
        methodology: c.methodology ?? undefined,
        mainArgument: c.mainArgument ?? undefined,
        literatureGap: c.literatureGap ?? undefined,
        updatedAt: c.updatedAt.toISOString(),
      }));

    return { success: true, data: { resources, notes, critiques } };
  } catch (err) {
    log.error("get_library_resources_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Kütüphane kaynakları yüklenirken bir hata oluştu.",
    };
  }
}
