import { db } from "@/db";
import {
  matrices,
  boxes,
  sources,
  notes,
  tasks,
  type Box,
  type Source,
  type Note,
  type Task,
  type Matrix,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Fetches the real current database state for an entity before mutation,
 * so the UI can render an accurate Old State vs New State preview.
 *
 * @param name - The tool function name.
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The existing record state object, or undefined.
 */
export async function getToolPreviousState(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<Record<string, unknown> | undefined> {
  try {
    switch (name) {
      case "updateBox":
      case "deleteBox": {
        const boxId =
          typeof args.boxId === "number"
            ? args.boxId
            : typeof args.boxId === "string"
              ? Number(args.boxId)
              : 0;
        if (!boxId) return undefined;
        const box = await db.query.boxes.findFirst({
          where: eq(boxes.id, boxId),
        });
        if (!box) return undefined;
        return {
          title: box.title,
          description: box.description ?? "",
          boxType: box.boxType,
        };
      }

      case "updateThesisMatrix": {
        const matrix = await db.query.matrices.findFirst({
          where: eq(matrices.userId, userId),
        });
        if (!matrix) return undefined;
        return {
          subjectProblem: matrix.subjectProblem ?? "",
          theoreticalFramework: matrix.theoreticalFramework ?? "",
          primaryMaterial: matrix.primaryMaterial ?? "",
          methodology: matrix.methodology ?? "",
        };
      }

      case "updateTaskStatus": {
        const taskId =
          typeof args.taskId === "number"
            ? args.taskId
            : typeof args.taskId === "string"
              ? Number(args.taskId)
              : 0;
        if (!taskId) return undefined;
        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
        });
        if (!task) return undefined;
        return {
          title: task.title,
          status: task.status,
        };
      }

      case "deleteSource":
      case "updateSource": {
        const sourceId =
          typeof args.sourceId === "number"
            ? args.sourceId
            : typeof args.sourceId === "string"
              ? Number(args.sourceId)
              : 0;
        if (!sourceId) return undefined;
        const sourceItem = await db.query.sources.findFirst({
          where: eq(sources.id, sourceId),
        });
        if (!sourceItem) return undefined;
        return {
          title: sourceItem.title,
          isRead: sourceItem.isRead,
        };
      }

      case "deleteNote": {
        const noteId =
          typeof args.noteId === "number"
            ? args.noteId
            : typeof args.noteId === "string"
              ? Number(args.noteId)
              : 0;
        if (!noteId) return undefined;
        const noteItem = await db.query.notes.findFirst({
          where: eq(notes.id, noteId),
        });
        if (!noteItem) return undefined;
        return {
          content: noteItem.content,
          pageNumber: noteItem.pageNumber ?? "",
        };
      }

      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * Executes mutation database tools after explicit user approval in the UI.
 *
 * @param toolName - The function name.
 * @param args - Object containing arguments.
 * @param userId - The ID of the authenticated user.
 * @returns Object with success status, user-facing message, generated data, and captured previous state for undo.
 */
export async function executeMutationTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<{
  success: boolean;
  message: string;
  data?: unknown;
  previousState?: Record<string, unknown>;
}> {
  switch (toolName) {
    case "updateThesisMatrix": {
      const userMatrix = await db.query.matrices.findFirst({
        where: eq(matrices.userId, userId),
      });
      if (!userMatrix) {
        return { success: false, message: "Tez matrisi bulunamadı." };
      }

      const previousState: Record<string, unknown> = {
        subjectProblem: userMatrix.subjectProblem,
        theoreticalFramework: userMatrix.theoreticalFramework,
        primaryMaterial: userMatrix.primaryMaterial,
        methodology: userMatrix.methodology,
      };

      const updateData: Partial<Matrix> = {};
      if (typeof args.subjectProblem === "string")
        updateData.subjectProblem = args.subjectProblem;
      if (typeof args.theoreticalFramework === "string")
        updateData.theoreticalFramework = args.theoreticalFramework;
      if (typeof args.primaryMaterial === "string")
        updateData.primaryMaterial = args.primaryMaterial;
      if (typeof args.methodology === "string")
        updateData.methodology = args.methodology;

      await db
        .update(matrices)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(matrices.id, userMatrix.id));

      return {
        success: true,
        message: "Tez matrisi başarıyla güncellendi.",
        previousState,
      };
    }
    case "createBox": {
      const userMatrix = await db.query.matrices.findFirst({
        where: eq(matrices.userId, userId),
      });
      if (!userMatrix) {
        return {
          success: false,
          message: "Önce tez matrisi oluşturulmalıdır.",
        };
      }
      const boxType = args.boxType as Box["boxType"];
      const title = args.title as string;
      const description = (args.description as string | undefined) ?? null;

      const [newBox] = await db
        .insert(boxes)
        .values({
          matrixId: userMatrix.id,
          boxType,
          title,
          description,
        })
        .returning();

      return {
        success: true,
        message: `"${title}" başlıklı yeni kutu oluşturuldu.`,
        data: newBox,
      };
    }
    case "updateBox": {
      const boxId = args.boxId as number;
      const existingBox = await db.query.boxes.findFirst({
        where: eq(boxes.id, boxId),
      });
      if (!existingBox) {
        return { success: false, message: "Kutu bulunamadı." };
      }

      const previousState: Record<string, unknown> = {
        title: existingBox.title,
        description: existingBox.description,
      };

      const updateData: {
        title?: string;
        description?: string;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (typeof args.title === "string") updateData.title = args.title;
      if (typeof args.description === "string")
        updateData.description = args.description;

      await db.update(boxes).set(updateData).where(eq(boxes.id, boxId));
      return {
        success: true,
        message: "Kutu bilgileri güncellendi.",
        previousState,
      };
    }
    case "deleteBox": {
      const boxId = args.boxId as number;
      const existingBox = await db.query.boxes.findFirst({
        where: eq(boxes.id, boxId),
      });
      if (!existingBox) {
        return { success: false, message: "Silinecek kutu bulunamadı." };
      }

      const previousState: Record<string, unknown> = {
        matrixId: existingBox.matrixId,
        boxType: existingBox.boxType,
        title: existingBox.title,
        description: existingBox.description,
        parentId: existingBox.parentId,
      };

      await db.delete(boxes).where(eq(boxes.id, boxId));
      return { success: true, message: "Kutu silindi.", previousState };
    }
    case "updateSource": {
      const sourceId = args.sourceId as number;
      const existingSource = await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
      });
      if (!existingSource) {
        return { success: false, message: "Kaynak bulunamadı." };
      }

      const previousState: Record<string, unknown> = {
        title: existingSource.title,
        isRead: existingSource.isRead,
        comparisonNote: existingSource.comparisonNote,
      };

      const updateData: Partial<Source> = {};
      if (typeof args.title === "string") updateData.title = args.title;
      if (typeof args.isRead === "boolean") updateData.isRead = args.isRead;
      if (typeof args.comparisonNote === "string")
        updateData.comparisonNote = args.comparisonNote;

      await db
        .update(sources)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(sources.id, sourceId));

      return {
        success: true,
        message: "Kaynak bilgileri güncellendi.",
        previousState,
      };
    }
    case "deleteSource": {
      const sourceId = args.sourceId as number;
      const existingSource = await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
      });
      if (!existingSource) {
        return { success: false, message: "Silinecek kaynak bulunamadı." };
      }

      const previousState: Record<string, unknown> = {
        boxId: existingSource.boxId,
        title: existingSource.title,
        authors: existingSource.authors,
        publicationYear: existingSource.publicationYear,
        doi: existingSource.doi,
        isRead: existingSource.isRead,
        comparisonNote: existingSource.comparisonNote,
        isFoundational: existingSource.isFoundational,
        pdfUrl: existingSource.pdfUrl,
        pdfFileName: existingSource.pdfFileName,
        pdfFileSize: existingSource.pdfFileSize,
        pdfStatus: existingSource.pdfStatus,
      };

      await db.delete(sources).where(eq(sources.id, sourceId));
      return {
        success: true,
        message: "Kaynak kütüphaneden silindi.",
        previousState,
      };
    }
    case "addNote": {
      const sourceId = args.sourceId as number;
      const pageNumber = args.pageNumber as string;
      const noteType = args.noteType as Note["noteType"];
      const content = args.content as string;
      const comment = (args.comment as string | undefined) ?? null;

      const [newNote] = await db
        .insert(notes)
        .values({
          sourceId,
          userId,
          pageNumber,
          noteType,
          content,
          comment,
        })
        .returning();

      return {
        success: true,
        message: "Not ve alıntı kütüphanenize eklendi.",
        data: newNote,
      };
    }
    case "deleteNote": {
      const noteId = args.noteId as number;
      const existingNote = await db.query.notes.findFirst({
        where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
      });
      if (!existingNote) {
        return { success: false, message: "Silinecek not bulunamadı." };
      }

      const previousState: Record<string, unknown> = {
        sourceId: existingNote.sourceId,
        pageNumber: existingNote.pageNumber,
        noteType: existingNote.noteType,
        content: existingNote.content,
        comment: existingNote.comment,
        sentToCitationCards: existingNote.sentToCitationCards,
      };

      await db
        .delete(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));

      return { success: true, message: "Not silindi.", previousState };
    }
    case "createTask": {
      const title = args.title as string;
      const description = (args.description as string | undefined) ?? null;
      const priority = (args.priority as Task["priority"]) ?? "MEDIUM";
      const boxId = (args.boxId as number | undefined) ?? null;

      const [newTask] = await db
        .insert(tasks)
        .values({
          userId,
          boxId,
          title,
          description,
          priority,
          status: "TODO",
        })
        .returning();

      return {
        success: true,
        message: `"${title}" görevi Kanban panosuna eklendi.`,
        data: newTask,
      };
    }
    case "updateTaskStatus": {
      const taskId = args.taskId as number;
      const existingTask = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
      });
      if (!existingTask) {
        return { success: false, message: "Görev bulunamadı." };
      }

      const previousState: Record<string, unknown> = {
        status: existingTask.status,
      };

      const status = args.status as Task["status"];

      await db
        .update(tasks)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

      return {
        success: true,
        message: "Görev durumu güncellendi.",
        previousState,
      };
    }
    default:
      return {
        success: false,
        message: `Bilinmeyen veritabanı değişikliği: ${toolName}`,
      };
  }
}
