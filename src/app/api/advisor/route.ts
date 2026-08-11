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

/**
 * Detects whether a query is a direct database action/mutation command
 * (e.g. creating/updating/deleting boxes, tasks, notes, or matrix fields)
 * that does not require academic literature retrieval.
 *
 * @param query - User input text.
 * @returns True when the query represents an explicit action/tool call.
 */
function isActionQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  const hasTarget =
    /\b(kutu\w*|görev\w*|not\w*|matris\w*|kaynak\w*|kaynağı\w*|açıklam\w*|başlı\w*|alıntı\w*)\b/i.test(
      lower,
    );
  const hasActionVerb =
    /\b(ekle\w*|oluştur\w*|sil\w*|güncelle\w*|değiştir\w*|düzenle\w*|tamamla\w*|listele\w*|göster\w*|getir\w*|kaldır\w*|işaretle\w*)\b/i.test(
      lower,
    );

  if (hasTarget && hasActionVerb) return true;

  if (
    /\b(ekle\w*|oluştur\w*|sil\w*|güncelle\w*|değiştir\w*|listele\w*|göster\w*)\b/i.test(
      lower,
    ) &&
    lower.length < 80
  ) {
    return true;
  }

  return false;
}

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
  /** Active 3-stage pipeline context forwarded by the client to continue an open Socratic discussion. */
  pipelineState: z
    .object({
      active: z.boolean(),
      cycle: z.number().int().min(1),
      originalDraft: z.string().max(1000).optional(),
    })
    .optional(),
});

/**
 * Formats a retrieval source page reference using Turkish academic APA conventions.
 *
 * @param source - The RAG retrieval result whose page span should be rendered.
 * @returns The page reference string ("Bilinmeyen Sayfa" when no page info exists).
 */
function formatPageReference(source: RagSearchResultItem): string {
  if (source.printedPageNumber) return `${source.printedPageNumber}.`;
  const pageSpan = source.pageStart;
  const range = source.pageEnd;
  if (pageSpan == null) return "Bilinmeyen Sayfa";
  return pageSpan === range ? `s. ${pageSpan}.` : `ss. ${pageSpan}–${range}.`;
}

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

  const { query, history, pipelineState } = parseResult.data;
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Fast Cerebras Gemma-4 classification for intent & persona
        const classification = await classifyAdvisorIntent(query, history);
        const persona = classification.persona;

        // Pipeline is triggered by a fresh draft paragraph (classifier), or by an
        // explicit client continuation of an open Socratic discussion when the
        // incoming message is a direct answer rather than a new draft.
        const isPipelineContinuation =
          pipelineState?.active === true && classification.mode === "DIRECT";
        const isPipelineTurn =
          isPipelineContinuation || classification.mode === "PIPELINE";

        // Immediately inform UI client of assigned persona
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "persona_assigned", persona })}\n\n`,
          ),
        );

        if (isPipelineTurn) {
          const originalDraft =
            pipelineState?.originalDraft?.trim() && isPipelineContinuation
              ? pipelineState.originalDraft.trim()
              : query;
          const cycle = isPipelineContinuation
            ? Math.min(3, (pipelineState?.cycle ?? 0) + 1)
            : 1;

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
            query,
            originalDraft,
            isContinuation: isPipelineContinuation,
            cycle,
            history: history ?? [],
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", text: sanitizeModelStreamText(text), sources, persona, pipeline })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const isAction = isActionQuery(query) || classification.isActionQuery;

        let sources: RagSearchResultItem[] = [];

        // Fast-Path: Skip heavy RAG literature search for direct database action queries
        if (!isAction) {
          sources = await performHybridRagSearch({ query, topK: 7 });
        }

        let contextText = "";
        if (sources.length > 0) {
          const allPartial = sources.every((s) => s.isPartialMatch);
          if (allPartial) {
            contextText +=
              "NOT: Aşağıdaki kaynaklar doğrudan eşleşmemektedir, yalnızca dolaylı olarak ilgili olabilirler. Bu bilgileri ihtiyatla kullanın.\n\n";
          }
          const emittedParagraphs = new Set<string>();
          contextText += sources
            .map((s, idx) => {
              const pageStr = formatPageReference(s);
              const secStr = s.sectionTitle
                ? ` | Bölüm: ${s.sectionTitle}`
                : "";
              const authors = s.resourceAuthors.join(", ");
              const yearStr = s.resourceYear
                ? `Yıl: ${s.resourceYear}`
                : "Yıl bilinmiyor";
              const partialTag = s.isPartialMatch ? " [DOLAYLI İLGİLİ]" : "";
              const windowText =
                s.parentContent && s.parentContent.length > 0
                  ? s.parentContent
                  : s.content;
              const paragraphText = windowText
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter((p) => p.length > 0)
                .filter((p) => {
                  if (emittedParagraphs.has(p)) return false;
                  emittedParagraphs.add(p);
                  return true;
                })
                .join("\n\n");
              return `--- KAYNAK PARÇASI #${idx + 1}${partialTag} ---
[Eser: "${s.resourceTitle}" | Yazar: ${authors} | ${yearStr} | ${pageStr}${secStr} | Alakalılık Skoru: ${(s.relevanceScore * 100).toFixed(1)}%]
${paragraphText}`;
            })
            .join("\n\n");
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
