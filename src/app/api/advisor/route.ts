import { NextResponse } from "next/server";
import { z } from "zod";
import { performHybridRagSearch } from "@/lib/services/rag-search";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import { getAi } from "@/lib/services/gemini";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { buildAdvisorSystemInstruction } from "@/lib/prompts";

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
 * Handles POST requests for streaming advisor queries via SSE.
 *
 * @param request - The incoming HTTP request with query and optional history.
 * @returns A streaming SSE response with delta events and a final done event.
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

  const rawSources = await performHybridRagSearch({ query, topK: 5 });
  const sources = rawSources;

  let contextText = "";
  if (sources.length > 0) {
    const allPartial = sources.every((s) => s.isPartialMatch);
    if (allPartial) {
      contextText +=
        "NOT: Aşağıdaki kaynaklar doğrudan eşleşmemektedir, yalnızca dolaylı olarak ilgili olabilirler. Bu bilgileri ihtiyatla kullanın.\n\n";
    }
    contextText += sources
      .map((s, idx) => {
        const pageStr = formatPageReference(s);
        const secStr = s.sectionTitle ? ` | Bölüm: ${s.sectionTitle}` : "";
        const authors = s.resourceAuthors.join(", ");
        const yearStr = s.resourceYear
          ? `Yıl: ${s.resourceYear}`
          : "Yıl bilinmiyor";
        const partialTag = s.isPartialMatch ? " [DOLAYLI İLGİLİ]" : "";
        return `--- KAYNAK PARÇASI #${idx + 1}${partialTag} ---
[Eser: "${s.resourceTitle}" | Yazar: ${authors} | ${yearStr} | ${pageStr}${secStr} | Alakalılık Skoru: ${(s.relevanceScore * 100).toFixed(1)}%]
${s.content}`;
      })
      .join("\n\n");
  } else {
    contextText =
      "Kütüphanenizde bu sorguyla doğrudan eşleşen veya yeterince alakalı bir kaynak bulunamadı. Lütfen sorgunuzu kütüphanenizdeki mevcut konulara yönelik olarak yeniden formüle edin.";
  }

  const systemInstruction = buildAdvisorSystemInstruction(contextText);

  const ai = getAi();
  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = [];

  if (history && history.length > 0) {
    for (const msg of history.slice(-6)) {
      contents.push({ role: msg.role, parts: [{ text: msg.content }] });
    }
  }

  contents.push({ role: "user", parts: [{ text: query }] });

  const stream = await ai.models.generateContentStream({
    model: FLASH_LITE_31,
    contents,
    config: { systemInstruction, seed: GEMINI_SEED },
  });

  let fullText = "";

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text ?? "";
          if (text) {
            fullText += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", text })}\n\n`,
              ),
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", text: fullText, sources })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
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
