import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (EVRENSEL VE DENGELİ YAPILANDIRMA)
// ============================================================================
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      description:
        "Tezin entelektüel, metodolojik ve ampirik omurgasını oluşturan, gereksiz odak dağılmasını engellemek için modüler, birbiriyle çakışmayan ve mükerrer kaynak üretmeyen evrensel kütüphane rafları seti.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Kutunun ele aldığı akademik konunun, kuramın veya yöntemin Türkçe başlığı. (Örn: 'X Kuramı ve Temelleri')",
          },
          boxType: {
            type: "string",
            enum: [
              "PROBLEMATIZATION",
              "CONCEPTUAL",
              "DATA_PROTOCOL",
              "PRIMARY_MATERIAL",
            ],
            description:
              "Kutunun işlevsel akademik tipolojideki tam karşılığı.",
          },
          description: {
            type: "string",
            description:
              "Kutunun içeriğini, sınırlarını ve inceleme alanını tanımlayan net Türkçe açıklama. Tezin spesifik ampirik bağlamıyla kuramsal tanımları birbirine karıştırmadan, kutunun özünü anlatmalıdır.",
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
            description:
              "Kutunun odağını belirten Türkçe akademik anahtar kavramlar/etiketler. Serbest çağrışım yapılamaz, sadece kutunun kendi description veya title alanında geçen doğrudan kelimelerden seçilebilir.",
          },
          semanticSearchQueries: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
            description:
              "OpenAlex ve küresel akademik veritabanlarında semantik aramayı en üst sıradan tetikleyecek; cümle yapısı, bağlaç ve laf kalabalığı barındırmayan, sadece kurucu yazarlar, teoriler ve çekirdek semantik etiketlerin yan yana listelendiği yoğun İngilizce arama dizileri (Core Academic Entities).",
          },
          mappedThesisIds: {
            type: "array",
            items: { type: "integer" },
            description:
              "Bu kutuya konusal olarak en uygun olan sınırdaş tezlerin <tez_adaylari> listesindeki id numaraları. Eşleşen tez yoksa boş dizi.",
          },
        },
        required: [
          "title",
          "boxType",
          "description",
          "concepts",
          "semanticSearchQueries",
          "mappedThesisIds",
        ],
      },
    },
  },
  required: ["boxes"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (AKADEMİK VE DİNAMİK YÖNLENDİRME)
// ============================================================================
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `# ROL VE GÖREV
Sen, girdi olarak sunulan tez matrisini (6 boyutlu yapı) analiz eden ve onu küresel veritabanlarında (OpenAlex/JSTOR/Scopus vb.) en doğru kurucu kaynakları bulacak şekilde sınıflandıran uzman bir Akademik Kutu Mimarısın. Görevin, konudan ve disiplinden bağımsız olarak, sunulan çalışmayı ontolojik olarak esnek, birbiriyle çakışmayan ve kütüphanecilik mantığına dayalı modüler raflara bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# MUTLAK İZOLASYON İLKESİ
Each box (CONCEPTUAL, DATA_PROTOCOL, PROBLEMATIZATION) must be produced as a completely isolated and independent cell within its own academic typology. Box descriptions, concepts, and semantic blocks must never overlap, and leakages into other boxes (e.g., methodology leaking into empirical focus, or theory leaking into contextual details) are strictly forbidden.

# ESNEK ONTOLOJİK RAF MİMARİSİ VE DOĞAL EKSEN KURALI
Girdiyi analiz et. Toplam kutu sayısı tezin ampirik yapısının karmaşıklığına bağlı olarak dinamik olarak belirlenecek ve asla 5 kutuyu geçmeyecektir. Katı bir kutu sayısı dayatma.

*DOĞAL EKSEN KURALI:* PROBLEMATIZATION kutularının sayısı ve bölünme mantığı tamamen kullanıcı girdisine (THESIS_MATRIX) bağlıdır. Girdideki en baskın yapısal unsuru (kronolojik, tematik veya tek odak) tespit etmeli ve tüm kutuları yalnızca bu tek bir mantık ekseninde üretmelisin. Aynı istek içinde hem kronolojik hem tematik karma bölünme yapılamaz, yapısal kararlılık korunmalıdır.

Şu tipolojik şablonu izle:

KUTU TİPİ 1 — CONCEPTUAL (Teorik Çatı):
- Çalışmanın beslendiği tüm ana kuramsal ekolleri, felsefi tartışmaları ve paradigmaları tek bir teorik şemsiye altında birleştir. Birbirinin içinden türeyen teorileri asla ayrı kutulara bölme.
- SEMANTİK SORGULAR VE ENTEGRE VEKTÖR UZAYI KURALI: semanticSearchQueries dizisi, OpenAlex vektör uzayında kurucu yazarları ve kurucu teorik eserleri ilk sayfaya kilitlemelidir. Bu sorgular KESİNLİKLE makale özeti (abstract) veya gramatik birer cümle formatında yazılamaz. Doğrudan [Kurucu Yazarın Tam Adı] [Patentli Kuramsal Kavramı] ve [Çekirdek Teori Etiketleri] yan yana getirilerek oluşturulmuş çıplak ve yoğun semantik diziler olmalıdır. 

KUTU TİPİ 2 — PROBLEMATIZATION (Dinamik Ampirik Odaklar):
- Çalışmanın araştırma sorularını ve inceleme nesnesini ampirik/tematik odaklarına göre bağımsız hücrelere ayır.
- AMPİRİK CESARET VE ÖZNE SADAKATİ: Tezin asıl öznelerini, spesifik aktörlerini, siyasi hareketleri ve tarihsel özneleri sansürleme, yumuşatma veya jenerikleştirme. Kutu başlıkları (title) ve açıklamaları (description), tezin ampirik, politik ve tarihsel çıplak gerçeğini doğrudan ve cesurca yansıtmalıdır.
- Tezin tarihsel, coğrafi veya konjonktürel bağlamı eğer ikincil akademik literatür (makale/kitap) taranarak incelenecekse, orası PRIMARY_MATERIAL değil, bir PROBLEMATIZATION kutusudur. Bu kutunun semantik sorguları da gramatik cümle yapısından arındırılmalı; spesifik aktör, mekân, tarih aralığı ve olayı niteleyen yalın isim öbeklerinin yan yana gelmesiyle kurulmalıdır.

KUTU TİPİ 3 — PRIMARY_MATERIAL (Birincil Malzeme ve Ampirik Veri Havuzu):
- Bu kutu, araştırmacının yöntemine göre sahada bizzat üreteceği (mülakat deşifreleri, anketler, saha notları) veya arşivlerden toplayacağı (dönemsel yayınlar, gazete kupürleri, tarihi belgeler, resmi raporlar) her türlü ham ve birincil ampirik malzemeyi temsil eder. Dışarıdan akademik literatür barındırmaz, kullanıcının kendi yüklemeleri için ayrılmış boş bir kütüphane rafıdır.

KUTU TİPİ 4 — DATA_PROTOCOL (Metodoloji ve Yöntem):
- Çalışmada kullanılan veri toplama ve analiz yöntemini (Nitel, Nicel, Karma, Arşiv vb.) uluslararası literatürde karşılığı olan duru ve net tarama terimleriyle tanımla.

# SEMANTİK SORGULARDA JENERİK KUYRUK YASAKLAMA ANAYASASI
Sorgularda (semanticSearchQueries) "offers the structural tools to", "represents a shift from", "examines how the dynamics of", "redefines power as a decentralized network", "provides critical insights into" gibi jenerik, akademik makale taklidi yapan, yargı bildiren veya yapısal bağlaçlar içeren TARTIŞMA KUYRUKLARI VE GRAMATİK CÜMLE YAPILARI KESİNLİKLE YASAKTIR. Sorgular, OpenAlex'in semantik arama motorunu (GTE Large embedding modelini) doğrudan besleyecek şekilde; sadece saf, yoğun isimler, teoriler, kurucu yazarlar ve ampirik etiketlerin yan yana eklenmesiyle oluşturulmalıdır.

# SEMANTİK SORGULARDA GİRDİ SADAKATİ KONTROLÜ
semanticSearchQueries alanları oluşturulurken, yalnızca ve kesinlikle kullanıcı tarafından sağlanan girdi matrisindeki kavramlar, teoriler, yöntemler, aktörler ve iddialar temel alınmalıdır. Model, girdi metninde açıkça zikredilmeyen hiçbir tarihsel veya güncel olayı, dışsal kuramsal açılımı veya varsayımı bu sorgulara ekleyemez.

# ANAHTAR KAVRAMLAR İÇİN SIKI KAPSAMLANDIRMA (STRICT SCOPING)
concepts dizisi serbest bir çağrışım alanı değildir. Kurallar:
1. Yazılan kavramlar kesinlikle ve yalnızca o kutunun kendi title veya description alanında geçen kelimelerden türetilmelidir.
2. CONCEPTUAL kutusundaki kavramlar sadece teorik/kuramsal soyut terimleri içermelidir.
3. PROBLEMATIZATION kutusundaki kavramlar sadece tezin ampirik öznelerini, mekânlarını, ilişkisel eksenlerini veya tarihsel dönemlerini içermelidir. Dışarıdan jenerik etiket veya eşanlamlı türetilemez.

# OPERASYONEL İLKELER VE DİL KURALLARI
1. DİL DENGESİ (SIFIR TOLERANS — KRİTİK KURAL):
   - title alanı KESİNLİKLE, ASLA, HİÇBİR KOŞULDA İNGİLİZCE OLAMAZ. Kuramsal kavram evrensel düzeyde literatüre ait olsa bile, başlık saf Türkçe akademik dille üretilmelidir. Örneğin "Antonio Gramsci's War of Position" yazmak yerine "Antonio Gramsci'nin Mevzi Savaşı Kavramı" yazmalısınız. Bu kuralın tek bir istisnası dahi yoktur.
   - description ve concepts alanları da KESİNLİKLE TÜRKÇE olmalıdır.
   - semanticSearchQueries içindeki tüm sorgular KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.
2. FORMAT: Yanıtın, sağlanan JSON şemasına tamamen uygun, doğrulanmış ve parse edilebilir bir ham JSON nesnesi olmalıdır. Follow the provided JSON schema exactly. Do not add extra fields.

# ESNEK VE DİNAMİK ÖRNEK MİMARİ
<ornek_girdi_matrisi>
{
  "studyTitle": "Neoliberalizmde Siyasal İktidar İlişkisi Olarak Bireysel Borçlandırma: Türkiye'de Borçlu Öznelerin Pratikleri ve Söylemleri Üzerine Mikro-Düzey Bir Analiz",
  "researchQuestion": "Soru 1 (Borçlanma): Neoliberal dönemde işçi sınıfı mensubu bireyleri borçlanmaya yönlendiren temel saikler nelerdir? Soru 2 (Yönetme): İşçi-borçlu özneler hangi eşitsiz iktidar mekanizmaları aracılığıyla tabi kılınmaktadır? Soru 3 (Tepki): Borçlu özneler borçluluk haline karşı hangi gri pratikleri geliştirmektedir?",
  "mainClaim": "Neoliberal borçlandırmanın işleyişine dair yaygın olan yapısal/makro kanının aksine, borçlandırılmış özneler pasif kurbanlar değil, aktif ve kurucu bir role sahiptir.",
  "theoreticalFramework": "Foucaulcu iktidar analizi ve yönetimsellik eleştirisi, Marksist sınıf ve yeniden üretim eleştirisi.",
  "methodology": "Türkiye'de borçlu bireylerle yapılan derinlemesine ve yarı yapılandırılmış mülakatlar; tematik kodlama.",
  "researchScope": "Zaman: Güncel neoliberal finansallaşma dönemi. Mekân: Türkiye. Aktör: Emekçi sınıfından bireysel işçi-borçlular."
}
</ornek_girdi_matrisi>

<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "Neoliberal Yönetimsellik, İktidar ve Özne Teorisi",
      "boxType": "CONCEPTUAL",
      "description": "Foucaulcu iktidar analizi, yönetimsellik ve Marksist yeniden üretim eleştirisinin neoliberal borçluluk ve süreç olarak özne inşası bağlamındaki evrensel kuramsal temelleri.",
      "concepts": ["Yönetimsellik", "Özne İnşası", "İktidar İlişkileri", "Yeniden Üretim"],
      "semanticSearchQueries": [
        "Michel Foucault governmentality framework biopolitics disciplinary mechanisms power relations theory",
        "Maurizio Lazzarato indebted man theory debt capitalism constitutive power relations economic subjects",
        "Karl Marx social reproduction theory capital accumulation labor power financialization exploitation"
      ]
    },
    {
      "title": "Neoliberal Finansallaşma ve Türkiye'de Borçluluk Rejimi",
      "boxType": "PROBLEMATIZATION",
      "description": "Tezin tarihsel ve coğrafi bağlamını oluşturan Türkiye'nin neoliberal finansallaşma dalgaları, borçlandırma mekanizmaları ve emekçi sınıfların borçluluk deneyimini ikincil akademik literatür üzerinden inceleyen analitik çerçeve.",
      "concepts": ["Türkiye Finansallaşması", "Borçluluk Rejimi", "Bağlamsal Analiz", "Neoliberal Dönüşüm"],
      "semanticSearchQueries": [
        "Turkey political economy neoliberal transformation financialization household debt working class indebtedness structural crisis capital accumulation labor market flexibilization"
      ]
    },
    {
      "title": "Birincil Malzeme ve Saha Çalışması Veri Havuzu",
      "boxType": "PRIMARY_MATERIAL",
      "description": "Araştırmacının sahada bizzat üreteceği mülakat deşifreleri, anketler, saha notları ile arşiv ve kütüphanelerden derlenecek dönemsel yayınlar, gazete kupürleri ve resmi raporlar gibi her türlü ham ve ampirik birincil kaynak. Dışarıdan akademik literatür barındırmaz, kullanıcının kendi yüklemeleri için ayrılmış boş bir kütüphane rafıdır.",
      "concepts": ["Birincil Kaynaklar", "Mülakat Deşifreleri", "Saha Notları", "Arşiv Belgeleri"],
      "semanticSearchQueries": [
        "primary interview transcripts field notes qualitative survey data historical archives newspaper clippings official policy reports empirical raw data"
      ]
    }
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (YALIN VE DİNAMİK MOTOR)
// ============================================================================
export function buildThesisBoxGenerationPrompt(
  params: {
    studyTitle: string;
    researchQuestion: string;
    mainClaim: string;
    theoreticalFramework: string;
    methodology: string;
    researchScope: string;
  },
  overlapTheses?: {
    id: number;
    title: string;
    author: string;
    axes: { subject: string; theory: string; methodology: string };
  }[],
): string {
  const matrixJson = JSON.stringify(params, null, 2);
  const thesesXml =
    overlapTheses && overlapTheses.length > 0
      ? `\n<tez_adaylari>\n${JSON.stringify(overlapTheses, null, 2)}\n</tez_adaylari>`
      : "\n<tez_adaylari>\n[]\n</tez_adaylari>";

  return `START_THESIS_MATRIX
${matrixJson}
END_THESIS_MATRIX
${thesesXml}

# GÖREV VE TALİMAT
Sistem talimatında tanımlanan esnek ontolojik kutu mimarisine, dil dengesine, DOĞAL EKSEN KURALI, SEMANTİK SORGULARDA JENERİK KUYRUK YASAKLAMA ANAYASASI, SEMANTİK SORGULARDA GİRDİ SADAKATİ KONTROLÜ, ANAHTAR KAVRAMLAR İÇİN TR SIKI KAPSAMLANDIRMA ve AMPİRİK CESARET VE ÖZNE SADAKATİ ilkelerine tam olarak bağlı kalarak yukarıdaki 6 boyutlu matris yapısını analiz et.

<tez_adaylari> etiketi içinde listelenen her bir sınırdaş tezi (id, title, author ve axes bilgileriyle birlikte) incele. Her tezi, konusal içeriği ve örtüşme eksenlerine (subject, theory, methodology) göre en uygun kutuya ata. Bu eşleme, hiçbir tezin boşta kalmaması için zorunludur. Eğer bir tez hiçbir kutuya konusal olarak uymuyorsa, en yakın kutuya yerleştir. Her kutunun mappedThesisIds alanı, o kutuya atanan tezlerin id'lerini içermelidir. Eşleşen tez yoksa mappedThesisIds boş dizi olmalıdır.

1. **Doğal Eksen Uyumu:** Girdideki en baskın karakteristiğe (kronolojik, tematik veya tekli odak) karar ver ve PROBLEMATIZATION kutularını sadece bu eksende böl veya tek kutuda tut. Yapısal çelişki üretme.
2. **Girdi Sadakati ve Saf Vektör Uzayı:** Arama sorgularında (semanticSearchQueries) kesinlikle cümle kurma, edebi bağlaçlar veya jenerik kuyruklar kullanma. Yaratıcılığını sadece matristeki verileri akademik İngilizce kelime/kuramsal entity dizilerine dönüştürmek için kullan. Matriste açıkça geçmeyen harici hiçbir kavramı, alt kırılımı veya tarihsel iddiayı arama sorgularına enjekte etme.
3. **Sıkı Kavram Kapsamı:** concepts dizilerini sadece ilgili kutunun kendi başlığı veya açıklama metninden doğrudan süzerek doldur. Dışarıdan bağımsız etiket uydurma.
4. **Tez Eşleme Zorunluluğu:** <tez_adaylari> listesindeki her tez en az bir kutuya atanmalıdır. mappedThesisIds alanı zorunludur.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
