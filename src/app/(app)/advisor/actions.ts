"use server";

import { z } from "zod";
import { getSession } from "@/lib/session";
import { performHybridRagSearch } from "@/lib/services/rag-search";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import { getAi } from "@/lib/services/gemini";
import { FLASH_LITE_31 } from "@/lib/constants";
import { Logger, createFlowId } from "@/lib/logger";

const querySchema = z.object({
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

export interface AdvisorResponse {
  success: boolean;
  answer?: string;
  sources?: RagSearchResultItem[];
  error?: string;
}

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
 * Server Action executing hybrid RAG retrieval and generating an academic response using Gemini Flash-Lite.
 *
 * @param input - The search query and conversation history container.
 * @param input.query - The search query string.
 * @param input.history - Optional previous message history.
 * @returns The generated response text and cited RAG sources.
 */
export async function sendAdvisorQueryAction(input: {
  query: string;
  history?: { role: "user" | "model"; content: string }[];
}): Promise<AdvisorResponse> {
  const parseResult = querySchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Geçersiz sorgu.",
    };
  }

  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.",
    };
  }

  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    log.info("advisor_rag_search_start", {
      service: "advisor",
      data: { query: parseResult.data.query },
    });

    const sources = await performHybridRagSearch({
      query: parseResult.data.query,
      topK: 5,
      logger: log,
    });

    log.info("advisor_rag_search_success", {
      service: "advisor",
      data: { sourceCount: sources.length },
    });

    let contextText = "";
    if (sources.length > 0) {
      contextText = sources
        .map((s, idx) => {
          const pageStr = formatPageReference(s);
          const secStr = s.sectionTitle ? ` | Bölüm: ${s.sectionTitle}` : "";
          const authors = s.resourceAuthors.join(", ");
          return `--- KAYNAK PARÇASI #${idx + 1} ---
[Eser: "${s.resourceTitle}" | Yazar: ${authors} | ${pageStr}${secStr} | Alakalılık Skoru: ${(s.relevanceScore * 100).toFixed(1)}%]
${s.content}`;
        })
        .join("\n\n");
    } else {
      contextText =
        "Kütüphanedeki dökümanlarda bu sorguyla doğrudan eşleşen metin bulunamadı.";
    }

    const systemInstruction = `Sen dijital tez asistanı uygulamasının elit Yapay Zeka Tez Danışmanısın (Lead Academic Advisor).
Görevin: Yüksek lisans ve doktora öğrencilerinin akademik sorularına titiz, tarafsız, analitik ve elit bir akademik Türkçe ile yanıt vermektir.

Sana verilen Kütüphane RAG Bağlamı (Top 5 En Alakalı Makale Bölümü):
${contextText}

TALİMATLAR VE KURALLAR:
1. Yalnızca kütüphaneden çekilen yukarıdaki RAG bağlamındaki bilgilere ve bulgulara dayanarak akademik yanıt üret.
2. Bağlamda yeterli veya doğrudan bilgi yoksa bunu dürüstçe ve açıkça ifade et.
3. Metin içerisinde bilgi aktarırken mutlaka [Eser Adı, s. X] veya çok sayfalı aktarımlarda [Eser Adı, ss. X–Y] formatında atıfta bulun.
4. Yanıtını net başlıklar, maddeler ve akıcı paragraflarla yapılandır.
5. Kullanıcının sorusuna doğrudan, özgüvenli ve bilimsel metodolojiye uygun cevap ver.`;

    const ai = getAi();
    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    if (parseResult.data.history && parseResult.data.history.length > 0) {
      for (const msg of parseResult.data.history.slice(-6)) {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: parseResult.data.query }],
    });

    log.info("advisor_llm_generate_start", {
      service: "advisor",
      data: { model: FLASH_LITE_31 },
    });

    const response = await ai.models.generateContent({
      model: FLASH_LITE_31,
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const answer = response.text || "Danışman yanıtı üretilemedi.";

    log.info("advisor_llm_generate_success", {
      service: "advisor",
      data: { answerLength: answer.length },
    });

    return {
      success: true,
      answer,
      sources,
    };
  } catch (error) {
    log.error("advisor_query_failed", {
      service: "advisor",
      error,
    });

    return {
      success: false,
      error:
        "Danışman yanıtı üretilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}
