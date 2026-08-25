import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { createSseStream } from "@/app/(app)/advisor/_services/stream";
import { runTurn } from "@/app/(app)/advisor/_services/turn";
import { runOfficeReview } from "@/app/(app)/advisor/_services/office-review.service";
import { streamOfficeDefense } from "@/app/(app)/advisor/_services/office-defense.service";

const officeReviewSchema = z.object({
  action: z.literal("REVIEW"),
  outlineId: z.number().int().positive("Lütfen geçerli bir tez bölümü seçin."),
  draftText: z
    .string()
    .min(10, "Taslak metin en az 10 karakter olmalıdır.")
    .max(10000, "Taslak metin çok uzun (en fazla 10.000 karakter)."),
});

const officeDefenseSchema = z.object({
  action: z.literal("DEFENSE"),
  sessionId: z.number().int().positive(),
  userMessage: z.string().max(2000).optional(),
});

const assistantChatSchema = z.object({
  action: z.literal("CHAT").optional(),
  sessionId: z.number().int().positive().optional(),
  query: z
    .string()
    .min(1, "Sorgu en az 1 karakter olmalıdır.")
    .max(4000, "Sorgu çok uzun."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

/**
 * Handles POST requests for the Advisor module:
 * 1. `action: "REVIEW"` -> Runs the 3-part structured draft audit (Red/Yellow/Blue pen) and persists the office session.
 * 2. `action: "DEFENSE"` -> Streams live Socratic Professor negotiation via SSE.
 * 3. `action: "CHAT"` or fallback `query` -> Streams freeform Thesis Assistant turn with RAG, tools, and DB persistence.
 *
 * @param request - Incoming HTTP request.
 * @returns JSON or SSE streaming response.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Oturum süreniz dolmuş." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Geçersiz istek gövdesi." },
      { status: 400 },
    );
  }

  // 1. Office Review Action (Stage 1 Structured Audit)
  const reviewParse = officeReviewSchema.safeParse(body);
  if (reviewParse.success) {
    try {
      const { outlineId, draftText } = reviewParse.data;
      const result = await runOfficeReview({
        userId: session.userId,
        outlineId,
        draftText,
      });

      return NextResponse.json({
        success: true,
        sessionId: result.sessionId,
        reviewReport: result.reviewReport,
        sources: result.sources,
      });
    } catch (err) {
      new Logger(createFlowId()).error("Office review error:", {
        service: "advisor",
        error: err,
      });
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Taslak denetimi sırasında bir hata oluştu.",
        },
        { status: 500 },
      );
    }
  }

  // 2. Office Defense Action (Stage 2 Live Socratic Streaming)
  const defenseParse = officeDefenseSchema.safeParse(body);
  if (defenseParse.success) {
    const { sessionId, userMessage } = defenseParse.data;

    const readable = createSseStream(async ({ writer }) => {
      await streamOfficeDefense({
        userId: session.userId,
        sessionId,
        userMessage,
        writer,
      });
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // 3. Assistant Freeform Chat Action (Thesis Assistant)
  const chatParse = assistantChatSchema.safeParse(body);
  if (chatParse.success) {
    const { query, history, sessionId } = chatParse.data;

    const readable = createSseStream(async ({ writer }) => {
      await runTurn(writer, {
        userId: session.userId,
        query,
        history,
        sessionId,
      });
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  return NextResponse.json(
    { error: "Geçersiz istek parametreleri." },
    { status: 400 },
  );
}
