"use server";

import { and, eq, desc, asc } from "drizzle-orm";
import { db } from "@/core/db";
import {
  sessions,
  messages,
  outlines,
  matrices,
  annotations,
  outlineAnnotations,
  outlineSources,
  sources,
  tasks,
  boxes,
} from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { handleActionError } from "@/lib/errors/handle-error";
import type {
  OfficeReviewReport,
  PipelineResultData,
} from "./_services/pipeline/types";

export interface OutlineOption {
  id: number;
  title: string;
  description: string | null;
  parentId: number | null;
  sortOrder: number;
}

export interface OfficeSessionSummary {
  id: number;
  title: string;
  outlineId: number | null;
  outlineTitle: string | null;
  draftText: string | null;
  studentNote: string | null;
  createdAt: string;
  messageCount: number;
}

export interface OfficeSessionDetail {
  id: number;
  title: string;
  outlineId: number | null;
  outlineTitle: string | null;
  outlineDescription: string | null;
  draftText: string | null;
  studentNote: string | null;
  reviewReport: OfficeReviewReport | null;
  messages: Array<{
    id: number;
    role: string;
    persona: string | null;
    content: string;
    createdAt: string;
    pipelineData: PipelineResultData | null;
  }>;
}

/**
 * Loads outline chapters/sections and past office sessions for the authenticated user.
 */
export async function getOfficeInitialDataAction(): Promise<{
  success: boolean;
  outlines: OutlineOption[];
  sessions: OfficeSessionSummary[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        outlines: [],
        sessions: [],
        error: "Oturum bulunamadı.",
      };
    }

    // 1. Fetch outlines linked to user's thesis matrix
    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId))
      .limit(1);

    let userOutlines: OutlineOption[] = [];
    if (matrix) {
      userOutlines = await db
        .select({
          id: outlines.id,
          title: outlines.title,
          description: outlines.description,
          parentId: outlines.parentId,
          sortOrder: outlines.sortOrder,
        })
        .from(outlines)
        .where(eq(outlines.matrixId, matrix.id))
        .orderBy(asc(outlines.sortOrder));
    }

    // 2. Fetch past office review sessions
    const sessionRows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        outlineId: sessions.outlineId,
        draftText: sessions.draftText,
        studentNote: sessions.studentNote,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, session.userId))
      .orderBy(desc(sessions.updatedAt));

    const outlineMap = new Map(userOutlines.map((o) => [o.id, o.title]));

    const sessionSummaries: OfficeSessionSummary[] = [];
    for (const row of sessionRows) {
      const msgCountRows = await db
        .select({ count: messages.id })
        .from(messages)
        .where(eq(messages.sessionId, row.id));

      sessionSummaries.push({
        id: row.id,
        title: row.title,
        outlineId: row.outlineId,
        outlineTitle: row.outlineId
          ? (outlineMap.get(row.outlineId) ?? null)
          : null,
        draftText: row.draftText,
        studentNote: row.studentNote,
        createdAt: row.createdAt.toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        messageCount: msgCountRows.length,
      });
    }

    return {
      success: true,
      outlines: userOutlines,
      sessions: sessionSummaries,
    };
  } catch (err) {
    new Logger(createFlowId()).error("getOfficeInitialDataAction error:", {
      service: "advisor",
      error: err,
    });
    return {
      success: false,
      outlines: [],
      sessions: [],
      error: "Veriler yüklenirken bir hata oluştu.",
    };
  }
}

/**
 * Loads the complete detail of a specific Office Review & Defense session.
 *
 * @param sessionId - The session ID to load.
 */
