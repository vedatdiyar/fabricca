import { z } from "zod";
import { generateCerebrasStructuredContent } from "@/services/ai";
import { CEREBRAS_MODEL } from "@/lib/constants";

export type AdvisorPersona = "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT";

export type AdvisorMode = "DIRECT" | "PIPELINE";

export interface ClassifierResult {
  persona: AdvisorPersona;
  reasoning: string;
  isActionQuery: boolean;
  mode: AdvisorMode;
}

const classifierZodSchema = z.object({
  persona: z.enum(["SOCRATIC_ADVISOR", "TEZ_ASSISTANT"]),
  reasoning: z.string(),
  isActionQuery: z.boolean(),
  mode: z.enum(["DIRECT", "PIPELINE"]),
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
    mode: {
      type: "string",
      enum: ["DIRECT", "PIPELINE"],
      description:
        "PIPELINE if the user message is a multi-sentence paragraph/draft text (typically an English thesis passage) to be audited, critically discussed, and polished. DIRECT if it is a standalone question (APA rule, concept question, database action) to be answered directly.",
    },
  },
  required: ["persona", "reasoning", "isActionQuery", "mode"],
  additionalProperties: false,
};

const SYSTEM_INSTRUCTION = `# Rol ve Uzmanlık

Sen dijital tez asistanı sisteminin niyet sınıflandırıcısısın (Intent Classifier).

# Birincil Görev

Kullanıcının son mesajını ve sohbet geçmişini inceleyerek devreye girmesi gereken personas (SOCRATIC_ADVISOR / TEZ_ASSISTANT), veritabanı işlem durumu (isActionQuery) ve akış modunu (DIRECT / PIPELINE) belirlemektir.

# Kurallar

1. **Persona Sınıflandırması:**
   - **"SOCRATIC_ADVISOR":** Kullanıcı tez niyetini, fikrini, hipotezini veya metodoloji tercihlerini belirttiğinde ya da eleştiri/dönüt istediğinde seçilir.
   - **"TEZ_ASSISTANT":** Kullanıcı doğrudan kavram tanımı, literatür sorgusu, APA kuralı sorduğunda veya veritabanı/tez yapısında güncelleme/işlem istediğinde seçilir.

2. **İşlem Sorgusu (isActionQuery):** Kullanıcı doğrudan veritabanı/araç komutu belirttiğinde \`isActionQuery = true\`, aksi halde \`false\` olarak işaretlenir.

3. **Akış Modu (mode):**
   - **"PIPELINE":** Kullanıcı denetlenmesi ve eleştirel olarak tartışılması gereken çok cümleli (30+ kelime, paragraf) bir akademik taslak metin veya redaksiyon isteği sunduğunda seçilir.
   - **"DIRECT":** Kullanıcı tek bir soru (kavram, APA, veritabanı işlemi) sorduğunda veya sohbet geçmişindeki Sokratik sorulara bir yanıt verdiğinde mode "DIRECT" olarak korunur.

# Çıktı Biçimi

Belirtilen JSON şemasına uygun olarak persona, reasoning, isActionQuery ve mode alanlarını döndürün.`;

/**
 * Classifies user intent into SOCRATIC_ADVISOR vs TEZ_ASSISTANT using Cerebras Gemma 4 (gemma-4-31b),
 * and decides whether the message is a standalone question (DIRECT) or a draft paragraph (PIPELINE).

/**
 * Classifies user intent into SOCRATIC_ADVISOR vs TEZ_ASSISTANT using Cerebras Gemma 4 (gemma-4-31b),
 * and decides whether the message is a standalone question (DIRECT) or a draft paragraph (PIPELINE).
 *
 * @param query - The user's current message.
 * @param history - Optional recent chat history context.
 * @returns The classification result containing persona, reasoning, isActionQuery flag, and mode.
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

    const res = await generateCerebrasStructuredContent<ClassifierResult>(
      CEREBRAS_MODEL,
      SYSTEM_INSTRUCTION,
      prompt,
      classifierJsonSchema,
      undefined,
      {
        zodSchema: classifierZodSchema,
        payloadStage: "advisor_intent_classifier",
        temperature: 0,
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

    const wordCount = query.trim().split(/\s+/).length;
    const hasMultiSentence = /\w+\s+\w+.*[.!?]["']?\s+/.test(query);
    const hasNewline = /\n/.test(query);
    const isRedactionRequest =
      /\b(polish|proofread|redakte|gözden geçir|düzelt\.*|revize|review my text)\b/i.test(
        query,
      );

    return {
      persona: isSocratic ? "SOCRATIC_ADVISOR" : "TEZ_ASSISTANT",
      reasoning: "Fallback classification",
      isActionQuery: isAction,
      mode:
        isRedactionRequest || wordCount > 40 || hasNewline || hasMultiSentence
          ? "PIPELINE"
          : "DIRECT",
    };
  }
}
