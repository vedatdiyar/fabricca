import { z } from "zod";
import { generateStructuredContent } from "./cerebras";
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

const SYSTEM_INSTRUCTION = `Sen dijital tez asistanı sisteminin niyet sınıflandırıcısısın (Intent Classifier).
Görevin, kullanıcının son mesajını ve sohbet geçmişini inceleyerek iki ana rolden hangisinin devreye girmesi gerektiğini belirlemektir:

1. "SOCRATIC_ADVISOR" (Akademik Tez Danışmanı - Sokratik Hoca):
   - Kullanıcı tezine dair bir NİYET, FİKİR, TASLAK, HİPOTEZ veya METODOLOJİ seçimi belirttiğinde (Örn: "Tezimde X konusunu Y yöntemiyle ele alacağım", "3. bölümde şunu tartışmayı düşünüyorum", "Sizce bu yaklaşım mantıklı mı?").
   - Kullanıcı danışmandan eleştiri, metodolojik değerlendirme, dönüt veya yönlendirme istediğinde.

2. "TEZ_ASSISTANT" (Araştırma & Operatör Asistanı):
   - Kullanıcı doğrudan bir KAVRAM, TANIM veya LİTERATÜR sorusu sorduğunda (Örn: "Biyo-politika nedir?", "Kütüphanemde X hakkında ne var?", "APA 7 atıf kuralı nedir?").
   - Kullanıcı veritabanı veya tez yapısı üzerinde İŞLEM / GÜNCELLEME istediğinde (Örn: "Kutu ekle", "Görev oluştur", "Matrisi güncelle", "Not sil").

Ayrıca mesajın doğrudan veritabanı/araç komutu olup olmadığını "isActionQuery" (true/false) olarak belirt.

Son olarak üç aşamalı akademik pipeline (Denetim -> Sokratik Tartışma -> Redaksiyon) için "mode" kararını ver:

1. "PIPELINE":
   - Kullanıcı çok cümleli bir PARAGRAF / TASLAK METİN gönderdiğinde (genellikle İngilizce tez pasajı). Metnin denetlenmesi (kaynak/sayfa doğrulaması), eleştirel olarak tartışılması ve gramer/akademik üslup/APA 7 açısından cilalanması gereken bir metindir.
   - Kullanıcı açıkça "şu metni düzelt/polish/proofread/redakte eder misin", "paragrafımı gözden geçir" gibi bir gözden geçirme istediğinde.
   - İpucu: Pragmatik olarak mesaj 30+ kelimeden oluşuyor veya birden fazla noktalı cümle ya da yeni satır içeriyorsa ve tek bir kısa soru değilse bu bir taslak metindir.

2. "DIRECT":
   - Kullanıcının mesajı tek başına bir SORU olduğunda (APA kuralı, kavram tanımı, literatür sorusu, veritabanı işlemi). Mode değeri PIPELINE'a yalnızca gerçek bir taslak metin/pasaj söz konusu olduğunda ayarlanmalıdır.
   - ÖNEMLİ: Sohbet geçmişindeki son Asistan mesajı Sokratik sorular sorup kullanıcının yanıtını bekliyorsa ve kullanıcının yeni mesajı bu sorulara verilmiş bir YANITSA (kaç cümle olursa olsun) mode yine "DIRECT" olarak kalmalıdır; yeni bir taslak metin başlatılmamalıdır.`;

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
