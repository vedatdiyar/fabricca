import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const queryExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    tavilyQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Tez matrisindeki maddi, tarihsel ve kurumsal iddiaları test etmeye yönelik olgusal doğrulama sorguları listesi (en az 1 sorgu üretilmesi zorunludur, üst sınır yoktur).",
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Aşağı akış kombinasyon motorunu beslemek üzere, hiçbir ek almamış, en yalın sözlük halinde tam olarak 5 adet İngilizce akademik kök anahtar kelime (keywords).",
    },
  },
  required: ["tavilyQueries", "keywords"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildQueryExtractionSystemInstruction(): string {
  return `# ROL
Sen disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı ve Olgusal Doğrulama Mühendisisin. Görevin, girdi olarak sunulan zenginleştirilmiş tez matrisini analiz ederek; uluslararası veri tabanlarında literatür taraması için kullanılacak tam 5 adet İngilizce yalın kök kelime üretmek ve matristeki maddi, tarihsel ve istatistiki iddiaları Tavily arama motoru aracılığıyla doğrulayabilecek sorgular tasarlamaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE KELİME KÖKÜ KURALLARI
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanacaksın.
- KATI KELİME ADEDİ KİLİDİ: \`keywords\` listesi KESİNLİKLE tam olarak 5 (beş) eleman içermelidir. Ne eksik ne fazla. 5'ten farklı sayıda anahtar kelime üretmek, aşağı akıştaki (downstream) kombinasyon motorunu çökerteceği için kesinlikle yasaktır.
- KESİN KÖK KELİME KURALI (STRICT LEMMA CONSTRAINT): İngilizce anahtar kelimeler hiçbir yapım veya çekim eki almamış, türetilmemiş en yalın kök (base/root form) olmak zorundadır. (Örn: "globalization" yerine "global" veya "globe", "privatization" yerine "private", "institutionalism" yerine "institute" veya "institution", "movements" yerine "movement"). Özel karakter veya tırnak işareti kullanma.
- MADDİ DOĞRULAMA SINIRI VE TEORİ YASAĞI: Tavily sorguları yalnızca tez matrisinde adı geçen somut aktörleri, kurumları, yasaları, tarihsel olayları/kronolojik iddiaları ve istatistiki beyanları doğrulamaya yönelik olmalıdır. Soyut teorileri, felsefi yaklaşımları Tavily üzerinden aratmak KESİNLİKLE YASAKTIR.
- DİNAMİK DİL STRATEJİSİ: Tavily sorgularının dili, doğrulanacak olgunun doğasına göre belirlenmelidir. Yerel/ulusal olgular (Türkiye iç siyaseti, ulusal yasa/düzenleme) için Türkçe sorgular; küresel/uluslararası olgular için İngilizce veya karma (Türkçe-İngilizce) sorgular üretilmelidir.
- BOŞ TAVILY KÜMESİ KORUMASI: Tez matrisi tamamen soyut kuramsal bir yapıda olsa dahi, \`tavilyQueries\` dizisi ASLA boş (\`[]\`) dönmemelidir. Bu durumda tezin temel kavramının, zaman aralığının veya mekansal bağlamının literatürdeki yaygınlığını doğrulamaya yönelik en az 1 (bir) genel doğrulama sorgusu üretilmelidir.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`queryExtractionSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_girdi_matrisi>
{
  "studyTitle": "Finansallaşma Kıskacında Öznellik: Beyaz Yakalı Çalışanlarda Borçluluk ve Yönetimsellik",
  "researchQuestion": "Kişisel borçluluk dinamikleri, beyaz yakalı çalışanların gündelik emek süreçlerindeki mikro-iktidar ilişkilerini nasıl şekillendirir?",
  "mainClaim": "Borçluluk, bireyi profesyonel düzeyde disipline eden temel bir yönetimsellik teknolojisi olarak işlev görmektedir.",
  "methodology": "30 beyaz yakalı profesyonel ile gerçekleştirilen yarı yapılandırılmış derinlemesine mülakatlar.",
  "theoreticalFramework": "Michel Foucault'nun yönetimsellik analizi ve Maurizio Lazzarato'nun borçlu insan kavramsallaştırması.",
  "historicalSpatialLimits": "2018-2025 yılları arasında İstanbul'daki plaza ekosistemleri."
}
</ornek_girdi_matrisi>

<ornek_beklenen_cikti>
{
  "tavilyQueries": [
    "Türkiye beyaz yakalı çalışan borçluluk oranları 2018 2025",
    "İstanbul plaza çalışanları sosyo ekonomik raporları",
    "Türkiye tüketici kredileri ve hanehalkı borç istatistikleri"
  ],
  "keywords": [
    "debt",
    "labor",
    "capital",
    "subject",
    "finance"
  ]
}
</ornek_beklenen_cikti>
_Not: Keywords dizisi tam 5 elemandır. "financialization" yerine "finance", "subjectivity" yerine "subject", "indebtedness" yerine "debt" gibi en yalın kök (lemma) halleri seçilmiştir._`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildQueryPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "historicalSpatialLimits": "${params.historicalSpatialLimits.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan "KATI KELİME ADEDİ KİLİDİ", "KESİN KÖK KELİME KURALI" ve "MADDİ DOĞRULAMA SINIRI" kurallarına harfiyen bağlı kalarak, yukarıdaki <hedef_tez_matrisi> yapısını analiz et. Literatür taraması kombinasyon motorunu beslemek üzere tam olarak 5 adet ek almamış yalın İngilizce anahtar kelime kökü (keywords) ayıkla ve matristeki maddi unsurları doğrulayacak en az 1 adet olgusal Tavily sorgusu tasarla.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan matris verilerine bağlı kal (Strictly Grounded). Matriste deklare edilmemiş kurumları veya tarihsel olayları doğrulama sorgusu olarak kurgulama.
- İngilizce anahtar kelimelerin türetilmiş kelime (-ism, -ization vb.) veya çoğul eki içermediğinden, en yalın sözlük kökü olduğundan ve çıktı formatının saf Türkçe yönlendirmeli ham JSON olduğundan emin ol.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
