import { db } from "@/core/db";
import { matrices, boxes, annotations, tasks } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";

const READ_TOOL_NAMES = new Set([
  "getThesisMatrix",
  "listBoxes",
  "searchSources",
  "listNotes",
  "listTasks",
]);

/**
 * Returns true when the function name is a read-only query tool.
 *
 * @param toolName - The function declaration name to check.
 * @returns True if tool is read-only.
 */
export function isReadTool(toolName: string): boolean {
  return READ_TOOL_NAMES.has(toolName);
}

/**
 * Executes read-only database tools directly during the Gemini generation stream.
 *
 * @param toolName - The function name.
 * @param args - Object containing arguments.
 * @param userId - The ID of the authenticated user.
 * @returns The query result data.
 */
export async function executeReadTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<unknown> {
  switch (toolName) {
    case "getThesisMatrix": {
      const userMatrix = await db.query.matrices.findFirst({
        where: eq(matrices.userId, userId),
      });
      return userMatrix ?? { message: "Henüz tez matrisi oluşturulmamış." };
    }
    case "listBoxes": {
      const userMatrix = await db.query.matrices.findFirst({
        where: eq(matrices.userId, userId),
      });
      if (!userMatrix) return [];
      const boxList = await db.query.boxes.findMany({
        where: eq(boxes.matrixId, userMatrix.id),
      });
      return boxList;
    }
    case "searchSources": {
      const userMatrix = await db.query.matrices.findFirst({
        where: eq(matrices.userId, userId),
      });
      if (!userMatrix) return [];
      const boxList = await db.query.boxes.findMany({
        where: eq(boxes.matrixId, userMatrix.id),
        columns: { id: true },
      });
      const boxIds = boxList.map((b) => b.id);
      if (boxIds.length === 0) return [];

      const queryStr = typeof args.query === "string" ? args.query.trim() : "";
      const filterBoxId = typeof args.boxId === "number" ? args.boxId : null;

      let results = await db.query.sources.findMany({
        where: (s, { inArray }) => inArray(s.boxId, boxIds),
        limit: 20,
      });

      if (filterBoxId) {
        results = results.filter((s) => s.boxId === filterBoxId);
      }

      if (queryStr) {
        const lower = queryStr.toLowerCase();
        results = results.filter(
          (s) =>
            s.title.toLowerCase().includes(lower) ||
            s.authors?.some((a) => a.toLowerCase().includes(lower)),
        );
      }

      return results.map((s) => ({
        id: s.id,
        boxId: s.boxId,
        title: s.title,
        authors: s.authors,
        publicationYear: s.publicationYear,
        isRead: s.isRead,
        pdfStatus: s.pdfStatus,
      }));
    }
    case "listNotes": {
      const sourceId = typeof args.sourceId === "number" ? args.sourceId : null;
      if (sourceId) {
        return await db.query.annotations.findMany({
          where: and(
            eq(annotations.userId, userId),
            eq(annotations.sourceId, sourceId),
          ),
          limit: 20,
        });
      }
      return await db.query.annotations.findMany({
        where: eq(annotations.userId, userId),
        limit: 15,
      });
    }
    case "listTasks": {
      const statusFilter =
        typeof args.status === "string"
          ? (args.status as "TODO" | "IN_PROGRESS" | "DONE")
          : null;
      if (statusFilter) {
        return await db.query.tasks.findMany({
          where: and(eq(tasks.userId, userId), eq(tasks.status, statusFilter)),
        });
      }
      return await db.query.tasks.findMany({
        where: eq(tasks.userId, userId),
      });
    }
    default:
      return { error: `Bilinmeyen okuma fonksiyonu: ${toolName}` };
  }
}
