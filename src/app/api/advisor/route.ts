import { NextResponse } from "next/server";
import { z } from "zod";
import { performHybridRagSearch } from "@/lib/services/rag-search";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import { getAi } from "@/lib/services/gemini";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { buildAdvisorSystemInstruction } from "@/lib/prompts";
import {
  ADVISOR_TOOL_DECLARATIONS,
  isReadTool,
  executeReadTool,
} from "@/lib/services/advisor-tools";

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
 * Generates a human-readable Turkish explanation string for pending mutation tool calls.
 *
 * @param name - The function name.
 * @param args - The argument record.
 * @returns The formatted Turkish description for the UI card.
 */
function formatToolExplanation(
  name: string,
  args: Record<string, unknown>,
): string {
  switch (name) {
    case "updateThesisMatrix":
      return "Tez matrisi alanlarınız güncellenecek.";
    case "createBox":
      return `"${(args.title as string) || "Yeni Kutu"}" başlıklı yeni bir tez kutusu eklenecek.`;
    case "updateBox":
      return `Kutu #${args.boxId} bilgileri güncellenecek.`;
    case "deleteBox":
      return `Kutu #${args.boxId} veritabanından silinecek.`;
    case "updateSource":
      return `Kaynak #${args.sourceId} bilgileri güncellenecek.`;
    case "deleteSource":
      return `Kaynak #${args.sourceId} kütüphanenizden silinecek.`;
    case "addNote":
      return `Kaynak #${args.sourceId} için s. ${args.pageNumber || ""} numaralı yeni bir not/alıntı kaydedilecek.`;
    case "deleteNote":
      return `Not #${args.noteId} silinecek.`;
    case "createTask":
      return `"${(args.title as string) || "Yeni Görev"}" başlıklı çalışma görevi Kanban panosuna eklenecek.`;
    case "updateTaskStatus":
      return `Görev #${args.taskId} durumu "${args.status}" olarak güncellenecek.`;
    default:
      return `${name} veritabanı değişikliği gerçekleştirilecek.`;
  }
}

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
    /\b(kutu|kutusu|kutular|kutuları|görev|görevi|görevler|görevleri|not|notu|notlar|notları|alıntı|matris|matrisi|tez matrisi|kaynak|kaynağı|kaynaklar)\b/i.test(
      lower,
    );
  const hasActionVerb =
    /\b(ekle|eklesene|oluştur|oluştursana|sil|silsene|güncelle|güncellesene|değiştir|düzenle|tamamla|listele|göster|getir)\b/i.test(
      lower,
    );

  if (hasTarget && hasActionVerb) return true;

  if (/\b(ekle|oluştur|sil|güncelle)\b/i.test(lower) && lower.length < 60) {
    return true;
  }

  return false;
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

  const { query, history } = parseResult.data;
  const isAction = isActionQuery(query);
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
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
              const secStr = s.sectionTitle ? ` | Bölüm: ${s.sectionTitle}` : "";
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

        const systemInstruction = buildAdvisorSystemInstruction(contextText);

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
              fullText += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "delta", text })}\n\n`,
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

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_call_request",
                        toolCallId,
                        name: call.name,
                        args,
                        explanation,
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
            `data: ${JSON.stringify({ type: "done", text: fullText, sources })}\n\n`,
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
