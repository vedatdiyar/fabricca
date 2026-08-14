import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";
import type { PositioningMatrixInput } from "@/features/positioning/validation";

/**
 * Builds the standardized PromptPayload for positioning query generation.
 *
 * @param input - The validated positioning matrix input.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPositioningQueriesPromptPayload(
  input: PositioningMatrixInput,
): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "Akademik tez veritabanlarında vektör/semantik arama yapmak için yüksek hassasiyetli, doğal dil arama sorguları üreten uzman bir Bilgi Erişim (Information Retrieval) Uzmanısınız.",

    primaryTask:
      "Sana sunulan Tez Konumlandırma Matrisinin Araştırma Problemi bileşeni (aktörleri, kurumları ve ampirik bağlamı kapsayan entegre alan) için Türkçe ve İngilizce olmak üzere her dil için 4 farklı alternatif içeren toplam 8 kısa arama sorgusu üretmektir.",

    rulesAndConstraints: `1. **Sorgu Katmanları ve Çeşitlilik (Her dil için 4 farklı seviye):**
   - **_alt1 (Spesifik Mekanizma):** Araştırma probleminin özüne odaklanan 2-4 kelimelik hassas akademik sorgu.
   - **_alt2 (Aktör / Kurum / Bağlam):** Araştırmadaki ana aktörleri, kurumları veya tarihsel/coğrafi bağlamı hedefleyen 2-4 kelimelik sorgu.
   - **_alt3 (Geniş Tematik Kapsam - Yüksek Yakalama / High-Recall):** Akademik tez veritabanlarında geniş arama başarımı sağlayan 1-3 kelimelik kapsayıcı ana konu başlığı (aşırı daraltılmamış, tez başlıklarında kesin geçecek anahtar kavramlar).
   - **_alt4 (Kavramsal Çatı / Eşanlamlı):** Disiplinde yaygın kullanılan geniş kuramsal veya kavramsal akademik eşanlamlılar (2-4 kelime).
2. **Sorgu Uyumu:** Sorgular semantik vektör arama uyumlu, yalnızca boşlukla ayrılmış düz akademik Türkçe ve İngilizce kelimelerden oluşmalı; özel karakter veya mantıksal operatör içermemelidir.
3. **Genel Geçerlilik:** Her disiplin (sosyoloji, hukuk, tıp, mühendislik, siyaset bilimi vb.) için veritabanındaki hem dar hem geniş başlıkları kapsayacak esneklikte üretilmelidir.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir. Her dil için `_alt1`, `_alt2`, `_alt3`, `_alt4` olmak üzere dört ayrı sorgu üretilir.",

    examples: `## Girdi
- **subjectProblem:** Kente göç eden ailelerin üçüncü kuşak bireylerinin sosyal entegrasyon sürecinde kültürel uyum ve kimlik aidiyet pratikleri

### Beklenen Çıktı
\`\`\`json
{
  "subjectTr_alt1": "göç kimlik aidiyet pratikleri",
  "subjectTr_alt2": "göçmen aile üçüncü kuşak",
  "subjectTr_alt3": "göç entegrasyon",
  "subjectTr_alt4": "sosyal uyum kültürel aidiyet",
  "subjectEn_alt1": "migration identity belonging practices",
  "subjectEn_alt2": "immigrant family third generation",
  "subjectEn_alt3": "migration integration",
  "subjectEn_alt4": "social adaptation cultural identity"
}
\`\`\``,

    inputContext: `Aşağıdaki matris alanı için kademeli (spesifikten geniş tematik kapsama) Türkçe ve İngilizce semantik tez arama sorguları üret (her dil için 4 alternatif, toplam 8 sorgu):

Araştırma Problemi ve Odağı — aktörler, kurumlar ve ampirik bağlam dahil (subjectTr_alt1/2/3/4 / subjectEn_alt1/2/3/4): ${input.subjectProblem}`,
  });
}
