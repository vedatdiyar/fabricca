import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

/**
 * Interface representing the structured response from Gemini for Onboarding Step 1 Retrieval Parameters
 * (Tezara Meilisearch search queries + Cohere Rerank semantic target).
 */
export interface RetrievalParamsResponse {
  turkishQueries: string[];
  englishQueries: string[];
  cohereSemanticTarget: string;
}

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE, VANILLA JSON SCHEMA)
// ============================================================================
export const retrievalParamsSchema: JsonSchema = {
  type: "object",
  properties: {
    turkishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Meilisearch indeksinde yüksek duyarlıklı (high recall) tez havuzu oluşturmak için 3 farklı açıda (Nesne odaklı 2-3 kelime, Tematik Problem odaklı 2-3 kelime, Kesişim/Yöntem odaklı 3-4 kelime) üretilmiş 4 adet Türkçe akademik arama sorgusu.",
    },
    englishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Meilisearch indeksinde yüksek duyarlıklı (high recall) tez havuzu oluşturmak için 3 farklı açıda (Nesne odaklı 2-3 kelime, Tematik Problem odaklı 2-3 kelime, Kesişim/Yöntem odaklı 3-4 kelime) üretilmiş 4 adet İngilizce akademik arama sorgusu.",
    },
    cohereSemanticTarget: {
      type: "string",
      description:
        "Cohere Rerank modeli için tarih kısıtlarından arındırılmış, araştırmanın ana odağını, temel değişkenlerini ve kavramsal/metodolojik çerçevesini kapsayan 1 cümlelik (20-30 kelime) sıkıştırılmış anlamsal hedef metni.",
    },
  },
  required: ["turkishQueries", "englishQueries", "cohereSemanticTarget"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
/**
 * Builds the system instruction for Gemini 3.5 Flash-Lite retrieval parameters generation
 * (Tezara Meilisearch queries & Cohere semantic target).
 * Follows LLM_INTEGRATION.md standards.
 *
 * @returns System instruction string.
 */
export function buildRetrievalParamsSystemInstruction(): string {
  return `# Rol ve Uzmanlık
Tez veritabanı arama motoru (Meilisearch) ve anlamsal yeniden sıralama modeli (Cohere Rerank) için yüksek duyarlıklı (high recall) arama parametreleri üreten akademisyen bilgi erişim uzmanısınız.

# Arama Portföyü Stratejisi
Meilisearch leksik arama motorundan en geniş potansiyel tez havuzunu toplayabilmek için üretilecek 4 Türkçe ve 4 İngilizce sorgu şu 3 farklı açıya dağıtılmalıdır:
1. Odak Nesne / Aktör Sorgusu (1 adet, 2-3 kelime): Ana inceleme nesnesini veya aktörü bağımsız aratan sorgu.
2. Tematik Problem / Kavram Sorgusu (1 adet, 2-3 kelime): Araştırmanın ana problemini veya olgusunu bağımsız aratan sorgu.
3. Kesişim ve Metodoloji Sorguları (2 adet, 3-4 kelime): Nesne + Problem veya Yöntem kesişimini hedefleyen dar sorgular.

# Kurallar ve Sınırlamalar
- Kelime Sayısı ve İzolasyon: Sorgular en az 2, en fazla 4 kelimeden oluşmalıdır.
- Sorgu Sayısı: Toplamda tam olarak 4 Türkçe ve 4 İngilizce (toplam 8 adet) arama sorgusu üretilmelidir.
- Tarih Kısıtları: cohereSemanticTarget metni tarih aralığı veya kronolojiden arındırılmış olmalıdır. 20-30 kelimelik tek bir sıkıştırılmış anlamsal hedef cümlesi oluşturun.
- Karakter Yapısı: Türkçe sorgularda Türkçe karakterler tam ve eksiksiz korunmalıdır.

# Örnekler

## Örnek 1 (Disiplin: Siyaset Bilimi / Kamu Yönetimi)
### Girdi
\`\`\`json
{
  "researchCore": "Türkiye'de e-devlet dönüşümünün kamu bürokrasisinde şeffaflık ve hesap verebilirlik üzerindeki etkilerini inceler.",
  "targetActors": "Kamu kurumları ve T.C. Cumhurbaşkanlığı Dijital Dönüşüm Ofisi.",
  "mainClaim": "E-devlet uygulamaları şeffaflığı artırırken bürokratik vesayet dinamiklerini dijital mecraya taşımıştır."
}
\`\`\`

### Çıktı
\`\`\`json
{
  "turkishQueries": [
    "E-Devlet Kamu Bürokrasisi",
    "Kamu Yönetiminde Şeffaflık",
    "Dijital Dönüşüm Hesap Verebilirlik",
    "E-Devlet Bürokratik Dönüşüm Analizi"
  ],
  "englishQueries": [
    "E-Government Public Bureaucracy",
    "Public Administration Transparency",
    "Digital Transformation Accountability",
    "E-Government Bureaucratic Transformation Analysis"
  ],
  "cohereSemanticTarget": "Türkiye kamu bürokrasisinde e-devlet dönüşümünün şeffaflık, hesap verebilirlik ve dijitalleşme parametreleri ışığında nitel ve kurumsal analizi."
}
\`\`\`

## Örnek 2 (Disiplin: Biyomedikal Mühendislik / Tıp)
### Girdi
\`\`\`json
{
  "researchCore": "Tip 2 diyabet hastalarının biyosensör sürekli glukoz izleme verilerinden yapay zeka tabanlı hipoglisemi erken uyarı modeli geliştirilmesi.",
  "targetActors": "Tip 2 diyabet hastaları ve klinik tedavi ekipleri.",
  "mainClaim": "Derin yinelemeli sinir ağları (LSTM) hipoglisemi ataklarını 45 dakika önceden yüksek hassasiyetle tahmin eder."
}
\`\`\`

### Çıktı
\`\`\`json
{
  "turkishQueries": [
    "Sürekli Glukoz İzleme",
    "Tip 2 Diyabet Hipoglisemi",
    "Biyosensör Glukoz Erken Uyarı",
    "LSTM Diyabet Hipoglisemi Tahmini"
  ],
  "englishQueries": [
    "Continuous Glucose Monitoring",
    "Type 2 Diabetes Hypoglycemia",
    "Biosensor Glucose Early Warning",
    "LSTM Diabetes Hypoglycemia Prediction"
  ],
  "cohereSemanticTarget": "Tip 2 diyabet hastalarında biyosensör sürekli glukoz izleme verilerinden LSTM derin öğrenme mimarisi ile hipoglisemi erken uyarı modeli geliştirilmesi."
}
\`\`\``;
}

export function buildRetrievalParamsPrompt(
  params: Pick<ThesisMatrix, "researchCore" | "targetActors" | "mainClaim">,
): string {
  return `# Girdi Bağlamı
\`\`\`json
{
  "researchCore": "${params.researchCore.replace(/"/g, '\\"')}",
  "targetActors": "${params.targetActors.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}"
}
\`\`\`

# Birincil Görev
Sistem kurallarına uyarak:
1. 3 farklı arama açısına (1 Nesne, 1 Konu, 2 Kesişim) sahip 4 Türkçe ve 4 İngilizce (toplam 8) arama sorgusu üretin.
2. Cohere Rerank için tarih kısıtından arındırılmış 1 cümlelik cohereSemanticTarget metni oluşturun.`;
}
