"use server";

import { db } from "@/db";
import { sources, boxes, matrices, critiques, annotations } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionWithOnboarding } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import type { MatrixSourceRow } from "./types";
import { hasMatrixCritiqueData } from "./types";

/**
 * Server Action: Fetches all literature matrix source rows and topic boxes for the authenticated user.
 *
 * @returns Object containing matrix source rows and user boxes on success, or error on failure.
 */
export async function getLiteratureMatrixData() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSessionWithOnboarding();
    if (!session) {
      return { success: false, error: "Oturum açmanız gerekmektedir." };
    }

    // 1. Fetch user matrix ID
    const [userMatrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId))
      .limit(1);

    if (!userMatrix) {
      return {
        success: true,
        data: { rows: [], boxes: [] },
      };
    }

    // 2. Fetch all user boxes
    const userBoxes = await db
      .select({
        id: boxes.id,
        title: boxes.title,
        boxType: boxes.boxType,
      })
      .from(boxes)
      .where(eq(boxes.matrixId, userMatrix.id));

    if (userBoxes.length === 0) {
      return {
        success: true,
        data: { rows: [], boxes: [] },
      };
    }

    const boxIds = userBoxes.map((b) => b.id);
    const boxMap = new Map(userBoxes.map((b) => [b.id, b]));

    // 3. Fetch sources for user boxes
    const rawSources = await db
      .select()
      .from(sources)
      .where(sql`${sources.boxId} IN ${boxIds}`);

    if (rawSources.length === 0) {
      return {
        success: true,
        data: {
          rows: [],
          boxes: userBoxes.map((b) => ({ id: b.id, title: b.title })),
        },
      };
    }

    const sourceIds = rawSources.map((s) => s.id);

    // 4. Fetch critiques for user sources
    const rawCritiques = await db
      .select()
      .from(critiques)
      .where(sql`${critiques.sourceId} IN ${sourceIds}`);

    const critiqueMap = new Map(rawCritiques.map((c) => [c.sourceId, c]));

    // 5. Count annotations per source
    const rawAnnotationCounts = await db
      .select({
        sourceId: annotations.sourceId,
        count: sql<number>`count(${annotations.id})::int`,
      })
      .from(annotations)
      .where(sql`${annotations.sourceId} IN ${sourceIds}`)
      .groupBy(annotations.sourceId);

    const annotationCountMap = new Map(
      rawAnnotationCounts.map((a) => [a.sourceId, a.count]),
    );

    // 6. Build response rows, keeping only sources that carry matrix analysis data
    const rows: MatrixSourceRow[] = rawSources
      .map((source) => {
        const box = boxMap.get(source.boxId);
        const critique = critiqueMap.get(source.id);
        const annotationCount = annotationCountMap.get(source.id) ?? 0;

        return {
          id: source.id,
          title: source.title,
          authors: source.authors,
          publicationYear: source.publicationYear,
          publisher: source.publisher,
          doi: source.doi,
          thesisType: source.thesisType,
          isRead: source.isRead,
          pdfStatus: source.pdfStatus,
          comparisonNote: source.comparisonNote,
          boxId: source.boxId,
          boxTitle: box ? box.title : null,
          boxType: box ? box.boxType : null,
          annotationCount,
          critique: critique
            ? {
                id: critique.id,
                researchQuestion: critique.researchQuestion,
                theoreticalFramework: critique.theoreticalFramework,
                methodology: critique.methodology,
                mainArgument: critique.mainArgument,
                literatureGap: critique.literatureGap,
              }
            : null,
        };
      })
      .filter((row) => hasMatrixCritiqueData(row.critique));

    return {
      success: true,
      data: {
        rows,
        boxes: userBoxes.map((b) => ({ id: b.id, title: b.title })),
      },
    };
  } catch (error) {
    log.error("get_literature_matrix_data_failed", {
      service: "literature-matrix",
      error,
    });
    return {
      success: false,
      error: "Literatür matrisi verileri yüklenirken bir hata oluştu.",
    };
  }
}
