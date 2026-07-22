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
// 2. SİSTEM TALİMATI (%100 TÜRKÇE - EVRENSEL GENELLEŞTİRME İLKESİNE UYGUN)
// ============================================================================
/**
 * Builds the system instruction for Gemini 3.5 Flash-Lite retrieval parameters generation
 * (Tezara Meilisearch queries & Cohere semantic target).
 * Follows LLM_INTEGRATION.md standards (XML tags, positive boundaries, Generality Principle).
 *
 * @returns System instruction string.
 */
export function buildRetrievalParamsSystemInstruction(): string {
  return `<constraints>
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanmalısınız.
- Bilgi kesim tarihiniz Ocak 2025'tir. Şu anki yıl 2026'dır.

- ARAMA PORTFÖYÜ VE ÇEŞİTLİLİK KURALI (QUERY DIVERSITY STRATEGY):
  Meilisearch leksik arama motorundan en geniş potansiyel tez havuzunu (High Recall) toplayabilmek için üretilecek 4 Türkçe ve 4 İngilizce sorgu TEK BİR KARMAŞIK TİPTE OLMAMALI, zorunlu olarak aşağıdaki 3 FARKLI ARAMA AÇISINA (ANGLE) dağıtılmalıdır:

  1. AÇI 1 - ODAK NESNE / AKTÖR SORGUSU (1 adet, 2-3 kelime):
     Doğrudan ana inceleme nesnesini, sistemi veya aktörü bağımsız aratan odaklı sorgu. (Örn: "SubjectX İncelemeSaha")
  2. AÇI 2 - TEMATİK PROBLEM / KAVRAM SORGUSU (1 adet, 2-3 kelime):
     Araştırmanın yapıldığı ana problemi, değişkeni veya olguyu bağımsız aratan konusal sorgu. (Örn: "ProblemY TematikAnaliz")
  3. AÇI 3 - KESİŞİM VE METODOLOJİ SORGULARI (2 adet, 3-4 kelime):
     Nesne + Problem veya Model + Yöntem kesişimini hedefleyen daha dar arama sorguları. (Örn: "SubjectX ProblemY Etkileşimi", "MethodZ çerçevesinde SubjectX")

- KELİME VE UZUNLUK KURALLARI:
  - Tek kelimelik aşırı genel arama terimleri (Örn: 'Ekonomi', 'Tarih', 'Yazılım') kesinlikle YASAKTIR. Her sorgu en az 2 spesifik akademik kelimeden oluşmalıdır.
  - Sorgular en fazla 4 kelime içerebilir.

- SAYI KISITI: turkishQueries listesi tam olarak 4 eleman (1 Nesne + 1 Konu + 2 Kesişim), englishQueries listesi tam olarak 4 eleman (1 Nesne + 1 Konu + 2 Kesişim) içermelidir. Toplamda TAM OLARAK 8 SORGU üretilecektir.

- SEMANTIC TARGET KURALI (cohereSemanticTarget): Cohere Rerank modeli için matristen 20-30 kelimelik TEK BİR ANLAMSAL ÖZET CÜMLESİ çıkarınız. Metin araştırmanın ana odağını, temel nesnelerini/değişkenlerini ve uygulanan kavramsal/metodolojik çerçeveyi içermelidir.

- STRİKT TARİH KISITI YASAĞI (NO-DATE RULE): cohereSemanticTarget metnine KESİNLİKLE tarih aralığı veya kronoloji kısıtlaması (Örn: '1990'larda', '1991-1999 dönemi') EKLEMEYİNİZ. Cohere modelinin tarihsel arka plan referans çalışmalarını puan olarak cezalandırmasını engellemek için tarih kısıtı tamamen çıkarılmalı, sadece temel nesne/kavram grupları ve ilişkisel konu odağı tutulmalıdır.

- TÜRKÇE KARAKTER KURALI: Türkçe sorgularda Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, â) KESİNLİKLE aynen koruyunuz.
- YÖNTEMSEL GÜRÜLTÜ FİLTRESİ: Tek başına 'söylem analizi', 'metodoloji', 'kuram' gibi jenerik akademik kavramlar tekil sorgu olarak yer alamaz.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca Arama & Yeniden Sıralama (Retrieval & Rerank) katmanı parametrelerini üretir.
- ÇIKTI FORMATI: Yanıtınız, sağlanan retrievalParamsSchema ile %100 uyumlu, parse edilebilir bir ham JSON objesi olmalıdır.
</constraints>

<examples>
  <example>
    <input>
{
  "researchCore": "SubjectX olgusunun ProblemY üzerindeki etkilerinin MethodZ çerçevesinde incelenmesi",
  "mainClaim": "SubjectX'in dönüşümü ProblemY ile kurulan kavramsal dinamiklerin bir sonucudur."
}
    </input>
    <output>
{
  "turkishQueries": [
    "SubjectX Odakİnceleme",
    "ProblemY TematikAnaliz",
    "SubjectX ProblemY Etkileşimi",
    "MethodZ çerçevesinde SubjectX"
  ],
  "englishQueries": [
    "SubjectX FocusAnalysis",
    "ProblemY ThematicDomain",
    "SubjectX ProblemY Interaction",
    "MethodZ framework SubjectX"
  ],
  "cohereSemanticTarget": "SubjectX olgusunun MethodZ yöntemi ve ProblemY parametreleri ışığında incelenmesi, kavramsal evrimi ve anlamsal ilişki ağının analizi."
}
  </example>
</examples>

<task>
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan tez matrisini analiz ederek Meilisearch indeksinden yüksek duyarlılıkla (high recall) potansiyel tez kümesini çekmek üzere 3 FARKLI AÇIDA (1 Nesne, 1 Konu, 2 Kesişim) ZORUNLU OLARAK 4 adet Türkçe ve 4 adet İngilizce (toplam 8 adet) akademik arama sorgusu ve Cohere Rerank için tarih kısıtından arındırılmış 1 cümlelik cohereSemanticTarget metni üretmektir.
</task>`;
}

export function buildRetrievalParamsPrompt(
  params: Pick<ThesisMatrix, "researchCore" | "targetActors" | "mainClaim">,
): string {
  return `<context>
{
  "researchCore": "${params.researchCore.replace(/"/g, '\\"')}",
  "targetActors": "${params.targetActors.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}"
}
</context>

<task>
Sistem talimatındaki kurallara harfiyen uyarak:
1. Arama sorgularını ZORUNLU OLARAK 3 farklı arama açısına (1 Nesne/Aktör odaklı 2-3 kelime, 1 Tematik Problem odaklı 2-3 kelime, 2 Kesişim/Yöntem odaklı 3-4 kelime) dağıtınız.
2. Tam olarak 4 Türkçe ve 4 İngilizce (toplam 8) arama sorgusu üretiniz.
3. cohereSemanticTarget metninde KESİNLİKLE tarih aralığı/kronoloji sınırlaması kullanmayınız, araştırmanın ana odağını, nesnelerini ve kavramsal çerçevesini kapsayacak 1 cümlelik sıkıştırılmış özet çıkarınız.
Cevaplamadan önce çok derin düşün.
</task>`;
}
