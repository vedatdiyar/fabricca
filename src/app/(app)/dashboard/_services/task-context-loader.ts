import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import {
  matrices,
  sources,
  annotations,
  outlineAnnotations,
  tasks,
  type Matrix,
  type Box,
  type Source,
  type Annotation,
  type Task,
} from "@/core/db/schema";

/**
 * Aggregated academic snapshot shared by the task synchronization and
 * thesis strategist services.
 */
export interface AcademicTaskContext {
  matrix: Matrix;
  boxes: Box[];
  sources: Source[];
  annotations: Annotation[];
  /** Annotation IDs that have been pinned to at least one outline section. */
  linkedAnnotationIds: Set<number>;
  tasks: Task[];
}

/**
 * Loads the full academic working state of a user in a single pass:
 * matrix, topic boxes, library sources, reading annotations, citation-card
 * linkage and existing Kanban tasks.
 *
 * @param userId - ID of the authenticated user
 * @returns The aggregated context, or null when no thesis architecture exists yet
 */
export async function loadAcademicTaskContext(
  userId: number,
): Promise<AcademicTaskContext | null> {
  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
    with: {
      boxes: true,
    },
  });

  if (!userMatrix || !userMatrix.boxes || userMatrix.boxes.length === 0) {
    return null;
  }

  const boxes = userMatrix.boxes as Box[];
  const boxIds = boxes.map((b) => b.id);

  const userSources = await db
    .select()
    .from(sources)
    .where(inArray(sources.boxId, boxIds));

  const sourceIds = userSources.map((s) => s.id);

  const userAnnotations =
    sourceIds.length > 0
      ? await db
          .select()
          .from(annotations)
          .where(inArray(annotations.sourceId, sourceIds))
      : [];

  const linkedAnnotationIds = new Set<number>();
  if (userAnnotations.length > 0) {
    const annotIds = userAnnotations.map((a) => a.id);
    const linkedRows = await db
      .select({ annotationId: outlineAnnotations.annotationId })
      .from(outlineAnnotations)
      .where(inArray(outlineAnnotations.annotationId, annotIds));
    for (const row of linkedRows) {
      linkedAnnotationIds.add(row.annotationId);
    }
  }

  const existingTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId));

  return {
    matrix: userMatrix,
    boxes,
    sources: userSources,
    annotations: userAnnotations,
    linkedAnnotationIds,
    tasks: existingTasks,
  };
}
