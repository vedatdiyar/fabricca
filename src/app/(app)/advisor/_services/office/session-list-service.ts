"use server";

import { eq, desc, asc, inArray, count } from "drizzle-orm";
import { db } from "@/core/db";
import { sessions, messages, outlines, matrices } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import type { OutlineOption, OfficeSessionSummary } from "./types";

/**
 * Loads outline chapters and past office sessions with message counts in a single query.
 *
 * @returns Outlines and session summaries, or an error.
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

    const countMap = new Map<number, number>();
    if (sessionRows.length > 0) {
      const counts = await db
        .select({ sessionId: messages.sessionId, value: count(messages.id) })
        .from(messages)
        .where(
          inArray(
            messages.sessionId,
            sessionRows.map((r) => r.id),
          ),
        )
        .groupBy(messages.sessionId);
      for (const c of counts) countMap.set(c.sessionId, Number(c.value));
    }

    const sessionSummaries: OfficeSessionSummary[] = sessionRows.map((row) => ({
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
      messageCount: countMap.get(row.id) ?? 0,
    }));

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
