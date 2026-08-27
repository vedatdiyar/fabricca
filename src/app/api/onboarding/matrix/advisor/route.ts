import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices, type MatrixAdvisorMessage } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { createSseStream } from "@/app/(app)/advisor/_services/stream";
import { runAdvisorTurnStream } from "@/app/(onboarding)/onboarding/matrix/_services/advisor-engine";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

const requestSchema = z.object({
  history: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "model"]),
      content: z.string(),
    }),
  ),
  currentMatrix: z.object({
    subjectProblem: z.string().optional().default(""),
    theoreticalFramework: z.string().optional().default(""),
    primaryMaterial: z.string().optional().nullable().default(""),
    methodology: z.string().optional().default(""),
  }),
});

/**
 * POST handler for Onboarding Matrix Socratic Advisor SSE Streaming.
 * Streams reasoning/literature search status, plain text deltas, and persists
 * both crystallized matrix quadrants and full chat history into Neon PostgreSQL.
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
      { error: "Geçersiz istek formatı." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Eksik veya geçersiz parametreler." },
      { status: 400 },
    );
  }

  const { history, currentMatrix } = parsed.data;

  const readable = createSseStream(async ({ writer }) => {
    try {
      const sanitizedMatrix = {
        ...currentMatrix,
        primaryMaterial: currentMatrix.primaryMaterial ?? undefined,
      };

      const result = await runAdvisorTurnStream(writer, {
        history,
        currentMatrix: sanitizedMatrix,
      });

      const updatedMatrix = { ...sanitizedMatrix };
      if (result.matrixUpdate) {
        updatedMatrix[result.matrixUpdate.field] = result.matrixUpdate.value;
      }

      const modelMessage: MatrixAdvisorMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        content: result.replyText,
      };

      const updatedMessages: MatrixAdvisorMessage[] = [
        ...history,
        modelMessage,
      ];

      // Progressive Save of matrix and advisorMessages into Neon DB
      await db
        .insert(matrices)
        .values({
          userId: session.userId,
          subjectProblem: updatedMatrix.subjectProblem ?? "",
          theoreticalFramework: updatedMatrix.theoreticalFramework ?? "",
          primaryMaterial: updatedMatrix.primaryMaterial ?? "",
          methodology: updatedMatrix.methodology ?? "",
          advisorMessages: updatedMessages,
          updatedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: matrices.userId,
          set: {
            subjectProblem: updatedMatrix.subjectProblem ?? "",
            theoreticalFramework: updatedMatrix.theoreticalFramework ?? "",
            primaryMaterial: updatedMatrix.primaryMaterial ?? "",
            methodology: updatedMatrix.methodology ?? "",
            advisorMessages: updatedMessages,
            updatedAt: sql`now()`,
          },
        });

      invalidateOnboardingStepCache("matrix");

      writer.send("done", {
        messageId: modelMessage.id,
        replyText: result.replyText,
        matrixUpdate: result.matrixUpdate,
        updatedMatrix,
      });
      writer.done();
    } catch (err) {
      new Logger(createFlowId()).error("Onboarding advisor streaming turn failed", {
        service: "matrix",
        error: err,
      });
      writer.send("error", {
        error:
          err instanceof Error
            ? err.message
            : "Danışman yanıt verirken bir sorun oluştu.",
      });
      writer.done();
    }
  });

  return new Response(readable, {
    headers: sseHeaders,
  });
}
