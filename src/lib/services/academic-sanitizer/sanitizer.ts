import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { generateStructuredContent } from "../gemini";
import type { JsonSchema } from "../gemini";
import { Logger } from "../../logger";
import { FLASH_LITE_35, GEMINI_SEED } from "../../constants";

// ============================================================================
// Vanilla JSON Schema — LLM_INTEGRATION.md Rule 7
// ============================================================================

const SANITIZE_RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
        },
        required: ["title", "author"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const sanitizeResponseSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      author: z.string(),
    }),
  ),
});

type SanitizeResponse = z.infer<typeof sanitizeResponseSchema>;

// ============================================================================
// System instruction — LLM_INTEGRATION.md Rule 4 (XML encapsulation)
// Rule 5 (strictly grounded) is deliberately omitted because the task
// requires the model to use its world knowledge for Turkish character repair.
// Rule 8 (generality) — examples use abstract placeholders.
// ============================================================================

const SYSTEM_INSTRUCTION = `# Rol ve Uzmanlık
Akademik yayın başlıklarını ve yazar isimlerini APA başlık standartlarına ve Türkçe imla kurallarına göre standardize eden veri düzenleme uzmanısınız.

# Kurallar ve Sınırlamalar
- Başlık Biçimlendirmesi (Title Case): Bağlaçlar (of, and, the, for, in, to, with, a, an, at, by, from, on, via, versus, vs, nor, or, so, than, up, upon, within, without) hariç her kelimenin ilk harfini büyük yapın.
- Kısaltmaları Koruma: Bilinen kısaltmaları olduğu gibi koruyun: DOI, LLM, YOK, IMF, NATO, UNESCO, WHO, EU, UN, USA, UK, ABD, AB, TBMM, TUBITAK, TKI.
- Latince Terimler: Latince bilimsel terimleri (Homo sapiens, in vitro, in vivo, et al.) standart biyolojik cins/tür yazımına göre düzeltin.
- Yazar İsimleri: Yazar isimlerini Proper Case formatına çevirin (ör. "AHMET YILMAZ" → "Ahmet Yilmaz").
- Türkçe Karakter Düzeltme: İngilizce karakter setine düşmüş Türkçe isim ve başlıkları doğru Türkçe karakterlerle düzeltin.
- Karakter Temizliği: Başlık sonlarındaki dipnot veya asterisk (*) işaretlerini temizleyin.

# Örnekler
## Örnek 1
### Girdi
\`\`\`json
[{"title": "the role of nato in post-cold war era (vol i)", "author": "prof. dr. ahmet yilmaz"}]
\`\`\`

### Çıktı
\`\`\`json
[{"title": "The Role of NATO in Post-Cold War Era (Vol I)", "author": "Prof. Dr. Ahmet Yilmaz"}]
\`\`\`

# Birincil Görev
Girdi dizisindeki (array) her bir nesnenin title ve author alanlarını yukarıdaki kurallara göre standardize edip JSON formatında döndürün.`;

type AcademicItem = { title: string; author: string };

/**
 * Sanitize an array of academic items (title + author) in a single
 * LLM call. Performs APA Title Case normalisation, author name
 * proper-casing, acronym preservation, and Turkish character repair.
 *
 * @param items - Array of academic items with raw title and author fields
 * @param logger - Optional Logger instance for structured LLM call logging
 * @returns Array with sanitised title and author fields in the same order
 */
export async function sanitizeAcademicDataBulk(
  items: AcademicItem[],
  logger?: Logger,
): Promise<AcademicItem[]> {
  if (items.length === 0) return items;

  const result = await generateStructuredContent<SanitizeResponse>(
    FLASH_LITE_35,
    SYSTEM_INSTRUCTION,
    JSON.stringify(items),
    SANITIZE_RESPONSE_SCHEMA,
    logger,
    {
      zodSchema: sanitizeResponseSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      seed: GEMINI_SEED,
      payloadStage: "literature_bulk_sanitization",
      quiet: true,
    },
  );

  return result.items;
}
