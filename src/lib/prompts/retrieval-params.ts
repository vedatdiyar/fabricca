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
        "YÖKTEZ veritabanında Türkçe dizinlenmiş tezleri bulmak için en uygun 4 adet 2-4 kelimelik Türkçe akademik arama sorgusu.",
    },
    englishQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında İngilizce dizinlenmiş tezleri bulmak için en uygun 4 adet 2-4 kelimelik İngilizce akademik arama sorgusu.",
    },
    cohereSemanticTarget: {
      type: "string",
      description:
        "Cohere Rerank modeli için tarih kısıtlarından arındırılmış, Ana Araştırma Odağı + Odak Aktör/Kurum/Olgu + Merkez Sav boyutlarını birleştiren 1 cümlelik (20-30 kelime) anlamsal hedef metni.",
    },
  },
  required: ["turkishQueries", "englishQueries", "cohereSemanticTarget"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE - EVRENSEL GENELLEŞTİRME İLKESİNE UYGUN)
// ============================================================================
/**
 * Builds the system instruction for Gemini 3.5 Flash-Lite retrieval parameters generation
 * (Tezara search queries & Cohere semantic target).
 * Follows LLM_INTEGRATION.md standards (XML tags, positive boundaries, Generality Principle).
 *
 * @returns System instruction string.
 */
export function buildRetrievalParamsSystemInstruction(): string {
  return `<constraints>
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanmalısınız.
- Bilgi kesim tarihiniz Ocak 2025'tir. Şu anki yıl 2026'dır.
- EVRENSEL VE DİSİPLİNLERÜSTÜ ARAMA KURALI: Tez konusunun doğası ne olursa olsun (kurum/politika odaklı, tek/çok aktörlü, olgu veya sosyo-ekonomik süreç incelemesi vb.), veritabanından en alakalı ve yüksek erişimli (high recall) akademik çalışmaları bulacak esnek arama sorguları üretiniz.
- KELİME LİMİTİ VE SORGU YAPISI: Arama sorguları ZORUNLU OLARAK 2 ila 4 kelimeden oluşan net akademik öbekler veya kavram birleşimleri olmalıdır.
- SOYUT TEORİ VE METODOLOJİ YASAĞI: Tek başına soyut kuramsal, kavramsal veya yöntemsel başlıkları (Örn: 'KuramY Hegemonya Kavramı', 'DisciplineA Methodology', 'ThinkerX State Theory') ARAMA SORGUSU OLARAK ÜRETMEYİNİZ. Kuramsal ve yöntemsel kavramlar DAİMA tez konusundaki ampirik odak, aktör, kurum veya olay ile BİRLEŞİK olarak üretilmelidir (Örn: 'AktörX KuramY Hegemonya', 'AktörX Dönüşüm Stratejisi Z').
- SORGU ÇEŞİTLİLİĞİ VE BOYUT DAĞILIMI: Üretilecek 4 Türkçe ve 4 İngilizce sorgu, tezin farklı boyutlarını kapsayan dengeli bir bileşim oluşturmalıdır:
  • Konu / Tematik Problem Sorguları (Örn: "KonuA problemi DisiplinB")
  • Kuramsal + Ampirik Bileşik Sorgular (Örn: "AktörX KuramY dönüşüm")
  • Aktör / Kurum / Olgu Sorguları (Örn: "KurumY AktörX politikaları")
  • Sentez ve Süreç Sorguları (Örn: "AktörX OlguB analizi")
- SAYI KISITI: turkishQueries listesi tam olarak 4 eleman içermelidir. englishQueries listesi tam olarak 4 eleman içermelidir. Toplamda TAM OLARAK 8 SORGU üretilecektir.
- SEMANTIC TARGET KURALI (cohereSemanticTarget): Cohere Rerank modeli için tez matrisinden 20-30 kelimelik TEK BİR ANLAMSAL ÖZET CÜMLESİ çıkarınız. Metin strictly "Ana Araştırma Odağı (researchCore) + Odak Aktör/Kurum/Olgu (targetActors) + Merkez Sav (mainClaim)" boyutlarını içermelidir.
- STRİKT TARİH KISITI YASAĞI (NO-DATE RULE): cohereSemanticTarget metnine KESİNLİKLE tarih aralığı veya kronoloji kısıtlaması (Örn: '1990'larda', '1991-1999 dönemi') EKLEMEYİNİZ. Cohere modelinin tarihsel arka plan referans çalışmalarını puan olarak cezalandırmasını engellemek için tarih kısıtı tamamen çıkarılmalı, sadece kavramsal, kuramsal ve aktör/kurum odağı tutulmalıdır.
- TÜRKÇE KARAKTER KURALI: Türkçe sorgularda Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, â) KESİNLİKLE aynen koruyunuz.
- AKADEMİK VARYASYON KURALI: Kavramların eşanlamlılarını ve dilbilgisel varyasyonlarını kullanınız.
- YÖNTEMSEL GÜRÜLTÜ FİLTRESİ: Tek başına 'söylem analizi', 'metodoloji', 'kuram' gibi jenerik akademik kavramlar tekil sorgu olarak yer alamaz, daima tematik konu/aktör ile birleştirilmelidir.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca Arama & Yeniden Sıralama (Retrieval & Rerank) katmanı parametrelerini üretir.
- ÇIKTI FORMATI: Yanıtınız, sağlanan retrievalParamsSchema ile %100 uyumlu, parse edilebilir bir ham JSON objesi olmalıdır.
</constraints>

<examples>
  <example>
    <input>
{
  "researchCore": "AktörX hareketinin dönemsel söylemsel dönüşüm süreci ve GelenekY sosyo-politik hareketiyle ilişkisi",
  "targetActors": "AktörX, KurumY, OdakGrupZ",
  "mainClaim": "AktörX hareketinin söylemsel dönüşümü KuramW çerçevesinde mevzi savaşına geçiş olarak açıklanabilir."
}
    </input>
    <output>
{
  "turkishQueries": [
    "AktörX hareketi söylem dönüşümü",
    "KurumY AktörX politikaları",
    "KuramW mevzi savaşı hegemonya",
    "AktörX GelenekY ilişkisi"
  ],
  "englishQueries": [
    "ActorX movement discourse transformation",
    "InstitutionY ActorX politics",
    "TheoryW war of position hegemony",
    "ActorX GenY relations"
  ],
  "cohereSemanticTarget": "AktörX hareketi ile KurumY arasındaki söylemsel dönüşümün KuramW çerçevesinde mevzi savaşı ve hegemonya inşası açısından analizi."
}
  </example>
</examples>

<task>
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan tez matrisini analiz ederek Meilisearch indeksinde en alakalı benzer çalışmaları bulmak üzere 2-4 kelimelik 4 adet Türkçe ve 4 adet İngilizce (toplam 8 adet) akademik arama sorgusu ve Cohere Rerank için tarih kısıtından arındırılmış 1 cümlelik cohereSemanticTarget metni üretmektir.
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
1. Her sorgu 2-4 kelimelik net ve çeşitli akademik öbeklerden oluşmalıdır.
2. Tam olarak 4 Türkçe ve 4 İngilizce (toplam 8) akademik arama sorgusu üretiniz.
3. cohereSemanticTarget metninde KESİNLİKLE tarih aralığı/kronoloji sınırlaması kullanmayınız, sadece Ana Araştırma Odağı + Odak Aktör/Kurum/Olgu + Merkez Savı kapsayacak 1 cümlelik sıkıştırılmış özet çıkarınız.
Cevaplamadan önce çok derin düşün.
</task>`;
}
