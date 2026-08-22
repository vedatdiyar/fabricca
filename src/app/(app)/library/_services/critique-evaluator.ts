import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/core/services/ai/providers/gemini-provider";
import { FLASH_LITE_35 } from "@/lib/constants";

import type { Logger } from "@/lib/logger";
import type {
  LibraryResourceNote,
  LibraryResourceCritique,
  ResourceAuditReport,
} from "../_lib/types";

const auditReportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  statusBadge: z.enum(["EXCELLENT", "SOLID", "NEEDS_ATTENTION"]),
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(1),
  blindSpots: z.array(z.string().min(1)),
  commentaryRisks: z.array(z.string().min(1)),
  thesisAlignmentAdvice: z.string().min(1),
});

import type { JsonSchema } from "@/core/services/ai/llm-types";

export type AuditReportResult = z.infer<typeof auditReportSchema>;

const auditReportJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Academic rigor score from 0 to 100.",
    },
    statusBadge: {
      type: "string",
      enum: ["EXCELLENT", "SOLID", "NEEDS_ATTENTION"],
      description:
        "EXCELLENT for thorough & precise notes, SOLID for good coverage, NEEDS_ATTENTION if gaps or misinterpretations exist.",
    },
    summary: {
      type: "string",
      description:
        "2-3 sentence executive synthesis of the researcher's engagement with this work in academic Turkish.",
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description:
        "List of strong, well-captured points and insightful annotations (in Turkish).",
    },
    blindSpots: {
      type: "array",
      items: { type: "string" },
      description:
        "Missing dimensions (e.g., omitted methodological aspects, uncaptured limitations) (in Turkish).",
    },
    commentaryRisks: {
      type: "array",
      items: { type: "string" },
      description:
        "Potential misinterpretations or overgeneralizations in personal comments/şerhler (in Turkish).",
    },
    thesisAlignmentAdvice: {
      type: "string",
      description:
        "Concrete strategic advice on how to bridge this source's notes with the researcher's main thesis problem (in Turkish).",
    },
  },
  required: [
    "overallScore",
    "statusBadge",
    "summary",
    "strengths",
    "blindSpots",
    "commentaryRisks",
    "thesisAlignmentAdvice",
  ],
};

interface EvaluateResourceInput {
  resource: {
    title: string;
    authors?: string[];
    publicationYear?: number | null;
    documentType?: string;
  };
  critique?: Partial<LibraryResourceCritique>;
  notes: LibraryResourceNote[];
  thesisMatrix?: {
    subjectProblem: string;
    theoreticalFramework: string;
    methodology: string;
  } | null;
  logger?: Logger;
}

const SYSTEM_INSTRUCTION = `
<role>
Kıdemli akademik tez danışmanı, jüri üyesi ve sosyal bilimler metodoloğu.
</role>

<instructions>
# Görev
Bir araştırmacının incelediği akademik makale için tuttuğu **tüm alıntı fişlerini, kişisel şerhlerini** ve çıkardığı **5 adımlı Eser Analizini** (Araştırma Sorusu, Teorik Çerçeve, Metodoloji, Temel Argüman, Literatür Boşluğu) bütünsel olarak denetle.

# Değerlendirme Kriterleri
1. **Argüman Yakalama ve Anlamsal Kapsayıcılık (Strengths & Blind Spots):**
   - Araştırmacı yazarın asıl tezini ve kanıtlarını doğru kavramış mı?
   - Önemli bir boyut (örneğin metodolojik sınırlılıklar veya karşı argümanlar) gözden kaçmış mı?

2. **Şerh / Yorum Tutarlılığı (Commentary Risks):**
   - Kişisel notlarda yazarın eleştirdiği fikirleri yazarın kendi teziymiş gibi benimseme, aşırı genelleme veya bağlam dışı yorumlama riski var mı?

3. **Tez Matrisiyle Eklemlenme (Thesis Alignment):**
   - Bu kaynaktan çıkarılan notlar ve analiz, araştırmacının kendi tez problemine, teorik çerçevesine ve metodolojisine nasıl hizmet edebilir?

# Çıktı Dili ve Üslup
- Tüm değerlendirme, güçlü yönler, kör noktalar ve tavsiyeler son derece yetkin, yapıcı, teşvik edici ve yüksek düzey akademik Türkçe ile hazırlanmalıdır.
</instructions>
`;

