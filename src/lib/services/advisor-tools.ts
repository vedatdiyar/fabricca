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
import type { FunctionDeclaration } from "@google/genai";

/** List of all Gemini Function Declarations for the Thesis Advisor Chat. */
export const ADVISOR_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "getThesisMatrix",
    description:
      "Fetches the user's current thesis matrix (subject/problem, theoretical framework, primary material, methodology).",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "listBoxes",
    description:
      "Lists all thesis boxes created by the user, categorized by box type (e.g. SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, PRIMARY_MATERIAL, METHODOLOGY, RELATED_THESES).",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "searchSources",
    description:
      "Searches academic literature sources saved in the user's library by search query or box ID.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional text search query to filter sources by title or author.",
        },
        boxId: {
          type: "integer",
          description:
            "Optional box ID to retrieve sources linked to a specific box.",
        },
      },
    },
  },
  {
    name: "listNotes",
    description:
      "Retrieves saved academic notes and citations for a specific source or lists recent notes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description:
            "Optional source ID to filter notes for a single academic source.",
        },
      },
    },
  },
  {
    name: "listTasks",
    description:
      "Lists research tasks/kanban items for the user, optionally filtered by status.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
          description: "Optional status filter.",
        },
      },
    },
  },

  // MUTATION TOOLS
  {
    name: "updateThesisMatrix",
    description:
      "Updates one or more fields of the user's core thesis matrix (subject/problem, theoretical framework, primary material, methodology).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        subjectProblem: {
          type: "string",
          description: "Updated subject and problem statement of the thesis.",
        },
        theoreticalFramework: {
          type: "string",
          description: "Updated theoretical framework.",
        },
        primaryMaterial: {
          type: "string",
          description: "Updated primary material or empirical dataset.",
        },
        methodology: {
          type: "string",
          description: "Updated research methodology.",
        },
      },
    },
  },
  {
    name: "createBox",
    description:
      "Creates a new research box linked to the user's thesis matrix.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        boxType: {
          type: "string",
          enum: [
            "SUBJECT_PROBLEM",
            "THEORETICAL_FRAMEWORK",
            "PRIMARY_MATERIAL",
            "METHODOLOGY",
            "RELATED_THESES",
          ],
          description: "Category of the box.",
        },
        title: {
          type: "string",
          description: "Title of the box.",
        },
        description: {
          type: "string",
          description: "Detailed description of the box purpose or concept.",
        },
      },
      required: ["boxType", "title"],
    },
  },
  {
    name: "updateBox",
    description: "Updates an existing research box title or description.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        boxId: {
          type: "integer",
          description: "The ID of the box to update.",
        },
        title: {
          type: "string",
          description: "New title for the box.",
        },
        description: {
          type: "string",
          description: "New description for the box.",
        },
      },
      required: ["boxId"],
    },
  },
  {
    name: "deleteBox",
    description: "Deletes a research box from the user's thesis structure.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        boxId: {
          type: "integer",
          description: "The ID of the box to delete.",
        },
      },
      required: ["boxId"],
    },
  },
  {
    name: "updateSource",
    description:
      "Updates metadata or reading status of an academic source in the user's library.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description: "The ID of the source to update.",
        },
        title: {
          type: "string",
          description: "Updated title of the source.",
        },
        isRead: {
          type: "boolean",
          description: "Whether the user has read this source.",
        },
        comparisonNote: {
          type: "string",
          description: "Comparative notes regarding this source.",
        },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "deleteSource",
    description:
      "Deletes an academic literature source from the user's library.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description: "The ID of the source to remove.",
        },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "addNote",
    description:
      "Adds a new citation, paraphrase, or personal note linked to an academic source.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "integer",
          description: "The ID of the source being cited or noted.",
        },
        pageNumber: {
          type: "string",
          description: "Page number or page range (e.g. '45' or '12-14').",
        },
        noteType: {
          type: "string",
          enum: ["DIRECT_QUOTE", "PARAPHRASE", "PERSONAL_NOTE"],
          description: "Type of academic note.",
        },
        content: {
          type: "string",
          description: "The quote text or note content.",
        },
        comment: {
          type: "string",
          description: "Optional user commentary or reflective note.",
        },
      },
      required: ["sourceId", "pageNumber", "noteType", "content"],
    },
  },
  {
    name: "deleteNote",
    description: "Deletes a saved note or citation from the user's library.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "integer",
          description: "The ID of the note to delete.",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "createTask",
    description:
      "Creates a new research or thesis writing task in the user's Kanban board.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the research task.",
        },
        description: {
          type: "string",
          description: "Detailed instructions or description of the task.",
        },
        priority: {
          type: "string",
          enum: ["HIGH", "MEDIUM", "LOW"],
          description: "Priority level of the task.",
        },
        boxId: {
          type: "integer",
          description: "Optional box ID to associate the task with.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "updateTaskStatus",
    description:
      "Updates the Kanban status of a research task (TODO, IN_PROGRESS, DONE).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "integer",
          description: "The ID of the task.",
        },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
          description: "New status.",
        },
      },
      required: ["taskId", "status"],
    },
  },
];

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
        return await db.query.notes.findMany({
          where: and(eq(notes.userId, userId), eq(notes.sourceId, sourceId)),
          limit: 20,
        });
      }
      return await db.query.notes.findMany({
        where: eq(notes.userId, userId),
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
): Promise<{ success: boolean; message: string }> {
  switch (toolName) {
    case "updateThesisMatrix": {
      if (!previousState || !userId) {
        return {
          success: false,
          message: "Önceki durum verisine ulaşılamadı.",
        };
      }
      const userMatrix = await db.query.matrices.findFirst({
        where: eq(matrices.userId, userId),
      });
      if (!userMatrix) {
        return { success: false, message: "Tez matrisi bulunamadı." };
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
          message: "Silinecek kutu kimliği bulunamadı.",
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
        return { success: false, message: "Önceki kutu verisi bulunamadı." };
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
        return { success: false, message: "Silinen kutu yedeği bulunamadı." };
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
        return { success: false, message: "Önceki kaynak verisi bulunamadı." };
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
        return { success: false, message: "Silinen kaynak yedeği bulunamadı." };
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
        isFoundational: previousState.isFoundational as boolean,
        pdfUrl: (previousState.pdfUrl as string | null) ?? undefined,
        pdfFileName: (previousState.pdfFileName as string | null) ?? undefined,
        pdfFileSize: (previousState.pdfFileSize as number | null) ?? undefined,
        pdfStatus: previousState.pdfStatus as Source["pdfStatus"],
      });
      return { success: true, message: "Silinen kaynak geri yüklendi." };
    }
    case "addNote": {
      const createdNote = executionResult as Note | undefined;
      const noteId = createdNote?.id ?? (args.noteId as number | undefined);
      if (!noteId || !userId) {
        return { success: false, message: "Silinecek not kimliği bulunamadı." };
      }
      await db
        .delete(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
      return { success: true, message: "Eklenecek not geri alındı (silindi)." };
    }
    case "deleteNote": {
      if (!previousState || !userId) {
        return { success: false, message: "Silinen not yedeği bulunamadı." };
      }
      await db.insert(notes).values({
        sourceId: previousState.sourceId as number,
        userId,
        pageNumber: previousState.pageNumber as string,
        noteType: previousState.noteType as Note["noteType"],
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
          message: "Silinecek görev kimliği bulunamadı.",
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
        return { success: false, message: "Önceki görev durumu bulunamadı." };
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
        message: `Bilinmeyen geri alma fonksiyonu: ${toolName}`,
      };
  }
}
