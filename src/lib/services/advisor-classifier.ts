import { z } from "zod";
import { generateStructuredContent } from "./cerebras";
import { CEREBRAS_MODEL } from "@/lib/constants";

export type AdvisorPersona = "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT";

export interface ClassifierResult {
  persona: AdvisorPersona;
  reasoning: string;
  isActionQuery: boolean;
}

const classifierZodSchema = z.object({
  persona: z.enum(["SOCRATIC_ADVISOR", "TEZ_ASSISTANT"]),
  reasoning: z.string(),
  isActionQuery: z.boolean(),
});

const classifierJsonSchema = {
  type: "object",
  properties: {
    persona: {
      type: "string",
      enum: ["SOCRATIC_ADVISOR", "TEZ_ASSISTANT"],
      description:
        "SOCRATIC_ADVISOR if user presents a thesis idea, hypothesis, writing plan, chapter structure, or asks for feedback/critique. TEZ_ASSISTANT if user asks factual definition, literature search, APA rule, or database operation.",
    },
    reasoning: {
      type: "string",
      description: "Brief reason for classification in Turkish.",
    },
    isActionQuery: {
      type: "boolean",
      description:
        "true if user explicitly requests a database creation/update/deletion or tool execution.",
    },
  },
  required: ["persona", "reasoning", "isActionQuery"],
  additionalProperties: false,
};

const SYSTEM_INSTRUCTION = `Sen dijital tez asistanı sisteminin niyet sınıflandırıcısısın (Intent Classifier).
Görevin, kullanıcının son mesajını ve sohbet geçmişini inceleyerek iki ana rolden hangisinin devreye girmesi gerektiğini belirlemektir:

1. "SOCRATIC_ADVISOR" (Akademik Tez Danışmanı - Sokratik Hoca):
   - Kullanıcı tezine dair bir NİYET, FİKİR, TASLAK, HİPOTEZ veya METODOLOJİ seçimi belirttiğinde (Örn: "Tezimde X konusunu Y yöntemiyle ele alacağım", "3. bölümde şunu tartışmayı düşünüyorum", "Sizce bu yaklaşım mantıklı mı?").
   - Kullanıcı danışmandan eleştiri, metodolojik değerlendirme, dönüt veya yönlendirme istediğinde.

2. "TEZ_ASSISTANT" (Araştırma & Operatör Asistanı):
   - Kullanıcı doğrudan bir KAVRAM, TANIM veya LİTERATÜR sorusu sorduğunda (Örn: "Biyo-politika nedir?", "Kütüphanemde X hakkında ne var?", "APA 7 atıf kuralı nedir?").
   - Kullanıcı veritabanı veya tez yapısı üzerinde İŞLEM / GÜNCELLEME istediğinde (Örn: "Kutu ekle", "Görev oluştur", "Matrisi güncelle", "Not sil").

Ayrıca mesajın doğrudan veritabanı/araç komutu olup olmadığını "isActionQuery" (true/false) olarak belirt.`;

/**
 * Classifies user intent into SOCRATIC_ADVISOR vs TEZ_ASSISTANT using Cerebras Gemma 4 (gemma-4-31b).
 *
 * @param query - The user's current message.
 * @param history - Optional recent chat history context.
 * @returns The classification result containing persona, reasoning, and isActionQuery flag.
 */
export async function classifyAdvisorIntent(
  query: string,
  history?: Array<{ role: string; content: string }>,
): Promise<ClassifierResult> {
  try {
    let historyContext = "";
    if (history && history.length > 0) {
      historyContext =
        "\n\nSon Sohbet Geçmişi:\n" +
        history
          .slice(-4)
          .map(
            (m) =>
              `${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.content}`,
          )
          .join("\n");
    }

    const prompt = `Kullanıcı Mesajı: "${query}"${historyContext}`;

    const res = await generateStructuredContent<ClassifierResult>(
      CEREBRAS_MODEL,
      SYSTEM_INSTRUCTION,
      prompt,
      classifierJsonSchema,
      undefined,
      {
        zodSchema: classifierZodSchema,
        payloadStage: "advisor_intent_classifier",
        temperature: 0.1,
      },
    );

    return res;
  } catch (error) {
    console.error("Cerebras intent classification fallback:", error);
    // Safe fallback based on simple regex heuristics
    const isAction =
      /\b(ekle\w*|oluştur\w*|sil\w*|güncelle\w*|değiştir\w*|düzenle\w*|tamamla\w*|göster\w*)\b/i.test(
        query,
      );
    const isSocratic =
      /\b(tezim\w*|yazacağım|düşünüyorum|hipotez\w*|yöntem\w*|bölüm\w*|fikrim\w*|nasıl\w*|eleştir\w*)\b/i.test(
        query,
      );

    return {
      persona: isSocratic ? "SOCRATIC_ADVISOR" : "TEZ_ASSISTANT",
      reasoning: "Fallback classification",
      isActionQuery: isAction,
    };
  }
}
