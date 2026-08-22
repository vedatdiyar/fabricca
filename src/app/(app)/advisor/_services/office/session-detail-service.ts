"use server";

import { and, eq, asc } from "drizzle-orm";
import { db } from "@/core/db";
import { sessions, messages, outlines } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { handleActionError } from "@/lib/errors/handle-error";
import type { OfficeReviewReport, PipelineResultData } from "../pipeline/types";
import type { OfficeSessionDetail } from "./types";

/**
 * Loads the complete detail of a specific Office Review & Defense session.
 *
 * @param sessionId - The session ID to load.
 * @returns Session detail or an error.
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
