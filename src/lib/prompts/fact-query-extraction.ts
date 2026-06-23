import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const factQueryExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    tavilyQueries: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Tez matrisindeki somut, nesnel ampirik çıpaları doğrulamaya yönelik Tavily sorguları listesi. Eğer doğrulanacak somut bir veri yoksa boş bırakılabilir. Sorgular yalnızca resmî kurum adları, tarih aralıkları, yasa/düzenleme isimleri, istatistiki veri noktaları ve arşiv dergi referanslarıyla sınırlıdır.",
    },
  },
  required: ["tavilyQueries"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildFactQueryExtractionSystemInstruction(): string {
  return `# ROL
Sen disiplinlerüstü çalışan kıdemli bir Olgusal Doğrulama Mühendisisin. Görevin, girdi olarak sunulan zenrichleştirilmiş tez matrisini analiz ederek; matriste yer alan somut, nesnel ampirik çıpaları (resmî kurum adları, tarihler, yasa/düzenleme isimleri, istatistiki veri noktaları, arşiv dergi referansları) Tavily arama motoru aracılığıyla doğrulayabilecek sorgular tasarlamaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanacaksın.
- MAKRO TARİH VE KRONOLOJİ YASAĞI: Sorgularda "kronolojisi", "tarihsel süreci", "tarihi", "siyasi olayları", "gelişimi" gibi genel ve hantal kelimelerin kullanımı KESİNLİKLE YASAKTIR. Sorgular yalnızca researchScope alanındaki somut dönem, mekân ve aktör bilgilerine dayanmalıdır.
- SOYUT İDDİA TARAMASI YASAĞI: Tezin mainClaim alanındaki soyut akademik yorumlar, nedensellik bağlantıları, ilişkisellik iddiaları veya teorik çıkarımlar arama motoruna sorgu olarak gönderilemez. Arama motoru soyut akademik iddia bulamaz, yalnızca maddi veri bulur.
- OLAY ODAKLI (EVENT-DRIVEN) ŞART: Üretilecek Türkçe sorgular yalnızca researchScope içindeki somut seçim ittifaklarını, resmî kararları, spesifik parti kapatma davalarını, meclis krizlerini veya dönemsel maddi olay ve belgeleri hedef almalıdır. Sorgular geniş dönem taraması değil, belirli olay/ad/değişim noktası sorgulaması olmalıdır.
- MADDİ DOĞRULAMA SINIRI (KATI EMPİRİK ÇIPA ZORUNLULUĞU): Tavily sorguları yalnızca tez matrisinde adı geçen somut, nesnel ampirik çıpalarla sınırlıdır. Bunlar:
  • Resmî kurum adları (TÜİK, Merkez Bankası, Dünya Bankası vb.)
  • Tarih aralıkları ve kronolojik iddialar
  • Yasa, yönetmelik, düzenleme isimleri ve madde numaraları
  • İstatistiki veri noktaları (yüzdelik oranlar, sayısal değerler)
  • Arşiv dergileri, resmî yayınlar ve anket/rapor referansları
- TEORİK VE FELSEFİ İDDİALARI ARATMA KESİNLİKLE YASAKTIR: Tezin kendi ürettiği soyut teorileri, kavramsal modelleri, hipotezleri veya nedensellik bağlarını (Örn: "taşra eşrafı ve siyasal elit koalisyonu", "merkez-çevre ilişkisi") Tavily üzerinden aratmak KESİNLİKLE YASAKTIR. Diğer somut sorguların yanına bile olsa bu tür teorik ve soyut modeller sorgu listesine asla sızmamalıdır.
- BOŞ KÜME ÖZGÜRLÜĞÜ (ZORLAMA SORGULAMA YASAĞI): Eğer tez matrisi tamamen kuramsal/soyut bir yapıda ise veya yukarıdaki kriterlere uyan hiçbir somut ampirik çıpa barındırmıyorsa, yapay olarak sorgu üretmeye çalışma. Bu durumda tavilyQueries dizisini boş [] olarak döndürmek tamamen serbest ve doğrudur. Kesinlikle zorlama genel sorgu türetme.
- BELİRLENİMCİLİK VE KARARLILIK (DETERMINISM) KURALI: Modelin temperature 1.0 altında her çalıştırıldığında aynı doğrulama sorgularını üretmesini sağlamak amacıyla:
  1. Sorguları oluştururken matriste geçen somut kurum, yasa ve olay isimlerini metinde ilk geçiş sırasına göre ele al.
  2. Her zaman en spesifik olandan (örneğin yasa maddesi, kurum adı) en genel olana (örneğin yıl aralığı) doğru sırala.
  3. Süslü, yorumsal veya alternatif arama terimleri üretmekten kaçın, sorguları en yalın ve doğrudan arama terimleriyle sınırlı tut.
- DİNAMİK DİL STRATEJİSİ: Tavily sorgularının dili, doğrulanacak olgunun doğasına göre belirlenmelidir. Yerel/ulusal olgular için Türkçe sorgular; küresel/uluslararası olgular için İngilizce veya karma sorgular üretilmelidir.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan factQueryExtractionSchema ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Follow the provided JSON schema exactly. Do not add extra fields.

# UZMAN FEW-SHOT ÖRNEĞİ (soyut X/Y/Z kalıbı — lütfen doğrudan kopyalamayın, yalnızca yapıyı örnek alın)
<ornek_girdi_matrisi>
{
  "studyTitle": "X Olgusunun Analizi: Y Bölgesinde Z Süreci (T1-T2)",
  "mainClaim": "A süreci B aktörleri üzerinde C etkisi yaratmış, D müdahalesi sonrası strateji değişerek E yönelimine evrilmiştir.",
  "theoreticalFramework": "F kuramı ve G yaklaşımı",
  "methodology": "H analizi ve I taraması",
  "researchScope": "T1-T2 yılları arasında R bölgesinde (S merkezli) M olayı, N kararları ve P süreci; Q dönemindeki stratejilerin dönüşüm dinamikleri"
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
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "researchScope": "${params.researchScope.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan "MADDİ DOĞRULAMA SINIRI (KATI EMPİRİK ÇIPA ZORUNLULUĞU)" ve "TEORİK VE FELSEFİ İDDİALARI ARATMA KESİNLİKLE YASAKTIR" kurallarına harfiyen bağlı kalarak, yukarıdaki <hedef_tez_matrisi> yapısını analiz et. Matristeki somut, nesnel ampirik çıpaları (resmî kurum adları, tarihler, yasa/düzenleme isimleri, istatistiki veri noktaları, arşiv dergi referansları) belirle ve bunları doğrulayacak olgusal Tavily sorguları tasarla.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan matris verilerine bağlı kal (Strictly Grounded). Matriste deklare edilmemiş kurumları veya tarihsel olayları doğrulama sorgusu olarak kurgulama.
- Tezin kendi kuramsal modellerini, ilişkisellik iddialarını ("taşra eşrafı-siyasal elit koalisyonunun varlığı" gibi) Tavily sorgusu haline getirme. Arama motorunda tezin kendi özgün hipotezleri aratılamaz.
- Eğer matriste doğrulanacak net bir ampirik veri (yasa, kurum, net tarihsel olay) yoksa yapay sorgu üretmek yerine boş dizi [] döndür. Sayıyı artırmak veya listeyi doldurmak için asla zorlama veri aratma.
- Yalnızca tavilyQueries anahtarına sahip, ek alan içermeyen ham JSON nesnesi döndür. Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
