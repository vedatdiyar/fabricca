import { db } from "@/core/db";
import {
  matrices,
  boxes,
  sources,
  annotations,
  tasks,
  type Box,
  type Source,
  type Annotation,
  type Task,
  type Matrix,
} from "@/core/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Reverts (undoes) a previously executed user-approved mutation database tool.
 *
 * @param toolName - The original tool function name.
 * @param args - The original payload arguments.
 * @param executionResult - Output data from execution (e.g. newly inserted record with ID).
 * @param previousState - Snapshot of the record before execution.
 * @param userId - The ID of the authenticated user.
 * @returns Structured result with success status and user-facing message.
 */
export async function undoMutationTool(
  toolName: string,
  args: Record<string, unknown>,
  executionResult?: unknown,
  previousState?: Record<string, unknown>,
  userId?: number,
): Promise<{ success: boolean; message?: string; error?: string }> {
  switch (toolName) {
    case "updateThesisMatrix": {
      if (!previousState || !userId) {
        return {
          success: false,
          error: "Önceki durum verisine ulaşılamadı.",
        };
      }
      const userMatrix = await db.query.matrices.findFirst({
        where: eq(matrices.userId, userId),
      });
      if (!userMatrix) {
        return { success: false, error: "Tez matrisi bulunamadı." };
      }

      const updateData: Partial<Matrix> = { updatedAt: new Date() };
      if (typeof previousState.subjectProblem === "string") {
        updateData.subjectProblem = previousState.subjectProblem;
      }
      if (typeof previousState.theoreticalFramework === "string") {
        updateData.theoreticalFramework = previousState.theoreticalFramework;
      }
      if (
        typeof previousState.primaryMaterial === "string" ||
        previousState.primaryMaterial === null
      ) {
        updateData.primaryMaterial = previousState.primaryMaterial as
          string | null;
      }
      if (typeof previousState.methodology === "string") {
        updateData.methodology = previousState.methodology;
      }

      await db
        .update(matrices)
        .set(updateData)
        .where(eq(matrices.id, userMatrix.id));

      return { success: true, message: "Tez matrisi değişikliği geri alındı." };
    }
    case "createBox": {
      const createdBox = executionResult as Box | undefined;
      const boxId = createdBox?.id ?? (args.boxId as number | undefined);
      if (!boxId) {
        return {
          success: false,
          error: "Silinecek kutu kimliği bulunamadı.",
        };
      }
      await db.delete(boxes).where(eq(boxes.id, boxId));
      return {
        success: true,
        message: "Oluşturulan kutu geri alındı (silindi).",
      };
    }
    case "updateBox": {
      const boxId = args.boxId as number;
      if (!previousState) {
        return { success: false, error: "Önceki kutu verisi bulunamadı." };
      }
      const updateData: {
        title?: string;
        description?: string | null;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };
      if (typeof previousState.title === "string")
        updateData.title = previousState.title;
      if (
        typeof previousState.description === "string" ||
        previousState.description === null
      ) {
        updateData.description = previousState.description as string | null;
      }

      await db.update(boxes).set(updateData).where(eq(boxes.id, boxId));
      return { success: true, message: "Kutu güncellemesi geri alındı." };
    }
    case "deleteBox": {
      if (!previousState) {
        return { success: false, error: "Silinen kutu yedeği bulunamadı." };
      }
      await db.insert(boxes).values({
        matrixId: previousState.matrixId as number,
        boxType: previousState.boxType as Box["boxType"],
        title: previousState.title as string,
        description: (previousState.description as string | null) ?? null,
        parentId: (previousState.parentId as number | null) ?? null,
      });
      return { success: true, message: "Silinen kutu geri yüklendi." };
    }
    case "updateSource": {
      const sourceId = args.sourceId as number;
      if (!previousState) {
        return { success: false, error: "Önceki kaynak verisi bulunamadı." };
      }
      const updateData: Partial<Source> = { updatedAt: new Date() };
      if (typeof previousState.title === "string")
        updateData.title = previousState.title;
      if (typeof previousState.isRead === "boolean")
        updateData.isRead = previousState.isRead;
      if (
        typeof previousState.comparisonNote === "string" ||
        previousState.comparisonNote === null
      ) {
        updateData.comparisonNote = previousState.comparisonNote as
          string | null;
      }

      await db.update(sources).set(updateData).where(eq(sources.id, sourceId));
      return { success: true, message: "Kaynak güncellemesi geri alındı." };
    }
    case "deleteSource": {
      if (!previousState) {
        return { success: false, error: "Silinen kaynak yedeği bulunamadı." };
      }
      await db.insert(sources).values({
        boxId: previousState.boxId as number,
        title: previousState.title as string,
        authors: (previousState.authors as string[] | null) ?? undefined,
        publicationYear:
          (previousState.publicationYear as number | null) ?? undefined,
        doi: (previousState.doi as string | null) ?? undefined,
        isRead: previousState.isRead as boolean,
        comparisonNote:
          (previousState.comparisonNote as string | null) ?? undefined,
        pdfUrl: (previousState.pdfUrl as string | null) ?? undefined,
        pdfFileName: (previousState.pdfFileName as string | null) ?? undefined,
        pdfFileSize: (previousState.pdfFileSize as number | null) ?? undefined,
        pdfStatus: previousState.pdfStatus as Source["pdfStatus"],
      });
      return { success: true, message: "Silinen kaynak geri yüklendi." };
    }
    case "addNote": {
      const createdNote = executionResult as Annotation | undefined;
      const noteId = createdNote?.id ?? (args.noteId as number | undefined);
      if (!noteId || !userId) {
        return { success: false, error: "Silinecek not kimliği bulunamadı." };
      }
      await db
        .delete(annotations)
        .where(and(eq(annotations.id, noteId), eq(annotations.userId, userId)));
      return { success: true, message: "Eklenecek not geri alındı (silindi)." };
    }
    case "deleteNote": {
      if (!previousState || !userId) {
        return { success: false, error: "Silinen not yedeği bulunamadı." };
      }
      await db.insert(annotations).values({
        sourceId: previousState.sourceId as number,
        userId,
        pageNumber: previousState.pageNumber as string,
        noteType: previousState.noteType as Annotation["noteType"],
        content: previousState.content as string,
        comment: (previousState.comment as string | null) ?? null,
        sentToCitationCards:
          (previousState.sentToCitationCards as boolean) ?? true,
      });
      return { success: true, message: "Silinen not geri yüklendi." };
    }
    case "createTask": {
      const createdTask = executionResult as Task | undefined;
      const taskId = createdTask?.id ?? (args.taskId as number | undefined);
      if (!taskId || !userId) {
        return {
          success: false,
          error: "Silinecek görev kimliği bulunamadı.",
        };
      }
      await db
        .delete(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      return {
        success: true,
        message: "Oluşturulan görev geri alındı (silindi).",
      };
    }
    case "updateTaskStatus": {
      const taskId = args.taskId as number;
      if (!previousState || !userId) {
        return { success: false, error: "Önceki görev durumu bulunamadı." };
      }
      const status = previousState.status as Task["status"];

      await db
        .update(tasks)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

      return {
        success: true,
        message: "Görev durumu değişikliği geri alındı.",
      };
    }
    default:
      return {
        success: false,
        error: "İşlem geri alınamadı. Lütfen tekrar deneyin.",
      };
  }
}
