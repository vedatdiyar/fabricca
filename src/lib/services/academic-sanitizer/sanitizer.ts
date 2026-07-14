import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { generateStructuredContent } from "../gemini";
import type { JsonSchema } from "../gemini";
import { Logger } from "../../logger";
import { GEMINI_MODEL, GEMINI_TEMPERATURE, GEMINI_SEED } from "../../constants";

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

const SYSTEM_INSTRUCTION = `<constraints>
- Her bir baslik icin: baglaclar (of, and, the, for, in, to, with, a, an, at, by, from, on, via, versus, vs, nor, or, so, than, up, upon, within, without) haric her kelimenin ilk harfini buyuk yap. Baglaclar tamamen kucuk kalir.
- Baslikta gecen su bilinen kısaltmalari oldugu gibi KORU, harf buyukluklerini degistirme: DOI, LLM, YOK, IMF, NATO, UNESCO, WHO, EU, UN, USA, UK, ABD, AB, TBMM, TUBITAK, TKI.
- Latince bilimsel terimleri (Homo sapiens, Homo subprimicus, in vitro, in vivo, et al. vb.) orijinal italik/yazi stillerinden bagimsiz olarak bilimsel yazim standartlarina gore duzelt: cins adi buyuk, tur adi kucuk.
- Yazar isimlerini tamamen BUYUK veya tamamen kucuk harften Proper Case'e cevir.
- Ingilizce karakter setine kurban gitmis Turkce isimleri modelin dogru Turkce yazimina cevir.
- Başlıkların sonundaki asterisk (*), dipnot işaretleri veya gereksiz özel karakterleri temizle.
- Ciktiya hicbir aciklama, not veya ek metin EKLEME. Yalnizca JSON semasina uygun nesneyi dondur.
</constraints>

<examples>
  <example>
    <input>[{"title": "the role of nato in post-cold war era (vol i)", "author": "prof. dr. ahmet yilmaz"}]</input>
    <output>[{"title": "The Role of NATO in Post-Cold War Era (Vol I)", "author": "Prof. Dr. Ahmet Yilmaz"}]</output>
  </example>
  <example>
    <input>[{"title": "calisma adi ve baglami", "author": "ALI ISIK"}]</input>
    <output>[{"title": "Calisma Adi ve Baglami", "author": "Ali Isik"}]</output>
  </example>
  <example>
    <input>[{"title": "an essay on author x's literature", "author": "jOHN mICHAEL doe"}]</input>
    <output>[{"title": "An Essay on Author X's Literature", "author": "John Michael Doe"}]</output>
  </example>
  <example>
    <input>[{"title": "An Insider's Critique of the Social Movement Framing Perspective*", "author": "Robert D. Benford"}]</input>
    <output>[{"title": "An Insider's Critique of the Social Movement Framing Perspective", "author": "Robert D. Benford"}]</output>
  </example>
</examples>

<task>
Yukaridaki <constraints> kurallarina harfiyen uyarak sana verilen girdi array'indeki her bir nesnenin title ve author alanlarini standardize et. Sonucu JSON semasina uygun olarak dondur.
</task>`;

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
    GEMINI_MODEL,
    SYSTEM_INSTRUCTION,
    JSON.stringify(items),
    SANITIZE_RESPONSE_SCHEMA,
    logger,
    {
      zodSchema: sanitizeResponseSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      seed: GEMINI_SEED,
      temperature: GEMINI_TEMPERATURE,
    },
  );

  return result.items;
}
