import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const factQueryExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    tavilyQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Tez matrisindeki somut, nesnel ampirik çıpaları doğrulamaya yönelik Tavily sorguları listesi (en az 1 sorgu üretilmesi zorunludur, üst sınır yoktur). Sorgular yalnızca resmî kurum adları, tarih aralıkları, yasa/düzenleme isimleri, istatistiki veri noktaları ve arşiv dergi referanslarıyla sınırlıdır.",
    },
  },
  required: ["tavilyQueries"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildFactQueryExtractionSystemInstruction(): string {
  return `# ROL
Sen disiplinlerüstü çalışan kıdemli bir Olgusal Doğrulama Mühendisisin. Görevin, girdi olarak sunulan zenginleştirilmiş tez matrisini analiz ederek; matriste yer alan somut, nesnel ampirik çıpaları (resmî kurum adları, tarihler, yasa/düzenleme isimleri, istatistiki veri noktaları, arşiv dergi referansları) Tavily arama motoru aracılığıyla doğrulayabilecek sorgular tasarlamaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanacaksın.
- MAKRO TARİH VE KRONOLOJİ YASAĞI: Sorgularda "kronolojisi", "tarihsel süreci", "tarihi", "siyasi olayları", "gelişimi" gibi genel ve hantal kelimelerin kullanımı KESİNLİKLE YASAKTIR. Sorgular yalnızca \`historicalLimits\` ve \`spatialLimits\` alanlarındaki somut dönem, mekân ve aktör bilgilerine dayanmalıdır.
- SOYUT İDDİA TARAMASI YASAĞI: Tezin \`mainClaim\` alanındaki soyut akademik yorumlar, nedensellik bağlantıları, ilişkisellik iddiaları veya teorik çıkarımlar arama motoruna sorgu olarak gönderilemez. Arama motoru soyut akademik iddia bulamaz, yalnızca maddi veri bulur.
- OLAY ODAKLI (EVENT-DRIVEN) ŞART: Üretilecek Türkçe sorgular yalnızca \`historicalLimits\` ve \`spatialLimits\` içindeki somut seçim ittifaklarını, resmî kararları, spesifik parti kapatma davalarını, meclis krizlerini veya dönemsel maddi olay ve belgeleri hedef almalıdır. Sorgular geniş dönem taraması değil, belirli olay/ad/değişim noktası sorgulaması olmalıdır.
  - Örnek: "1991 genel seçimleri SHP HEP ittifakı", "1994 DEP milletvekilleri yemin krizi", "1982 Anayasası halkoylaması sonuçları".
- MADDİ DOĞRULAMA SINIRI (KATI EMPİRİK ÇIPA ZORUNLULUĞU): Tavily sorguları yalnızca tez matrisinde adı geçen somut, nesnel ampirik çıpalarla sınırlıdır. Bunlar:
  • Resmî kurum adları (TÜİK, Merkez Bankası, Dünya Bankası vb.)
  • Tarih aralıkları ve kronolojik iddialar
  • Yasa, yönetmelik, düzenleme isimleri ve madde numaraları
  • İstatistiki veri noktaları (yüzdelik oranlar, sayısal değerler)
  • Arşiv dergileri, resmî yayınlar ve anket/rapor referansları
- TEORİK VE FELSEFİ İDDİALARI ARATMA KESİNLİKLE YASAKTIR: Soyut teorileri, nedensellik bağlarını, felsefi yaklaşımları, kavramsal çerçeveleri veya öznel/ spekülatif iddiaları Tavily üzerinden aratmak KESİNLİKLE YASAKTIR. Bu tür öğeler sorgu olarak asla üretilmemelidir.
- DİNAMİK DİL STRATEJİSİ: Tavily sorgularının dili, doğrulanacak olgunun doğasına göre belirlenmelidir. Yerel/ulusal olgular (Türkiye iç siyaseti, ulusal yasa/düzenleme) için Türkçe sorgular; küresel/uluslararası olgular için İngilizce veya karma sorgular üretilmelidir.
- BOŞ KÜME KORUMASI: Tez matrisi tamamen soyut kuramsal bir yapıda olsa dahi, \`tavilyQueries\` dizisi ASLA boş (\`[]\`) dönmemelidir. Bu durumda tezin temel kavramının, zaman aralığının veya mekansal bağlamının literatürdeki yaygınlığını doğrulamaya yönelik en az 1 (bir) genel sorgu üretilmelidir.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`factQueryExtractionSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ (soyut X/Y/Z kalıbı — lütfen doğrudan kopyalamayın, yalnızca yapıyı örnek alın)
<ornek_girdi_matrisi>
{
  "studyTitle": "X Olgusunun Analizi: Y Bölgesinde Z Süreci (T1-T2)",
  "mainClaim": "A süreci B aktörleri üzerinde C etkisi yaratmış, D müdahalesi sonrası strateji değişerek E yönelimine evrilmiştir.",
  "theoreticalFramework": "F kuramı ve G yaklaşımı",
  "methodology": "H analizi ve I taraması",
  "dataStrategy": "J belgeleri, K kayıtları, L arşivleri",
  "historicalLimits": "T1-T2 yılları arasında M olayı, N kararları ve P süreci",
  "spatialLimits": "R bölgesi (S merkezli)",
  "analyticalFocus": "Q dönemindeki stratejilerin dönüşüm dinamikleri"
}
</ornek_girdi_matrisi>

<ornek_beklenen_cikti>
{
  "tavilyQueries": [
    "T1 seçimleri X Partisi oy oranı",
    "X Y koalisyon protokolü T1",
    "T2 M bildirisi karar maddeleri",
    "X Partisi kapatma davası T3 Anayasa Mahkemesi"
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildFactQueryPrompt(params: {
  studyTitle: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "dataStrategy": "${params.dataStrategy.replace(/"/g, '\\"')}",
  "historicalLimits": "${params.historicalLimits.replace(/"/g, '\\"')}",
  "spatialLimits": "${params.spatialLimits.replace(/"/g, '\\"')}",
  "analyticalFocus": "${params.analyticalFocus.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan "MADDİ DOĞRULAMA SINIRI (KATI EMPİRİK ÇIPA ZORUNLULUĞU)" ve "TEORİK VE FELSEFİ İDDİALARI ARATMA KESİNLİKLE YASAKTIR" kurallarına harfiyen bağlı kalarak, yukarıdaki <hedef_tez_matrisi> yapısını analiz et. Matristeki somut, nesnel ampirik çıpaları (resmî kurum adları, tarihler, yasa/düzenleme isimleri, istatistiki veri noktaları, arşiv dergi referansları) belirle ve bunları doğrulayacak en az 1 adet olgusal Tavily sorgusu tasarla.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan matris verilerine bağlı kal (Strictly Grounded). Matriste deklare edilmemiş kurumları veya tarihsel olayları doğrulama sorgusu olarak kurgulama.
- Teorik çerçeveleri, felsefi yaklaşımları veya nedensellik bağlarını sorgu olarak KESİNLİKLE üretme.
- Yalnızca \`tavilyQueries\` anahtarına sahip, ek alan içermeyen ham JSON nesnesi döndür.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
