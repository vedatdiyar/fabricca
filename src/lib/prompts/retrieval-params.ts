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
        "YÖKTEZ veritabanında Türkçe dizinlenmiş tezleri bulmak için en uygun 4 adet ilişkisel (dyadic) 3-4 kelimelik Türkçe akademik arama sorgusu.",
    },
    englishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında İngilizce dizinlenmiş tezleri bulmak için en uygun 4 adet ilişkisel (dyadic) 3-4 kelimelik İngilizce akademik arama sorgusu.",
    },
    cohereSemanticTarget: {
      type: "string",
      description:
        "Cohere Rerank modeli için tarih kısıtlarından arındırılmış, sadece Ana Araştırma Odağı + İkili Aktör Etkileşimi içeren 1 cümlelik (20-30 kelime) sıkıştırılmış anlamsal hedef metni.",
    },
  },
  required: ["turkishQueries", "englishQueries", "cohereSemanticTarget"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE - EVRENSEL GENELLEŞTİRME İLKESİNE UYGUN)
// ============================================================================
/**
 * Builds the system instruction for Gemini 3.5 Flash-Lite retrieval parameters generation
 * (Tezara dyadic queries & Cohere semantic target).
 * Follows LLM_INTEGRATION.md standards (XML tags, positive boundaries, Generality Principle).
 *
 * @returns System instruction string.
 */
export function buildRetrievalParamsSystemInstruction(): string {
  return `<constraints>
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanmalısınız.
- Bilgi kesim tarihiniz Ocak 2025'tir. Şu anki yıl 2026'dır.
- KELİME LİMİTİ VE İLİŞKİSELLİK (DYADIC): Arama sorguları ZORUNLU OLARAK 3 veya 4 kelimeden oluşan İLİŞKİSEL (dyadic) tam öbekler olmalıdır. Tek bir aktörü veya tek bir kavramı yalın halde aratmak kesinlikle yasaktır.
- İLİŞKİSEL KOMBİNASYON KURALI: Her sorgu en az iki boyutu (Aktör + İdeolojik İttifak/Gelenek, Yayın Organı + Söylem/Dönüşüm, Odak Grup + Karşılaştırılan Geleneğin İlişkisi) aynı öbekte birleştirmelidir.
- ÖRNEK İLİŞKİSEL SORGU FORMATLARI:
  • "AktörX hareketi DisiplinA solu"
  • "AktörX siyaseti SosyalikY hareket"
  • "PartiX1 PartiX2 DergiY1 söylem"
  • "YayınX1 GelenekY1 ilişkisi"
- SAYI KISITI: turkishQueries listesi tam olarak 4 eleman içermelidir. englishQueries listesi tam olarak 4 eleman içermelidir. Toplamda TAM OLARAK 8 SORGU üretilecektir.
- SEMANTIC TARGET KURALI (cohereSemanticTarget): Cohere Rerank modeli için matristen 20-30 kelimelik TEK BİR ANLAMSAL ÖZET CÜMLESİ çıkarınız. Metin strictly "Ana Araştırma Odağı + İkili Aktör Etkileşimi (Dyad) + Yayın/Gelenek Grupları" boyutlarını içermelidir.
- STRİKT TARİH KISITI YASAĞI (NO-DATE RULE): cohereSemanticTarget metnine KESİNLİKLE tarih aralığı veya kronoloji kısıtlaması (Örn: '1990'larda', '1991-1999 dönemi') EKLEMEYİNİZ. Cohere modelinin tarihsel arka plan referans çalışmalarını puan olarak cezalandırmasını engellemek için tarih kısıtı tamamen çıkarılmalı, sadece aktör grupları ve ilişkisel konu odağı tutulmalıdır.
- TÜRKÇE KARAKTER KURALI: Türkçe sorgularda Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, â) KESİNLİKLE aynen koruyunuz.
- AKADEMİK VARYASYON KURALI: Kavramların eşanlamlılarını ve dilbilgisel varyasyonlarını kullanınız.
- YÖNTEMSEL GÜRÜLTÜ FİLTRESİ: Tek başına 'söylem analizi', 'metodoloji', 'kuram' gibi jenerik akademik kavramlar sorgularda yer alamaz.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca Arama & Yeniden Sıralama (Retrieval & Rerank) katmanı parametrelerini üretir.
- ÇIKTI FORMATI: Yanıtınız, sağlanan retrievalParamsSchema ile %100 uyumlu, parse edilebilir bir ham JSON objesi olmalıdır.
</constraints>

<examples>
  <example>
    <input>
{
  "researchCore": "AktörX hareketinin dönemsel söylemsel dönüşüm süreci ve GelenekY sosyo-politik hareketiyle ilişkisi",
  "mainClaim": "AktörX hareketinin söylemsel dönüşümü GelenekY hareketiyle kurulan ilişkisel etkileşimin bir sonucudur."
}
    </input>
    <output>
{
  "turkishQueries": [
    "AktörX hareketi GelenekY solu",
    "AktörX siyaseti SosyalikY hareket",
    "DergiX1 GelenekY1 söylem dönüşüm",
    "AktörX sol ilişkisi dinamikleri"
  ],
  "englishQueries": [
    "ActorX movement GenY left",
    "ActorX politics socialist relations",
    "ActorX movement ideological legacy",
    "GenY socialist discourse ActorX"
  ],
  "cohereSemanticTarget": "AktörX hareketi (PartiX1, PartiX2, DergiX1) ile GelenekY hareketi (GelenekY1, PartiY1, YayınY1) arasındaki söylemsel dönüşüm, ideolojik evrim ve ilişkisel hegemonya mücadelesi."
}
    </output>
  </example>
</examples>

<task>
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan tez matrisini analiz ederek Meilisearch indeksinde en alakalı benzer çalışmaları bulmak üzere ZORUNLU OLARAK 3-4 kelimelik ilişkisel (dyadic) 4 adet Türkçe ve 4 adet İngilizce (toplam 8 adet) akademik arama sorgusu ve Cohere Rerank için tarih kısıtından arındırılmış 1 cümlelik cohereSemanticTarget metni üretmektir.
</task>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
/**
 * Builds the user prompt for Gemini retrieval parameters generation (Tezara queries & Cohere target).
 *
 * @param params - Research core and main claim parameters from thesis matrix.
 * @returns User prompt string.
 */
export function buildRetrievalParamsPrompt(
  params: Pick<ThesisMatrix, "researchCore" | "mainClaim">,
): string {
  return `<context>
{
  "researchCore": "${params.researchCore.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}"
}
</context>

<task>
Sistem talimatındaki kurallara harfiyen uyarak:
1. HER SORGU ZORUNLU OLARAK 3-4 KELİMELİK İLİŞKİSEL (DYADIC) ÖBEKLERDEN OLUŞMALIDIR.
2. Tam olarak 4 Türkçe ve 4 İngilizce (toplam 8) dyadic arama sorgusu üretiniz.
3. cohereSemanticTarget metninde KESİNLİKLE tarih aralığı/kronoloji sınırlaması kullanmayınız, sadece Ana Araştırma Odağı + İkili Aktör Etkileşimi kapsayacak 1 cümlelik sıkıştırılmış özet çıkarınız.
Cevaplamadan önce çok derin düşün.
</task>`;
}
