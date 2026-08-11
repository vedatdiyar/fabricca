import { NextResponse } from "next/server";
import { z } from "zod";
import { performHybridRagSearch } from "@/lib/services/rag-search";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import { getAi } from "@/lib/services/gemini";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { buildAdvisorSystemInstruction } from "@/lib/prompts";
import { sanitizeModelStreamText } from "@/lib/text-sanitizer";
import { classifyAdvisorIntent } from "@/lib/services/advisor-classifier";
import {
  ADVISOR_TOOL_DECLARATIONS,
  isReadTool,
  executeReadTool,
  getToolPreviousState,
} from "@/lib/services/advisor-tools";
import { formatToolExplanation } from "@/lib/services/advisor-tools/format-tool";
import { runPipelineTurn } from "@/lib/services/advisor-pipeline/orchestrator";
import { formatRagSourceContext } from "@/lib/services/advisor-pipeline/context";

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
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Fast Cerebras Gemma-4 classification for intent & persona
        const classification = await classifyAdvisorIntent(query, history);
        const persona = classification.persona;

        // Heavy Flow is triggered by a fresh draft paragraph as classified by the intent classifier.
        const isPipelineTurn = classification.mode === "PIPELINE";

        // Immediately inform UI client of assigned persona
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "persona_assigned", persona })}\n\n`,
          ),
        );

        if (isPipelineTurn) {
          const writer = {
            send(type: string, payload: Record<string, unknown>) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type, ...payload })}\n\n`,
                ),
              );
            },
            delta(text: string) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "delta", text: sanitizeModelStreamText(text) })}\n\n`,
                ),
              );
            },
          };

          const { text, sources, pipeline } = await runPipelineTurn(writer, {
            userId: session.userId,
            originalDraft: query,
          });

          const responsePersona = !pipeline.audit
            ? "SOCRATIC_ADVISOR"
            : persona;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", text: sanitizeModelStreamText(text), sources, persona: responsePersona, pipeline })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const isAction = classification.isActionQuery;

        let sources: RagSearchResultItem[] = [];

        // Fast-Path: Skip heavy RAG literature search for direct database action queries
        if (!isAction) {
          sources = await performHybridRagSearch({ query, topK: 7 });
        }

        let contextText = "";
        if (sources.length > 0) {
          contextText = formatRagSourceContext(sources, {
            includePartialNotice: true,
          });
        } else if (isAction) {
          contextText =
            "Kullanıcı doğrudan bir veritabanı/araç işlemi gerçekleştirmek istemektedir. İlgili aracı (function call) uygun parametrelerle hemen çağırın.";
        } else {
          contextText =
            "Kütüphanenizde bu sorguyla doğrudan eşleşen veya yeterince alakalı bir kaynak bulunamadı. Lütfen sorgunuzu kütüphanenizdeki mevcut konulara yönelik olarak yeniden formüle edin.";
        }

        const systemInstruction = buildAdvisorSystemInstruction(
          contextText,
          persona,
        );

        const ai = getAi();
        const contents: Array<Record<string, unknown>> = [];

        if (history && history.length > 0) {
          for (const msg of history.slice(-6)) {
            contents.push({ role: msg.role, parts: [{ text: msg.content }] });
          }
        }

        contents.push({ role: "user", parts: [{ text: query }] });

        let fullText = "";
        let maxTurns = 5;
        let continueLoop = true;

        while (continueLoop && maxTurns > 0) {
          maxTurns--;
          continueLoop = false;
          const turnModelParts: Array<Record<string, unknown>> = [];

          const stream = await ai.models.generateContentStream({
            model: FLASH_LITE_35,
            contents: contents as unknown as Parameters<
              typeof ai.models.generateContentStream
            >[0]["contents"],
            config: {
              systemInstruction,
              seed: GEMINI_SEED,
              tools: [{ functionDeclarations: ADVISOR_TOOL_DECLARATIONS }],
            },
          });

          for await (const chunk of stream) {
            if (chunk.candidates?.[0]?.content?.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                turnModelParts.push(part as unknown as Record<string, unknown>);
              }
            }

            let text = "";
            try {
              if (chunk.candidates?.[0]?.content?.parts) {
                for (const part of chunk.candidates[0].content.parts) {
                  if (part.text) text += part.text;
                }
              } else {
                text = chunk.text ?? "";
              }
            } catch {
              text = "";
            }

            if (text) {
              const clean = sanitizeModelStreamText(text);
              fullText += clean;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "delta", text: clean })}\n\n`,
                ),
              );
            }

            let funcCalls = chunk.functionCalls;
            if (!funcCalls && chunk.candidates?.[0]?.content?.parts) {
              const callParts = chunk.candidates[0].content.parts.filter(
                (p) => p.functionCall,
              );
              if (callParts.length > 0) {
                funcCalls = callParts.map((p) => p.functionCall!);
              }
            }
            if (funcCalls && funcCalls.length > 0) {
              for (const call of funcCalls) {
                if (!call.name) continue;

                if (isReadTool(call.name)) {
                  const readResult = await executeReadTool(
                    call.name,
                    (call.args as Record<string, unknown>) ?? {},
                    session.userId,
                  );

                  contents.push({
                    role: "model",
                    parts:
                      turnModelParts.length > 0
                        ? turnModelParts
                        : [{ functionCall: call }],
                  });
                  contents.push({
                    role: "user",
                    parts: [
                      {
                        functionResponse: {
                          name: call.name,
                          response: { result: readResult },
                        },
                      },
                    ],
                  });

                  continueLoop = true;
                } else {
                  const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                  const args = (call.args as Record<string, unknown>) ?? {};
                  const explanation = formatToolExplanation(call.name, args);
                  const previousState = await getToolPreviousState(
                    call.name,
                    args,
                    session.userId,
                  );

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_call_request",
                        status: "pending",
                        toolCallId,
                        name: call.name,
                        args,
                        explanation,
                        previousState,
                      })}\n\n`,
                    ),
                  );
                }
              }
            }
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", text: sanitizeModelStreamText(fullText), sources, persona })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const errorDetail = err instanceof Error ? err.message : String(err);
        console.error("Advisor API error:", errorDetail);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: "Yanıt üretilirken hata oluştu." })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
