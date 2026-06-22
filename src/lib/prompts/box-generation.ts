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
              "ANALYSIS_FINDINGS",
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
          semanticSearchBlock: {
            type: "string",
            maxLength: 2000,
            description:
              "OpenAlex ve küresel veritabanlarında semantik aramayı maksimum başarıyla tetikleyecek, en az 3-4 cümlelik akademik İngilizce paragraf. Model, girdi metninde açıkça zikredilmeyen hiçbir harici teorik açılımı, kavramı veya varsayımı bu bloğa ekleyemez.",
          },
          foundationalQueries: {
            type: "array",
            description:
              "Kutunun ele aldığı akademik konuyu veya kuramı kuran, temsil eden en kaliteli ve saygın 2 ila 4 adet kurucu/seminal akademik eserin (kitap, makale vb.) listesi. ANALYSIS_FINDINGS kutusu için bu liste boş olmalıdır.",
            items: {
              type: "object",
              properties: {
                author: {
                  type: "string",
                  description:
                    "Yazarın gerçek tam adı (Örn: 'Michel Foucault').",
                },
                title: {
                  type: "string",
                  description:
                    "Eserin orijinal başlığı (Örn: 'Discipline and Punish').",
                },
                publicationYear: {
                  type: "integer",
                  description: "Eserin yayın yılı (Örn: 1975).",
                },
              },
              required: ["author", "title", "publicationYear"],
            },
          },
        },
        required: [
          "title",
          "boxType",
          "description",
          "concepts",
          "semanticSearchBlock",
          "foundationalQueries",
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
Her bir kutu (CONCEPTUAL, DATA_PROTOCOL, PROBLEMATIZATION), kendi akademik tipolojisi içinde tamamen izole ve bağımsız bir hücre olarak üretilmelidir. Kutuların açıklamaları, kavramları ve semantik blokları asla birbiriyle kesiştirilmemeli, içine diğer kutuların alanına giren sızıntılar (Örn: Yöntem kutusunun içine ampirik konunun/aktörlerin detaylarının sızması; teorik kutunun içine tarihsel/ampirik durumların karışması) kesinlikle eklenmemelidir. Her kutu kendi mikro-evreninde saf kalmalıdır.

# ESNEK ONTOLOJİK RAF MİMARİSİ VE DOĞAL EKSEN KURALI
Girdiyi analiz et. Toplam kutu sayısı tezin ampirik yapısının karmaşıklığına bağlı olarak dinamik olarak belirlenecek ve asla 5 kutuyu geçmeyecektir. Katı bir kutu sayısı dayatma. 

*DOĞAL EKSEN KURALI:* PROBLEMATIZATION kutularının sayısı ve bölünme mantığı tamamen kullanıcı girdisine (THESIS_MATRIX) bağlıdır. Girdideki en baskın yapısal unsuru (belirgin tarihsel dönemler ise "Kronolojik", farklı aktörler/değişkenler ise "Aktör/Tema Bazlı", tek bir odak varsa "Tekli Derinlemesine Analiz") tespit etmeli ve tüm kutuları yalnızca bu tek bir mantık ekseninde üretmelisin. Aynı istek içinde hem kronolojik hem tematik karma bölünme yapılamaz, yapısal kararlılık korunmalıdır.

Şu tipolojik şablonu izle:

KUTU TİPİ 1 — CONCEPTUAL (Teorik Çatı):
- Çalışmanın beslendiği tüm ana kuramsal ekolleri, felsefi tartışmaları ve paradigmaları tek bir teorik şemsiye altında birleştir. Birbirinin içinden türeyen teorileri asla ayrı kutulara bölme.
- SEMANTİK BLOK TAHRİMATI: Bu kutunun "semanticSearchBlock" alanı, OpenAlex vektör uzayında kurucu yazarları ilk sayfaya kilitlemelidir. Bunun için her cümleye doğrudan [Yazarın Tam Adı] ile başla ve hemen ardından o yazarın patentine sahip olduğu [Teknik Marka Kavram]'ı yerleştir (Örn: "David Snow's frame alignment theory" veya "Antonio Gramsci's war of position"). Yerel coğrafi bağlamlardan (ülke adı, bölge, şehir), jenerik geçiş cümlelerinden ve laf kalabalığından %100 arındırılmış, çıplak, yoğun bir kuramsal İngilizce dille yaz.

KUTU TİPİ 2 — PROBLEMATIZATION (Dinamik Ampirik Odaklar):
- Çalışmanın araştırma sorularını ve inceleme nesnesini ampirik/tematik odaklarına göre bağımsız hücrelere ayır.
- **AMPİRİK CESARET VE ÖZNE SADAKATİ:** Tezin asıl öznelerini, spesifik aktörlerini, siyasi hareketleri ve tarihsel özneleri sansürleme, yumuşatma, jenerikleştirme veya korkakça törpüleme. Kutu başlıkları (title) ve açıklamaları (description), tezin ampirik, politik ve tarihsel çıplak gerçeğini doğrudan, cesurca ve net bir şekilde yansıtmalıdır.
- Tezin tarihsel, coğrafi veya konjonktürel bağlamı eğer ikincil akademik literatür (makale/kitap) taranarak incelenecekse, orası ANALYSIS_FINDINGS değil, bir PROBLEMATIZATION kutusudur.

KUTU TİPİ 3 — ANALYSIS_FINDINGS (Saha/Arşiv Ham Veri Havuzu):
- Sadece ve sadece araştırmacının bizzat arşive, sahaya veya dökümanlara girip kendisinin toplayacağı SAF BİRİNCİL VERİ / HAM ARŞİV alanıdır. İkincil akademik literatür barındırmaz.

KUTU TİPİ 4 — DATA_PROTOCOL (Metodoloji ve Yöntem):
- Çalışmada kullanılan veri toplama ve analiz yöntemini (Nitel, Nicel, Karma, Arşiv vb.) uluslararası literatürde karşılığı olan duru ve net tarama terimleriyle tanımla.

# SEMANTİK BLOKLARDA GİRDİ SADAKATİ KONTROLÜ
"semanticSearchBlock" alanları oluşturulurken, yalnızca ve kesinlikle kullanıcı tarafından sağlanan girdi matrisindeki (THESIS_MATRIX) kavramlar, teoriler, yöntemler, aktörler ve iddialar temel alınmalıdır. Model, girdi metninde açıkça zikredilmeyen hiçbir tarihsel veya güncel olayı, dışsal kuramsal açılımı, varsayımı veya yan kavramı bu bloklara ekleyemez. Metin zenginleştirme, sadece girdideki unsurların birbirleriyle olan ilişkisini yüksek düzeyli akademik İngilizce ile formüle etmekle sınırlıdır.

# ANAHTAR KAVRAMLAR İÇİN SIKI KAPSAMLANDIRMA (STRICT SCOPING)
"concepts" dizisi serbest bir çağrışım veya tahmin alanı değildir. Bu alana yazılacak kavramlar için kurallar:
1. Yazılan kavramlar kesinlikle ve yalnızca o kutunun kendi "title" veya "description" alanında geçen kelimelerden türetilmelidir.
2. CONCEPTUAL kutusundaki kavramlar sadece teorik/kuramsal soyut terimleri içermelidir.
3. PROBLEMATIZATION kutusundaki kavramlar sadece tezin ampirik öznelerini, mekânlarını, ilişkisel eksenlerini veya tarihsel dönemlerini içermelidir. Dışarıdan jenerik etiket veya eşanlamlı türetilemez.

# KURUCU ESER (FOUNDATIONAL QUERIES) ÜRETİM KURALLARI
Her bir kutunun (ANALYSIS_FINDINGS hariç), o kutunun kuramsal, yöntemsel veya ampirik odağına karşılık gelen, kendi gerçek parametrik hafızanda yer alan en kaliteli, saygın ve kurucu (seminal) 2 ila 4 akademik eseri (kitap veya hakemli makale) tespit et ve "foundationalQueries" alanı altında listele.
1. KATI UYDURMA YASAĞI: Tamamen gerçek, doğrulanmış ve akademik literatürde fiilen mevcut olan eserleri yazmalısın. Olmayan yazarları veya uydurma kitap/makale başlıklarını kesinlikle üretme. Eserin yayın yılını da doğru şekilde tespit edip sayısal (integer) olarak yaz.
2. PRESTİJLİ KAYNAKLAR: YouTube videoları, sığ biyografiler, genel medya içeriklerini filtrele. Sadece saygın akademik kitap, kitap bölümü, tez ve hakemli dergi makalelerini kabul et.
3. KATI İZOLASYON VE SIZMA YASAĞI: Kutunun kendi izole sınırlarına (title, boxType, description) uymayan, araya sızmış tüm harici makaleleri/kitapları kesinlikle reddet. Yöntem kutusuna sızan ampirik eserleri veya teorik kutuya sızan tarihsel durumları doğrudan ele. Her kutu sadece kendi tanımlı akademik sınırları dahilinde kalmalıdır.
4. KAPASİTE VE SINIR: Konu kutusu başına en az 2, en fazla 4 adet kurucu akademik eser döndür (ANALYSIS_FINDINGS için boş dizi [] dönmelidir).

# OPERASYONEL İLKELER VE DİL KURALLARI
1. DİL DENGESİ (SIFIR TOLERANS — KRİTİK KURAL):
- "title" alanı KESİNLİKLE, ASLA, HİÇBİR KOŞULDA İNGİLİZCE OLAMAZ. Kuramsal kavram evrensel düzeyde İnovatif literatüre ait olsa bile, başlık saf Türkçe akademik dille üretilmelidir. (Örn: 'Gramscici Hegemonya ve Toplumsal Hareket Çerçevelemesi'). Bu kuralın tek bir istisnası dahi yoktur.
- "description" ve "concepts" alanları da KESİNLİKLE TÜRKÇE olmalıdır.
- "semanticSearchBlock" alanı KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.
2. CONCEPTUAL SEMANTİK BLOK TAHRİMATI: CONCEPTUAL kutusunun "semanticSearchBlock" alanı, her cümleye doğrudan [Kurucu Yazar Tam Adı] ile başlayarak ve hemen ardından o yazarın patentine sahip olduğu [Teknik Marka Kavram]'ı yerleştirerek üretilmelidir (Örn: "Michel Foucault's governmentality framework" veya "David Snow's frame alignment theory"). Yerel coğrafi bağlam, ülke adı, jenerik geçiş cümleleri ve laf kalabalığı %100 yasaktır. Diğer kutu tiplerinin (PROBLEMATIZATION) semantik blokları, arama motorlarının boğulmaması için tezin gerçek öznelerini, aktörlerini ve yıllarını içeren konsantre narrative abstract formatında yazılmalıdır.

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
      "semanticSearchBlock": "Michel Foucault's governmentality framework redefines power as a decentralized network of disciplinary mechanisms that operate through the conduct of conduct. Maurizio Lazzarato's theory of the indebted man positions debt as a constitutive power relation that governs economic subjects through obligation and repayment. Karl Marx's reproduction theory provides the structural backbone for understanding how financial mechanisms extract value from social reproduction. Integrating Foucauldian subjectification with Marxist class analysis reveals how micro-level power mechanisms produce economic subjects who internalize and reproduce the debt condition.",
      "foundationalQueries": [
        {
          "author": "Michel Foucault",
          "title": "Discipline and Punish: The Birth of the Prison",
          "publicationYear": 1975
        },
        {
          "author": "Maurizio Lazzarato",
          "title": "The Making of the Indebted Man",
          "publicationYear": 2011
        },
        {
          "author": "Karl Marx",
          "title": "Capital: A Critique of Political Economy",
          "publicationYear": 1867
        }
      ]
    },
    {
      "title": "Neoliberal Finansallaşma ve Türkiye'de Borçluluk Rejimi",
      "boxType": "PROBLEMATIZATION",
      "description": "Tezin tarihsel ve coğrafi bağlamını oluşturan Türkiye'nin neoliberal finansallaşma dalgaları, borçlandırma mekanizmaları ve emekçi sınıfların borçluluk deneyimini ikincil akademik literatür üzerinden inceleyen analitik çerçeve.",
      "concepts": ["Türkiye Finansallaşması", "Borçluluk Rejimi", "Bağlamsal Analiz", "Neoliberal Dönüşüm"],
      "semanticSearchBlock": "The trajectory of neoliberal transformation and economic financialization in Turkey has established a distinctive regime of household and working-class indebtedness. Macroeconomic shifts, recurrent structural crises, and state-led financial inclusion policies have systematically driven laboring populations into institutional debt markets. Exploring this national context through secondary economic history literature provides critical insights into how localized financial patterns interact with structural labor market flexibilization.",
      "foundationalQueries": [
        {
          "author": "Galip Yalman",
          "title": "Transition to Neoliberalism in Turkey",
          "publicationYear": 2009
        },
        {
          "author": "Korkut Boratav",
          "title": "Türkiye İktisat Tarihi 1908-2009",
          "publicationYear": 2010
        }
      ]
    },
    {
      "title": "Mülakat Deşifreleri ve Alan Çalışması Ham Veri Havuzu",
      "boxType": "ANALYSIS_FINDINGS",
      "description": "Araştırmacının sahada borçlu bireylerle yaptığı derinlemesine mülakatlardan elde edilen ham veriler, deşifre metinleri, saha notları ve gözlem kayıtları. İkincil literatür içermez.",
      "concepts": ["Saha Verisi", "Mülakat Deşifreleri", "Ham Arşiv", "Ampirik Malzeme"],
      "semanticSearchBlock": "Primary interview transcripts and fieldwork documentation collected through semi-structured interviews with indebted working-class individuals. Raw empirical data including audio recordings, verbatim transcriptions, field notes, and observational records from the research process. This archive constitutes the foundational empirical material for analyzing subjective experiences of debt and financial precarity.",
      "foundationalQueries": []
    }
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (YALIN VE DİNAMİK MOTOR)
// ============================================================================
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}): string {
  const matrixJson = JSON.stringify(
    {
      studyTitle: params.studyTitle,
      researchQuestion: params.researchQuestion,
      mainClaim: params.mainClaim,
      theoreticalFramework: params.theoreticalFramework,
      methodology: params.methodology,
      researchScope: params.researchScope,
    },
    null,
    2,
  );

  return `START_THESIS_MATRIX
${matrixJson}
END_THESIS_MATRIX

# GÖREV VE TALİMAT
Sistem talimatında tanımlanan esnek ontolojik kutu mimarisine, dil dengesine, **DOĞAL EKSEN KURALI**, **SEMANTİK BLOKLARDA GİRDİ SADAKATİ KONTROLÜ**, **ANAHTAR KAVRAMLAR İÇ TR SIKI KAPSAMLANDIRMA** ve **AMPİRİK CESARET VE ÖZNE SADAKATİ** ilkelerine tam olarak bağlı kalarak yukarıdaki 6 boyutlu matris yapısını analiz et.

1. **Doğal Eksen Uyumu:** Girdideki en baskın karakteristiğe (kronolojik, tematik veya tekli odak) karar ver ve PROBLEMATIZATION kutularını sadece bu eksende böl veya tek kutuda tut. Yapısal çelişki üretme.
2. **Girdi Sadakati:** Arama bloklarında (semanticSearchBlock) yaratıcılığını sadece akademik İngilizce sentezi için kullan. Matriste açıkça geçmeyen harici hiçbir kavramı, alt kırılımı veya tarihsel iddiayı arama bloklarına enjekte etme.
3. **Sıkı Kavram Kapsamı:** "concepts" dizilerini sadece ilgili kutunun kendi başlığı veya açıklama metninden doğrudan süzerek doldur. Dışarıdan bağımsız etiket uydurma.
4. **Kurucu Eserler:** ANALYSIS_FINDINGS hariç her kutu için hafızandan doğrulanmış 2 ila 4 seminal akademik eser (foundationalQueries) ekle.

Çıktı olarak sadece ve sadece tanımlanan şemaya %100 uygun, markdown içermeyen saf JSON nesnesini döndür.

# TÜRKÇE BAŞLIK ZORUNLULUĞU (KESİN KURAL — ASLA İHLAL EDİLEMEZ)
Her bir kutunun "title" alanı, içerdiği kuramsal kavram veya yöntem hangi dilde literatüre ait olursa olsun, TAMAMEN TÜRKÇE AKADEMİK DİLLE yazılmak ZORUNDADIR. Örneğin "Antonio Gramsci's War of Position" yazmak yerine "Antonio Gramsci'nin Mevzi Savaşı Kavramı" yazmalısın. "title" alanında en ufak bir İngilizce ifade, kelime veya terim dahi bulunması, üretilen çıktının tamamen reddedilmesine yol açar. Bu kuralın hiçbir istisnası yoktur.`;
}