export async function getOfficeSessionDetailAction(
  sessionId: number,
): Promise<{ success: boolean; data?: OfficeSessionDetail; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const [sessionRow] = await db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      )
      .limit(1);

    if (!sessionRow) {
      return { success: false, error: "İnceleme oturumu bulunamadı." };
    }

    let outlineTitle: string | null = null;
    let outlineDescription: string | null = null;

    if (sessionRow.outlineId) {
      const [outline] = await db
        .select({ title: outlines.title, description: outlines.description })
        .from(outlines)
        .where(eq(outlines.id, sessionRow.outlineId))
        .limit(1);
      if (outline) {
        outlineTitle = outline.title;
        outlineDescription = outline.description;
      }
    }

    const messageRows = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));

    let reviewReport: OfficeReviewReport | null = null;
    for (const msg of messageRows) {
      if (msg.pipelineData) {
        const data = msg.pipelineData as PipelineResultData;
        if (data.audit && data.diff) {
          reviewReport = {
            outlineId: sessionRow.outlineId ?? undefined,
            draftText: sessionRow.draftText ?? undefined,
            studentNote: sessionRow.studentNote ?? undefined,
            audit: data.audit,
            diff: data.diff as OfficeReviewReport["diff"],
            juryCritiques: data.juryCritiques || [],
          };
          break;
        }
      }
    }

    const formattedMessages = messageRows.map((m) => ({
      id: m.id,
      role: m.role,
      persona: m.persona,
      content: m.content,
      createdAt: m.createdAt.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      pipelineData: m.pipelineData,
    }));

    return {
      success: true,
      data: {
        id: sessionRow.id,
        title: sessionRow.title,
        outlineId: sessionRow.outlineId,
        outlineTitle,
        outlineDescription,
        draftText: sessionRow.draftText,
        studentNote: sessionRow.studentNote,
        reviewReport,
        messages: formattedMessages,
      },
    };
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Saves a defense synthesis note as a PERSONAL_NOTE annotation linked to the outline section.
 *
 * @param input - outlineId, noteContent.
 */
export async function saveDefenseNoteAction(input: {
  outlineId: number;
  noteContent: string;
}): Promise<{ success: boolean; noteId?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const { outlineId, noteContent } = input;
    if (!noteContent || !noteContent.trim()) {
      return { success: false, error: "Not içeriği boş olamaz." };
    }

    // 1. Find a source linked to this outline, or fallback to any source in library
    const [pinnedSource] = await db
      .select({ sourceId: outlineSources.sourceId })
      .from(outlineSources)
      .where(eq(outlineSources.outlineId, outlineId))
      .limit(1);

    let targetSourceId = pinnedSource?.sourceId;

    if (!targetSourceId) {
      const [anySource] = await db
        .select({ id: sources.id })
        .from(sources)
        .innerJoin(boxes, eq(sources.boxId, boxes.id))
        .innerJoin(matrices, eq(boxes.matrixId, matrices.id))
        .where(eq(matrices.userId, session.userId))
        .limit(1);

      targetSourceId = anySource?.id;
    }

    if (!targetSourceId) {
      return {
        success: false,
        error:
          "Not kaydetmek için kütüphanenizde en az bir kaynak bulunmalıdır.",
      };
    }

    // 2. Insert annotation
    const [insertedAnnotation] = await db
      .insert(annotations)
      .values({
        userId: session.userId,
        sourceId: targetSourceId,
        pageNumber: "Savunma Notu",
        noteType: "PERSONAL_NOTE",
        content: noteContent.trim(),
        comment: "Danışmanın Çalışma Odası Müzakere ve Savunma Sonucu",
        sentToCitationCards: true,
      })
      .returning({ id: annotations.id });

    // 3. Link annotation to outline section
    await db.insert(outlineAnnotations).values({
      outlineId,
      annotationId: insertedAnnotation.id,
    });

    return { success: true, noteId: insertedAnnotation.id };
  } catch (err) {
    new Logger(createFlowId()).error("saveDefenseNoteAction error:", {
      service: "advisor",
      error: err,
    });
    return {
      success: false,
      error: "Savunma notu kaydedilirken bir hata oluştu.",
    };
  }
}

/**
 * Creates a revision task in the Kanban board.
 *
 * @param input - title, description, outlineId.
 */
export async function createRevisionTaskAction(input: {
  title: string;
  description?: string;
  outlineId?: number;
}): Promise<{ success: boolean; taskId?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const { title, description } = input;
    if (!title || !title.trim()) {
      return { success: false, error: "Görev başlığı boş olamaz." };
    }

    const [insertedTask] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        title: title.trim(),
        description: description?.trim() || null,
        status: "TODO",
        priority: "HIGH",
      })
      .returning({ id: tasks.id });

    return { success: true, taskId: insertedTask.id };
  } catch (err) {
    new Logger(createFlowId()).error("createRevisionTaskAction error:", {
      service: "advisor",
      error: err,
    });
    return {
      success: false,
      error: "Revizyon görevi eklenirken bir hata oluştu.",
    };
  }
}

/**
 * Deletes an office review session.
 *
 * @param sessionId - ID of session to delete.
 */
export async function deleteOfficeSessionAction(
  sessionId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    await db
      .delete(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );

    return { success: true };
  } catch (err) {
    return handleActionError(err);
  }
}
