import { z } from "zod";
import type { JsonSchema, JsonSchemaProperty } from "../services/gemini";
import type { ThesisMatrix } from "../types";

const subBoxSchema = z.object({
  title: z.string(),
  description: z.string(),
  semanticQuery: z
    .string()
    .describe(
      "primaryMaterial için boş string olmalıdır. Diğerleri için kadran türüne göre güçlü bir şekilde temellendirilmiş veya tamamen teorik, resmî İngilizce akademik metin olmalıdır.",
    ),
  foundationalQueries: z
    .array(
      z.object({
        author: z.string(),
        title: z.string(),
        publicationYear: z.number(),
      }),
    )
    .optional()
    .default([]),
});

const quadrantSchema = z.object({
  title: z.string(),
  description: z.string(),
  concepts: z
    .array(z.string())
    .max(4)
    .describe("En fazla 4 kavram izin verilir. Asla 5 adet üretmeyin."),
  subBoxes: z
    .array(subBoxSchema)
    .min(1)
    .describe(
      "Homojen hedefler için dinamik olarak 1, heterojen hedefler için N>=2.",
    ),
});

export const thesisBoxGenerationSchema = z.object({
  analysis: z.object({
    detected_heterogeneity: z.boolean(),
    allocation_rationale: z
      .string()
      .describe(
        "Tüm kadranlardaki alt kutu sayıları tercihi için Türkçe akademik gerekçe.",
      ),
  }),
  conceptual: quadrantSchema,
  problematization: quadrantSchema,
  context: quadrantSchema,
  dataProtocol: quadrantSchema,
  primaryMaterial: quadrantSchema,
});

export type RawNestedResponse = z.infer<typeof thesisBoxGenerationSchema>;

function buildQuadrantJsonSchema(): JsonSchemaProperty {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      concepts: {
        type: "array",
        items: { type: "string" },
        maxItems: 4,
      },
      subBoxes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            semanticQuery: { type: "string" },
            foundationalQueries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  author: { type: "string" },
                  title: { type: "string" },
                  publicationYear: { type: "number" },
                },
              },
            },
          },
          required: ["title", "description", "semanticQuery"],
        },
      },
    },
    required: ["title", "description", "concepts", "subBoxes"],
  };
}

export const thesisBoxGenerationJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    analysis: {
      type: "object",
      properties: {
        detected_heterogeneity: { type: "boolean" },
        allocation_rationale: { type: "string" },
      },
      required: ["detected_heterogeneity", "allocation_rationale"],
    },
    conceptual: buildQuadrantJsonSchema(),
    problematization: buildQuadrantJsonSchema(),
    context: buildQuadrantJsonSchema(),
    dataProtocol: buildQuadrantJsonSchema(),
    primaryMaterial: buildQuadrantJsonSchema(),
  },
  required: [
    "analysis",
    "conceptual",
    "problematization",
    "primaryMaterial",
    "context",
    "dataProtocol",
  ],
};

export function buildThesisBoxGenerationSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Girdi olarak verilen akademik tez matrisini analiz ederek 5 kadranlı epistemolojik konu kutusu (box) ve alt kutu (sub-box) yapısını oluşturan uzman bir akademik yapılandırma asistanısınız.

# Kurallar ve Sınırlamalar
- Dil Kuralları: title, description ve concepts alanları akademik Türkçe; semanticQuery alanı tamamen (%100) İngilizce akademik metin olmalıdır.
- Alt Kutu İzolasyon İlkesi: Her bir alt kutu sorgusu diğer tüm alt kutulardan tamamen bağımsızdır. Alt kutu A için yazılan sorgu; B, C, D veya E alt kutularının kavramlarına, aktörlerine veya olaylarına asla değinmemelidir.
- Başlık Kuralları: Başlıklar 5-7 kelimeyi geçmeyen somut ifadeler olmalıdır. "Analiz", "Çalışma", "Ampirik", "Kutu", "İnceleme" gibi jenerik kelimeler kullanmayın.
- Sorgu Sınırlamaları: semanticQuery maksimum 1000 karakter olmalıdır. "The research explores", "This study analyzes" gibi jenerik giriş kalıpları kullanmayın.

# Kadran Özel Kuralları
1. CONCEPTUAL (Kavramsal): Yalnızca teorik kavramlar içerir. Ülke, kişi, parti, olay veya dönem gibi ampirik özel isimler yer alamaz.
2. PROBLEMATIZATION (Problem Söylemi): Ampirik aktörler ve aralarındaki gerilimi konu alır. Özel ad kullanmayın; coğrafi olarak konumlandırılmış İngilizce akademik kategori isimleri kullanın (ör. "Kurdish political movement in Turkey").
3. CONTEXT (Tarihsel/Mekânsal Bağlam): Tarihsel ve coğrafi kırılmaları kapsar. İlk 5 kelime içinde dönemi ve coğrafyayı adlandırın.
4. DATA_PROTOCOL (Veri/Yöntem Protokolü): Araştırma yöntemini ve kurucu metodolog isimlerini kapsar. Teze özel aktör isimleri içermez.
5. PRIMARY_MATERIAL (Birincil Kaynak): semanticQuery boş string ("") olmalıdır. Farklı kaynak türlerini ayrı alt kutulara bölün.

# Örnekler
## Örnek 1
### Girdi
Z Olayı sırasında C Ülkesindeki X Aktörü ile Y Aktörü arasındaki etkileşim; W Kuramı; M Yöntemi (Yazar P). Kaynaklar: X belgeleri + Y arşivleri.

### Çıktı
- CONCEPTUAL: 1 alt kutu → W Kuramı kavramları.
- PROBLEMATIZATION: 2 alt kutu → C Ülkesindeki X Aktörü kutbu, Y Aktörü kutbu.
- CONTEXT: 1 alt kutu → C Ülkesindeki Z Olayı.
- DATA_PROTOCOL: 1 alt kutu → M Yöntemi (Yazar P).
- PRIMARY_MATERIAL: 2 alt kutu → X Resmi Belgeleri + Y Bağımsız Arşivleri.`;
}

export function buildThesisBoxGenerationPrompt(params: ThesisMatrix): string {
  const matrixJson = JSON.stringify(params, null, 2);
  return `# Girdi Bağlamı
${matrixJson}

# Birincil Görev
Yukarıda sağlanan tez matrisini inceleyin. Belirtilen kadran ve alt kutu kurallarına harfiyen uyarak 5 kadranlı epistemolojik kutu yapısını JSON formatında üretin. Alt kutular arasında kavram veya aktör çakışması olmamasına özen gösterin.`;
}
