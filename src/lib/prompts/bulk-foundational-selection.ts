import { z } from "zod";
import type { JsonSchema } from "../gemini";

// ============================================================================
// Zod runtime validation schema
// ============================================================================

export const BulkFoundationalSelectionResponseSchema = z.object({
  selections: z
    .array(
      z.object({
        parentIndex: z.number().int().min(0),
        selectedIndex: z.number().int().min(0),
        refinedTitle: z.string().min(1, "Eser başlığı boş olamaz"),
        refinedAuthor: z.string().min(1, "Yazar adı boş olamaz"),
      }),
    )
    .min(1, "En az bir seçim döndürülmelidir"),
});

// ============================================================================
// Gemini JSON schema (used as responseJsonSchema for structured output)
// ============================================================================

export const bulkFoundationalSelectionSchema: JsonSchema = {
  type: "object",
  properties: {
    selections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          parentIndex: {
            type: "integer",
            description:
              "0-based index of the parent box (matches the index provided in the input list).",
          },
          selectedIndex: {
            type: "integer",
            description:
              "0-based index of the chosen work from that parent's Exa results array.",
          },
          refinedTitle: {
            type: "string",
            description:
              "The official, clean academic title of the selected work exactly as it appears in the Exa results. Do NOT hallucinate or invent titles.",
          },
          refinedAuthor: {
            type: "string",
            description:
              "The primary theorist/author of the selected work. Clean editorial noise (eds., trans., etc.) and output the pure author name.",
          },
        },
        required: [
          "parentIndex",
          "selectedIndex",
          "refinedTitle",
          "refinedAuthor",
        ],
      },
      minItems: 1,
    },
  },
  required: ["selections"],
};

// ============================================================================
// System instruction — bulk foundational oracle
// ============================================================================

export function buildBulkFoundationalSystemInstruction(): string {
  return `# ROL
Sana sunulan 4 akademik kutu (parent box) için, her bir kutunun Exa arama sonuçları arasından en uygun kök klasiği (foundational work) seçen bir Akademik Editorsün.

# KAPSAM
Her bir parent kutu için ayrı ayrı Exa arama sonuçları sağlanmıştır. Senin görevin HER BİR kutu için:
1. O kutunun arama sonuçlarını incelemek
2. Tez matrisinin ana iddiası ve o kutunun bağlamıyla en güçlü şekilde örtüşen kurucu eseri seçmek
3. Seçilen eserin başlığını (refinedTitle) ve yazarını (refinedAuthor) belirtmek

# GÜVENLİK VE KALİTE KURALLARI
1. Başlığında veya metadata türünde 'Review of', 'Review' veya 'Book Review' geçen kayıtları KESİNLİKLE ELE. Sadece gerçek akademik kitap, monografi veya hakemli ana makaleleri seç.
2. KRİTİK: Seçtiğin eserin başlığını KESİNLİKLE DEĞİŞTİREMEZSİN. Arama sonuçlarında listelenen orijinal başlığı aynen kullan. Hayali, uydurma akademik başlıklar üretmek (halüsinasyon) kesinlikle yasaktır.
3. ANAKRONİZM YASAĞI: Kutunun tarihsel/kronolojik bağlamını analiz et. Modern dönem literatürüne veya alakasız çağdaş uygulamalara kayma.
4. LAZY LOOP YASAĞI: Her kutuda aynı genel tarih kitaplarına veya popüler "güvenli" eserlere sığınma. Her kutuyu kendi spesifik içeriğine göre değerlendir.

OUTPUT: Her parent kutu için bir seçim olacak şekilde "selections" dizisini doldur. Her bir seçim parentIndex (girdideki sıra), selectedIndex (o kutunun sonuçlarındaki sıra), refinedTitle ve refinedAuthor alanlarını içermelidir.`;
}

// ============================================================================
// User prompt builder
// ============================================================================

export interface ExaResultSlim {
  title: string;
  author: string | null;
  publicationYear: number | null;
  url: string | null;
  textSnippet: string | null;
}

export interface BulkFoundationalEntry {
  parentIndex: number;
  boxTitle: string;
  boxType: string;
  boxDescription: string;
  semanticQuery: string;
  researchScope: string;
  exaResults: ExaResultSlim[];
}

export function buildBulkFoundationalSelectionPrompt(
  thesisMatrix: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    methodology: string;
    researchScope: string;
    mainClaim: string;
  },
  entries: BulkFoundationalEntry[],
): string {
  const matrixSection = `[ANA TEZ MATRİSİ]
Başlık: ${thesisMatrix.studyTitle}
Araştırma Sorusu: ${thesisMatrix.researchQuestion}
Kuramsal Çerçeve: ${thesisMatrix.theoreticalFramework}
Metodoloji: ${thesisMatrix.methodology}
Araştırma Sınırları: ${thesisMatrix.researchScope}
Ana İddia: ${thesisMatrix.mainClaim}`;

  const boxesSection = entries
    .map((e) => {
      const results = e.exaResults
        .map(
          (r, ri) =>
            `  [${ri}] ${r.title} (${r.author}, ${r.publicationYear ?? "Tarih yok"})${r.textSnippet ? `\n       Snippet: ${r.textSnippet}` : ""}`,
        )
        .join("\n");

      return `--- Parent Box ${e.parentIndex} ---
Kutu Başlığı: ${e.boxTitle}
Kutu Tipi: ${e.boxType}
Açıklama: ${e.boxDescription}
Semantik Sorgu: ${e.semanticQuery}

Exa Arama Sonuçları:
${results || "  (sonuç yok)"}`;
    })
    .join("\n\n");

  return `${matrixSection}

${boxesSection}

Şimdi her parent kutu için en uygun kurucu eseri seç ve "selections" dizisini doldur. Her parentIndex için bir seçim yap.`;
}
