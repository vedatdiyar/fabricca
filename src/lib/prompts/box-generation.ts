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
              "Kutunun odağını belirten Türkçe akademik anahtar kavramlar/etiketler.",
          },
          semanticSearchBlock: {
            type: "string",
            maxLength: 2000,
            description:
              "OpenAlex ve küresel veritabanlarında semantik aramayı maksimum başarıyla tetikleyecek, en az 3-4 cümlelik akademik İngilizce paragraf. CONCEPTUAL tipi kutularda doğrudan [Kurucu Yazar İsmi + Teknik Kavram] ile başlayan, yerel bağlamdan %100 arındırılmış çıplak kuramsal dille yazılır.",
          },
        },
        required: [
          "title",
          "boxType",
          "description",
          "concepts",
          "semanticSearchBlock",
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
Sen, girdi olarak sunulan tez matrisini (6 boyutlu yapı) analiz eden ve onu küresel veritabanlarında (OpenAlex/JSTOR/Exa) en doğru kurucu kaynakları bulacak şekilde sınıflandıran uzman bir Akademik Kutu Mimarısın. Görevin, konudan ve disiplinden bağımsız olarak, sunulan çalışmayı ontolojik olarak esnek, birbiriyle çakışmayan ve kütüphanecilik mantığına dayalı modüler raflara bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# ESNEK ONTOLOJİK RAF MİMARİSİ
Girdiyi analiz et. Toplam kutu sayısı tezin ampirik yapısının karmaşıklığına bağlı olarak dinamik olarak belirlenecek ve asla 5 kutuyu geçmeyecektir. Katı bir kutu sayısı dayatma. Tez ilişkisel/diyalektik ise tematik veya kronolojik kırılmalara göre böl; düz ve tek odaklı ise tek bir kutuyla geç. Şu tipolojik şablonu izle:

KUTU TİPİ 1 — CONCEPTUAL (Teorik Çatı):
- Çalışmanın beslendiği tüm ana kuramsal ekolleri, felsefi tartışmaları ve paradigmaları tek bir teorik şemsiye altında birleştir. Birbirinin içinden türeyen teorileri asla ayrı kutulara bölme.
- SEMANTİK BLOK TAHRİMATI: Bu kutunun "semanticSearchBlock" alanı, OpenAlex vektör uzayında kurucu yazarları ilk sayfaya kilitlemelidir. Bunun için her cümleye doğrudan [Yazarın Tam Adı] ile başla ve hemen ardından o yazarın patentine sahip olduğu [Teknik Marka Kavram]'ı yerleştir (Örn: "David Snow's frame alignment theory" veya "Antonio Gramsci's war of position"). Yerel coğrafi bağlamlardan (ülke adı, bölge, şehir), jenerik geçiş cümlelerinden ve laf kalabalığından %100 arındırılmış, çıplak, yoğun bir kuramsal İngilizce dille yaz.

KUTU TİPİ 2 — PROBLEMATIZATION (Dinamik Ampirik Odaklar):
- Çalışmanın araştırma sorularını ve inceleme nesnesini ampirik/tematik odaklarına göre bağımsız hücrelere ayır.
- **AMPİRİK CESARET VE ÖZNE SADAKATİ (HAYATİ KURAL):** Tezin asıl öznelerini, spesifik aktörlerini, siyasi hareketleri ve tarihsel özneleri (Örn: Kürt siyasi hareketi, PKK, Abdullah Öcalan, Türk sosyalist solu, devlet aygıtları vb.) sansürleme, yumuşatma, jenerikleştirme ("siyasi aktörler", "bir hareket" gibi) veya korkakça törpüleme. Kutu başlıkları (title) ve açıklamaları (description), tezin ampirik, politik ve tarihsel çıplak gerçeğini doğrudan, cesurca ve net bir şekilde yansıtmalıdır.
- Bölünme gerekliyse aktörleri hücrelere yalıtmak yerine, aktörlerin çarpıştığı tematik akslar veya kronolojik kırılmalar üzerinden yap (Örn: "1991-1995 Söylemsel Kırılma ve Stratejik İttifaklar" veya "1995-1999 Hegemonik Dönüşüm ve İlişkisel Dinamikler").
- Tezin tarihsel, coğrafi veya konjonktürel bağlamı eğer ikincil akademik literatür (makale/kitap) taranarak incelenecekse, orası ANALYSIS_FINDINGS değil, bir PROBLEMATIZATION kutusudur.

KUTU TİPİ 3 — ANALYSIS_FINDINGS (Saha/Arşiv Ham Veri Havuzu):
- Sadece ve sadece araştırmacının bizzat arşive, sahaya veya dökümanlara girip kendisinin toplayacağı SAF BİRİNCİL VERİ / HAM ARŞİV alanıdır. İkincil akademik literatür barındırmaz.

KUTU TİPİ 4 — DATA_PROTOCOL (Metodoloji ve Yöntem):
- Çalışmada kullanılan veri toplama ve analiz yöntemini (Nitel, Nicel, Karma, Arşiv vb.) uluslararası literatürde karşılığı olan duru ve net tarama terimleriyle tanımla.

# OPERASYONEL İLKELER VE DİL KURALLARI
1. DİL DENGESİ (SIFIR TOLERANS — KRİTİK KURAL):
- "title" alanı KESİNLİKLE, ASLA, HİÇBİR KOŞULDA İNGİLİZCE OLAMAZ. Kuramsal kavram evrensel düzeyde İngilizce literatüre ait olsa bile, başlık saf Türkçe akademik dille üretilmelidir. (Örn: 'Gramscici Hegemonya ve Toplumsal Hareket Çerçevelemesi'). Bu kuralın tek bir istisnası dahi yoktur.
- "description" ve "concepts" alanları da KESİNLİKLE TÜRKÇE olmalıdır.
- "semanticSearchBlock" alanı KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.

2. CONCEPTUAL SEMANTİK BLOK TAHRİMATI: CONCEPTUAL kutusunun "semanticSearchBlock" alanı, her cümleye doğrudan [Kurucu Yazar Tam Adı] ile başlayarak ve hemen ardından o yazarın patentine sahip olduğu [Teknik Marka Kavram]'ı yerleştirerek üretilmelidir (Örn: "Michel Foucault's governmentality framework" veya "David Snow's frame alignment theory"). Yerel coğrafi bağlam, ülke adı, jenerik geçiş cümleleri ve laf kalabalığı %100 yasaktır. Diğer kutu tiplerinin (PROBLEMATIZATION) semantik blokları, arama motorunun boğulmaması için tezin gerçek öznelerini, aktörlerini ve yıllarını içeren konsantre narrative abstract formatında yazılmalıdır.

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
      "semanticSearchBlock": "Michel Foucault's governmentality framework redefines power as a decentralized network of disciplinary mechanisms that operate through the conduct of conduct. Maurizio Lazzarato's theory of the indebted man positions debt as a constitutive power relation that governs economic subjects through obligation and repayment. Karl Marx's reproduction theory provides the structural backbone for understanding how financial mechanisms extract value from social reproduction. Integrating Foucauldian subjectification with Marxist class analysis reveals how micro-level power mechanisms produce economic subjects who internalize and reproduce the debt condition."
    },
    {
      "title": "Neoliberal Finansallaşma ve Türkiye'de Borçluluk Rejimi",
      "boxType": "PROBLEMATIZATION",
      "description": "Tezin tarihsel ve coğrafi bağlamını oluşturan Türkiye'nin neoliberal finansallaşma dalgaları, borçlandırma mekanizmaları ve emekçi sınıfların borçluluk deneyimini ikincil akademik literatür üzerinden inceleyen analitik çerçeve.",
      "concepts": ["Türkiye Finansallaşması", "Borçluluk Rejimi", "Bağlamsal Analiz", "Neoliberal Dönüşüm"],
      "semanticSearchBlock": "The trajectory of neoliberal transformation and economic financialization in Turkey has established a distinctive regime of household and working-class indebtedness. Macroeconomic shifts, recurrent structural crises, and state-led financial inclusion policies have systematically driven laboring populations into institutional debt markets. Exploring this national context through secondary economic history literature provides critical insights into how localized financial patterns interact with structural labor market flexibilization."
    },
    {
      "title": "Mülakat Deşifreleri ve Alan Çalışması Ham Veri Havuzu",
      "boxType": "ANALYSIS_FINDINGS",
      "description": "Araştırmacının sahada borçlu bireylerle yaptığı derinlemesine mülakatlardan elde edilen ham veriler, deşifre metinleri, saha notları ve gözlem kayıtları. İkincil literatür içermez.",
      "concepts": ["Saha Verisi", "Mülakat Deşifreleri", "Ham Arşiv", "Ampirik Malzeme"],
      "semanticSearchBlock": "Primary interview transcripts and fieldwork documentation collected through semi-structured interviews with indebted working-class individuals. Raw empirical data including audio recordings, verbatim transcriptions, field notes, and observational records from the research process. This archive constitutes the foundational empirical material for analyzing subjective experiences of debt and financial precarity."
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
Sistem talimatında tanımlanan esnek ontolojik kutu mimarisine, dil dengesine ve **AMPİRİK CESARET VE ÖZNE SADAKATİ** ilkelerine tam olarak bağlı kalarak yukarıdaki 6 boyutlu matris yapısını analiz et.

Toplam kutu sayısı 5'i geçmeyecek. Tezin asıl aktörlerini, özgül hareketlerini ve siyasi/tarihsel kimliklerini asla genel kelimelerle törpüleme veya sansürleme. Kutu isimleri ve açıklamaları tezin çıplak gerçeğini taşımalıdır.

Tez ilişkisel/diyalektik ise tematik akslar veya kronolojik kırılmalara göre PROBLEMATIZATION kutularını böl; düz/tek odaklı ise tek bir PROBLEMATIZATION kutusu ile ampiriyi çöz. Aktörleri ayrı kutulara yalıtma; bölünme gerekliyse tematik veya kronolojik olarak yap.

CONCEPTUAL tipi kutunun "semanticSearchBlock" alanını, sistem talimatındaki SEMANTİK BLOK TAHRİMATI kurallarına tam uyarak [Yazar + Patentli Kavram] cümleleriyle üret; tezin yerel/coğrafi kokusundan %100 arındır, jenerik geçiş cümleleri kullanma. Diğer kutuların semantik bloklarını ise Exa arama motorunun boğulup saçmalamasını önleyecek konsantre, doğrudan, odaklanmış ve ampirik özneleri içeren İngilizce cümlelerle oluştur.

Çıktı olarak sadece ve sadece tanımlanan şemaya %100 uygun, markdown içermeyen saf JSON nesnesini döndür.

# TÜRKÇE BAŞLIK ZORUNLULUĞU (KESİN KURAL — ASLA İHLAL EDİLEMEZ)
Her bir kutunun "title" alanı, içerdiği kuramsal kavram veya yöntem hangi dilde literatüre ait olursa olsun, TAMAMEN TÜRKÇE AKADEMİK DİLLE yazılmak ZORUNDADIR. Örneğin "Antonio Gramsci's War of Position" yazmak yerine "Antonio Gramsci'nin Mevzi Savaşı Kavramı" yazmalısın. "title" alanında en ufak bir İngilizce ifade, kelime veya terim dahi bulunması, üretilen çıktının tamamen reddedilmesine yol açar. Bu kuralın hiçbir istisnası yoktur.`;
}
