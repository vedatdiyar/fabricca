import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createSseStream } from "@/features/advisor/stream";
import { runTurn } from "@/features/advisor/turn";

const requestSchema = z.object({
  query: z
    .string()
    .min(2, "Sorgu en az 2 karakter olmalıdır.")
    .max(1000, "Sorgu çok uzun."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string(),
      }),
    )
    .optional(),
});

/**
 * Handles POST requests for streaming advisor queries via SSE with Function Calling support.
 *
 * Delegates all turn orchestration (classification, RAG, tool loop, pipeline flow)
 * to {@link runTurn} wrapped in a streaming SSE response.
 *
 * @param request - The incoming HTTP request with query and optional history.
 * @returns A streaming SSE response with delta, tool call, and done events.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Oturum süreniz dolmuş." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Geçersiz sorgu." },
      { status: 400 },
    );
  }

  const { query, history } = parseResult.data;

  const readable = createSseStream(async ({ writer }) => {
    await runTurn(writer, { userId: session.userId, query, history });
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
