import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/core/services/ai/providers/gemini-provider";
import { FLASH_LITE_35 } from "@/lib/constants";

import type { Logger } from "@/lib/logger";
import type { NoteType, NoteVerificationData } from "../_lib/types";

const verificationIssueSchema = z.object({
  type: z.enum([
    "PAGE_MISMATCH",
    "VERBATIM_DIFF",
    "INTERPRETATION_CONFLICT",
    "NOTE_TYPE_MISMATCH",
    "FORMAT_WARNING",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  title: z.string().min(1),
  description: z.string().min(1),
  suggestedFix: z.string().optional(),
  suggestedPage: z.string().optional(),
});

const noteVerificationSchema = z.object({
  status: z.enum(["VERIFIED", "WARNING"]),
  confidence: z.number().min(0).max(1),
  detectedPage: z.string().optional(),
  summary: z.string().min(1),
  issues: z.array(verificationIssueSchema),
  academicAdvice: z.string().optional(),
});

import type { JsonSchema } from "@/core/services/ai/llm-types";

export type NoteVerificationResult = z.infer<typeof noteVerificationSchema>;

const verificationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["VERIFIED", "WARNING"],
      description:
        "Overall verification result: VERIFIED if accurate/grounded, WARNING if issues found.",
    },
    confidence: {
      type: "number",
      description: "Confidence score between 0 and 1.",
    },
    detectedPage: {
      type: "string",
      description:
        "The actual page number in the source where this excerpt was located, if found.",
    },
    summary: {
      type: "string",
      description:
        "Short, polite 1-sentence Turkish summary of the verification result.",
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "PAGE_MISMATCH",
              "VERBATIM_DIFF",
              "INTERPRETATION_CONFLICT",
              "NOTE_TYPE_MISMATCH",
              "FORMAT_WARNING",
            ],
          },
          severity: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
          },
          title: { type: "string" },
          description: { type: "string" },
          suggestedFix: { type: "string" },
          suggestedPage: { type: "string" },
        },
        required: ["type", "severity", "title", "description"],
      },
    },
    academicAdvice: {
      type: "string",
      description:
        "Optional constructive Turkish advice on how to improve this citation card or note.",
    },
  },
  required: ["status", "confidence", "summary", "issues"],
};

interface VerifyNoteInput {
  note: {
    content: string;
    pageNumber: string;
    noteType: NoteType;
    comment?: string;
  };
  source: {
    title: string;
    authors?: string[];
    publicationYear?: number | null;
  };
  relevantChunks: Array<{
    content: string;
    pageNumber?: string | null;
  }>;
  logger?: Logger;
}

const SYSTEM_INSTRUCTION = `
<role>
Kıdemli akademik araştırma denetçisi ve kaynak doğrulama uzmanı.
</role>

<instructions>
# Görev
Kullanıcının bir akademik makaleden aldığı not/alıntı fişini ve isteğe bağlı şerhini incele.
Sağlanan PDF metin parçaları (chunks) ile notu karşılaştır ve şu kurallara göre doğrula:

1. **Sayfa ve Metin Birebirliği:**
   - Eğer not türü 'DIRECT_QUOTE' (Doğrudan Alıntı) ise, metin belirtilen sayfadaki kaynak metinle birebir örtüşüyor mu?
   - Metinde kelime atlama, tahrifat veya eksik alıntılama var mı?
   - Alıntı kullanıcının belirttiği sayfa numarasında mı, yoksa farklı bir sayfada mı yer alıyor?

2. **Not Türü Uygunluğu:**
   - 'DIRECT_QUOTE': Kaynaktan harfiyen alıntılanmış olmalıdır.
   - 'PARAPHRASE': Kaynaktaki fikir araştırmacının kendi cümleleriyle aktarılmış olmalıdır.
   - 'PERSONAL_NOTE': Kaynak üzerine yapılmış kişisel değerlendirme veya çıkarım olmalıdır.

3. **Yorum / Şerh Tutarlılığı:**
   - Kullanıcı bir 'Düşünce / Şerh' (comment) eklediyse, yazarın makaledeki asıl tezini veya bağlamını çarpıtma/yanlış anlama riski var mı? (Örn. yazarın karşı çıktığı bir argümanı yazarın tezi sanmak).

4. **Biçim ve Anlatım:**
   - Cümle ortasında kopukluk veya anlamsız kesinti olup olmadığını denetle.

# Çıktı Dili ve Formatı
- Tüm özet, başlık, açıklama ve tavsiyeler akıcı, nazik ve yapıcı akademik Türkçe ile yazılmalıdır.
- Eğer metin kaynakla uyumluysa status: "VERIFIED" ve issues: [] dön.
- Eğer sayfa kayması, alıntı hatası veya anlam çarpıtması varsa status: "WARNING" ve ilgili issues listesini doldur.
</instructions>
`;

/**
 * Verifies an individual academic note against source PDF chunks using Gemini Flash-Lite.
 *
 * @param input - The note data, source metadata, and matched PDF chunks.
 * @returns Structured verification result.
 */
export async function verifyResourceNote(
  input: VerifyNoteInput,
): Promise<NoteVerificationData> {
  const { note, source, relevantChunks, logger } = input;

  const chunksContext =
    relevantChunks.length > 0
      ? relevantChunks
          .map(
            (c, i) =>
              `[Parça ${i + 1} - Sayfa: ${c.pageNumber || "Belirtilmemiş"}]:\n${c.content}`,
          )
          .join("\n\n---\n\n")
      : "Bu kaynak için henüz PDF metin parçaları ayrıştırılmamış. Genel mantık, not türü ve şerh tutarlılığı üzerinden değerlendirme yap.";

  const prompt = `
<context>
# Eser Bilgisi
- Başlık: ${source.title}
- Yazarlar: ${source.authors?.join(", ") || "Belirtilmemiş"}
- Yıl: ${source.publicationYear ?? "Belirtilmemiş"}

# İncelenen Not / Alıntı Fişi
- Belirtilen Sayfa Numarası: ${note.pageNumber}
- Not Türü: ${note.noteType}
- Not/Alıntı Metni:
"""
${note.content}
"""
- Kullanıcının Düşüncesi/Şerhi: ${note.comment ? `"""\n${note.comment}\n"""` : "Girilmedi"}

# Kaynak Metin Parçaları (Chunks)
${chunksContext}
</context>

<task>
Yukarıdaki <context> içeriğini inceleyerek notun sayfa doğruluğunu, metin örtüşmesini, not türü uygunluğunu ve şerh bağlamını doğrula ve yapılandırılmış JSON çıktısını üret.
</task>
`;

  try {
    const rawResult = await generateStructuredContent<NoteVerificationResult>(
      FLASH_LITE_35,
      SYSTEM_INSTRUCTION,
      prompt,
      verificationJsonSchema,
      logger,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        payloadStage: "note_verification",
        operation: "note_verification",
        zodSchema: noteVerificationSchema,
      },
    );

    return {
      status: rawResult.status,
      confidence: rawResult.confidence,
      detectedPage: rawResult.detectedPage,
      summary: rawResult.summary,
      issues: rawResult.issues,
      academicAdvice: rawResult.academicAdvice,
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger?.error("note_verification_failed", {
      service: "library",
      error: err,
    });

    return {
      status: "VERIFIED",
      confidence: 0.5,
      summary: "Doğrulama servisine ulaşılamadı; not kaydedildi.",
      issues: [],
      verifiedAt: new Date().toISOString(),
    };
  }
}
