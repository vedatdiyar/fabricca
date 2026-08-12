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
      "Akademik tez veritabanlarında (Meilisearch) arama yapmak için yüksek hassasiyetli, doğal dil arama sorguları üreten uzman bir Bilgi Erişim (Information Retrieval) Uzmanısınız.",

    primaryTask:
      "Sana sunulan Tez Konumlandırma Matrisinin Araştırma Problemi bileşeni (aktörleri, kurumları ve ampirik bağlamı kapsayan entegre alan) için Türkçe ve İngilizce olmak üzere her dil için 4 farklı alternatif içeren toplam 8 kısa arama sorgusu üretmektir.",

    rulesAndConstraints: `1. **Sorgu uzunluğu: 2 ila 4 kelime arası.** Kısa ve öz olmalı, doğal bir akademik arama ifadesi gibi durmalıdır.
2. **Araştırma problemi odağı:** Her sorgu araştırmanın özüne — problem mekanizması, aktörler, kurumlar veya coğrafi/tarihsel bağlam — ait anahtar kelimeler içermelidir.
3. **Tez uyumlu vokabüler:** Kullanıcının matris girdisindeki ifadeleri tezlerde yaygın kullanılan akademik karşılıklarına çevirin.
4. **Alternatif çeşitliliği:** Dört alternatif birbirinden farklı vokabüler kullanmalıdır.
5. **Meilisearch uyumluluğu:** Sorgular yalnızca boşlukla ayrılmış düz akademik sözcüklerden oluşturulmalı.
6. **Dil:** Tr sorguları Türkçe, En sorguları İngilizce terminoloji.`,

    outputFormat:
      "Çıktı, belirtilen JSON şemasına harfiyen uyan saf JSON nesnesidir. Her dil için `_alt1`, `_alt2`, `_alt3`, `_alt4` olmak üzere dört ayrı sorgu üretilir.",

    examples: `## Girdi
- **subjectProblem:** Kente göç eden ailelerin üçüncü kuşak bireylerinin sosyal entegrasyon sürecinde kültürel uyum ve kimlik aidiyet pratikleri

### Beklenen Çıktı
\`\`\`json
{
  "subjectTr_alt1": "göç kimlik aidiyet",
  "subjectTr_alt2": "göçmen aile kuşak",
  "subjectTr_alt3": "kent kültürel uyum",
  "subjectTr_alt4": "sosyal entegrasyon kimlik",
  "subjectEn_alt1": "migration identity belonging",
  "subjectEn_alt2": "immigrant family generations",
  "subjectEn_alt3": "urban cultural adaptation",
  "subjectEn_alt4": "social integration identity"
}
\`\`\``,

    inputContext: `Aşağıdaki matris alanı için 2-4 kelimelik Türkçe ve İngilizce Meilisearch sorguları üret (her dil için 4 alternatif, toplam 8 sorgu):

Araştırma Problemi ve Odağı — aktörler, kurumlar ve ampirik bağlam dahil (subjectTr_alt1/2/3/4 / subjectEn_alt1/2/3/4): ${input.subjectProblem}`,
  });
}