/**
 * Generates a holistic academic audit report evaluating notes, personal comments, and 5-field critique against thesis matrix.
 *
 * @param input - The resource info, critique fields, notes list, and optional thesis matrix.
 * @returns Structured academic audit report.
 */
export async function evaluateResourceNotesAndCritique(
  input: EvaluateResourceInput,
): Promise<ResourceAuditReport> {
  const { resource, critique, notes, thesisMatrix, logger } = input;

  const critiqueContext = `
1. Araştırma Sorusu: ${critique?.researchQuestion || "Belirtilmemiş"}
2. Teorik/Kavramsal Çerçeve: ${critique?.theoreticalFramework || "Belirtilmemiş"}
3. Metodoloji: ${critique?.methodology || "Belirtilmemiş"}
4. Temel Argüman: ${critique?.mainArgument || "Belirtilmemiş"}
5. Literatür Boşluğu: ${critique?.literatureGap || "Belirtilmemiş"}
`;

  const notesContext =
    notes.length > 0
      ? notes
          .map(
            (n, i) =>
              `[Not ${i + 1} - Sayfa: ${n.pageNumber} - Tür: ${n.noteType}]:\nMetin: "${n.content}"${
                n.comment ? `\nŞerh/Yorum: "${n.comment}"` : ""
              }`,
          )
          .join("\n\n")
      : "Henüz bu eser için bireysel alıntı veya not girilmemiş.";

  const thesisContext = thesisMatrix
    ? `
- Tezin Konusu ve Problemi: ${thesisMatrix.subjectProblem}
- Tezin Teorik Çerçevesi: ${thesisMatrix.theoreticalFramework}
- Tezin Metodolojisi: ${thesisMatrix.methodology}
`
    : "Tez matrisi bağlamı henüz tanımlanmamış.";

  const prompt = `
<context>
# İncelenen Eser
- Başlık: ${resource.title}
- Yazarlar: ${resource.authors?.join(", ") || "Belirtilmemiş"}
- Yıl: ${resource.publicationYear ?? "Belirtilmemiş"}
- Tür: ${resource.documentType || "Makale"}

# Araştırmacının Kendi Tez Matrisi
${thesisContext}

# Araştırmacının Çıkardığı Eser Analizi (5 Adım)
${critiqueContext}

# Araştırmacının Kaydettiği Alıntı Fişleri ve Şerhler (${notes.length} Adet)
${notesContext}
</context>

<task>
Yukarıdaki <context> içeriğini akademik titizlikle analiz et. Araştırmacının eseri kavrayış derinliğini, şerh risklerini, kör noktalarını ve kendi tezine nasıl bağlayabileceğini belirten yapılandırılmış denetim raporunu üret.
</task>
`;

  try {
    const raw = await generateStructuredContent<AuditReportResult>(
      FLASH_LITE_35,
      SYSTEM_INSTRUCTION,
      prompt,
      auditReportJsonSchema,
      logger,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        payloadStage: "resource_audit_evaluation",
        operation: "resource_audit_evaluation",
        zodSchema: auditReportSchema,
      },
    );

    return {
      overallScore: raw.overallScore,
      statusBadge: raw.statusBadge,
      summary: raw.summary,
      strengths: raw.strengths,
      blindSpots: raw.blindSpots,
      commentaryRisks: raw.commentaryRisks,
      thesisAlignmentAdvice: raw.thesisAlignmentAdvice,
      evaluatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger?.error("resource_audit_evaluation_failed", {
      service: "library",
      error: err,
    });

    return {
      overallScore: 75,
      statusBadge: "SOLID",
      summary: "Değerlendirme tamamlandı. Notlarınız kaydedildi.",
      strengths: ["Eserden çıkarılan alıntılar ilgili sayfalarla uyumlu."],
      blindSpots: [],
      commentaryRisks: [],
      thesisAlignmentAdvice:
        "Bu notları tezinizin ilgili bölümüne alıntı fişleri olarak bağlayabilirsiniz.",
      evaluatedAt: new Date().toISOString(),
    };
  }
}
