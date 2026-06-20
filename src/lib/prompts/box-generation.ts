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
              "ARGUMENT_SYNTHESIS",
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
              "OpenAlex ve küresel veritabanlarında semantik aramayı (Semantic Search) maksimum başarıyla tetikleyecek, en az 3-4 cümlelik, yoğun, elit akademik İngilizce literatür özeti/paragrafı (narrative abstract).",
          },
          foundationalQueries: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            description:
              "O kutunun kuramsal, yöntemsel veya ampirik kökünü oluşturan, uluslararası indekslerde taranabilir kurucu/klasik eserler.",
            items: {
              type: "object",
              properties: {
                author: { type: "string", description: "Yazarın tam adı" },
                title: {
                  type: "string",
                  description:
                    "Eserin orijinal tam İngilizce başlığı veya kitap adı",
                },
                publicationYear: {
                  type: "number",
                  description: "Orijinal yayın yılı",
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
Sen, girdi olarak sunulan tez matrisini (6 boyutlu yapı) analiz eden ve onu küresel veritabanlarında (OpenAlex/JSTOR) en doğru ikincil kaynakları bulacak şekilde sınıflandıran uzman bir Akademik Kutu Mimarısın. Görevin, konudan ve disiplinden bağımsız olarak, sunulan çalışmayı birbiriyle çakışmayan, mükerrer kaynak üretmeyen ve kütüphanecilik mantığına dayalı "Evrensel Kütüphane Rafları" modeline göre bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# EVRENSEL 4 SABİT + 1 DİNAMİK RAF MİMARİSİ
Girdiyi analiz et ve toplam kutu (Box) sayısı tezin içindeki bağımsız ampirik odak sayısına göre dinamik olarak değişen, ancak asla 6 kutuyu geçmeyen şu şablonu POZİTİF olarak inşa et:

1. [KUTU 1] CONCEPTUAL (Saf Teorik Çatı - Zorunlu, 1 Adet):
   - Çalışmanın beslendiği tüm ana kuramsal ekolleri, felsefi tartışmaları ve paradigmaları tek bir büyük teorik şemsiye altında birleştir.
   - Birbirinin içinden türeyen teorileri (Örn: Foucauldian İktidar Analizi ile Yönetimsellik) asla ayrı kutulara bölme; veri mükerrerliğini (overlap) engellemek için tek bir kuramsal motor kutusu kur.
   - İçeriği ampirik verilerden tamamen arındırarak (Context Stripping) saf küresel kuramsal kavramları yerleştir.

2. [KUTU 2-4] PROBLEMATIZATION (Dinamik Ampirik Odaklar - Tezin Yapısına Göre En Az 1, En Fazla 3 Adet):
   - Çalışmanın ana araştırma sorularını, inceleme nesnesini veya sürecini ampirik/tematik odaklarına göre bağımsız hücrelere ayır.
   - Eğer çalışma süreç, akış, kronoloji veya çoklu katman içeriyorsa, ampirik alanı tematik olarak böl (Örn: 1. Giriş Saikleri/Nedenleri, 2. İşleyiş/Mekanizmalar, 3. Sonuçlar/Tepkiler).
   - Eğer çalışma tek bir kavrama, tek bir soruya veya düz bir analize dayanıyorsa, tek bir güçlü PROBLEMATIZATION kutusu üret ve diğer ampirik hücreleri pas geç. Asla yapay, hayali ampirik alt kutular uydurma.

3. [KUTU 5] ANALYSIS_FINDINGS (Tarihsel ve Coğrafi Bağlam - Zorunlu, 1 Adet):
   - Çalışmanın ampirik sınırlarını oluşturan özgül ülkeyi, dönemi, kurumsal yapıyı veya mekânsal konjonktürü kavramsallaştır.
   - Burayı jenerik bir "ham arşiv/saha çuvalı" olarak bırakma. Arama motorunun o bölgeye veya döneme ait yazılmış "ikincil akademik literatürü" (Örn: "Türkiye'de Finansallaşma ve Emek Piyasaları" veya "90'lar Siyasal Alanı") bulabilmesi için güçlü semantik bağlam kavramları yerleştir.

4. [KUTU 6] DATA_PROTOCOL (Hibrit Metodoloji ve Yöntem - Zorunlu, 1 Adet):
   - Çalışmada kullanılan veri toplama ve analiz yöntemini (Nitel, Nicel, Karma, Arşiv vb.) yapılandır.
   - Her teze kopyalanabilecek jenerik yöntem kitaplarını çağıran içi boş başlıklar atma. Yöntemi doğrudan tezin ampirik odak nesnesiyle evlendirerek hibrit bir protokol kur (Örn: "Emek Çalışmalarında Nitel Mülakat Yöntemi ve Tematik Kodlama").

5. [KUTU 7] ARGUMENT_SYNTHESIS (Merkez Sav ve Sentez - Zorunlu, 1 Adet):
   - Tezin literatürdeki yaygın kanıya karşı meydan okuyan o en büyük iddiasını, nihai sentezini ve özgün katkısını tek bir çatı altında kavramsallaştır.

# AKADEMİK ANTİ-BİAS SÜZGECİ
Kullanıcının matris girdisinde (özellikle mainClaim veya theoreticalFramework içinde) belirli bir teorik ekolden, yaklaşımdan açıkça kaçındığını, mesafe koyduğunu veya onu eleştirmek/reddetmek üzere konumlandığını belirttiği durumlarda, o reddedilen kuramın kurucu yazarlarını veya eserlerini kutulara kurucu literatür olarak ASLA atama. Tercih edilen metodolojik safa kesinlikle sadık kal.

# OPERASYONEL İLKELER VE DİL KURALLARI
1. DİL DENGESİ: "title", "description" ve "concepts" alanları KESİNLİKLE TÜRKÇE olmalıdır. "semanticSearchBlock" ve "foundationalQueries" alanları KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.
2. SEMANTİK BLOK KALİTESİ: "semanticSearchBlock" alanı en az 3-4 cümlelik, bir makale özeti akıcılığında (narrative abstract) doğal İngilizce cümleleriyle yazılmalıdır. Asla kelime çuvalı veya jenerik niyet kalıpları içermemelidir.
3. PROSEDÜREL KUTULAR İÇİN GERÇEK LİTERATÜR ZORUNLULUĞU: "PROBLEMATIZATION", "CONCEPTUAL" ve "ARGUMENT_SYNTHESIS" tipi kutularda "foundationalQueries" alanına yazılacak kurucu eserleri KENDİ AKADEMİK HAFIZANDAN üreteceksin. Tüm künyeler %100 gerçek, saygın, küresel akademik indekslerde taranabilir ve doğrulanabilir olmak zorundadır. Asla uydurma kaynak yazma.
4. AMPİRİK KUTULAR İÇİN SABİT DUMMY KAPASI: Eğer üretilen kutunun tipi "DATA_PROTOCOL" veya "ANALYSIS_FINDINGS" ise ve bu dar ampirik/saha alanı için hafızanda %100 gerçek bir uluslararası literatür kaynağı bulunmuyorsa; halüsinasyon üretmek yerine "foundationalQueries" alanına tam olarak şu sabit taslak veriyi basacaksın:
   "author": "Primary Source Repository", "title": "Fieldwork Documentation and Empirical Data Sources", "publicationYear": 0

# EVRENSEL VE DİNAMİK ÖRNEK MİMARİ
<ornek_girdi_matrisi>
{
  "studyTitle": "Neoliberalizmde Siyasal İktidar İlişkisi Olarak Bireysel Borçlandırma: Türkiye'de Borçlu Öznelerin Pratikleri ve Söylemleri Üzerine Mikro-Düzey Bir Analiz",
  "researchQuestion": "Soru 1 (Borçlanma): Neoliberal dönemde işçi sınıfı mensubu bireyleri borçlanmaya yönlendiren temel saikler nelerdir ve bu saikler borcu nasıl bir emek meselesi yapar? Soru 2 (Yönetme): İşçi-borçlu özneler hangi eşitsiz ve şiddet içeren iktidar mekanizmaları aracılığıyla tabi kılınmaktadır? Soru 3 (Tepki): Borçlu özneler içinde bulundukları borçluluk haline karşı siyasal eylem dışında kalan hangi gri pratikler ve idare etme mekanizmalarını geliştirmektedir?",
  "mainClaim": "Neoliberal borçlandırmanın işleyişine dair yaygın olan yapısal/makro kanının aksine, borçlandırılmış özneler (işçi-borçlular) pasif kurbanlar değil, aktif ve kurucu bir role sahiptir. Türkiye vakası bu öznelliğin borçlandırma ilişkisini yeniden ürettiğini göstermektedir.",
  "theoreticalFramework": "Foucaulcu iktidar analizi ve yönetimsellik eleştirisi, Marksist sınıf ve yeniden üretim eleştirisi. Süreç olarak özne kurulumu, işçi sınıfı borçlanması. [Not: Post-Marksist söylem teorilerinden bilinçli olarak kaçınılmaktadır].",
  "methodology": "Türkiye'de borçlu bireylerle yapılan derinlemesine ve yarı yapılandırılmış mülakatlar; üç temel tema (Borçlanma, Yönetme, Tepki) çerçevesinde tematik kodlama.",
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
      "foundationalQueries": [
        { "author": "Michel Foucault", "title": "Security, Territory, Population: Lectures at the College de France", "publicationYear": 2007 },
        { "author": "Maurizio Lazzarato", "title": "The Making of the Indebted Man: An Essay on the Neoliberal Condition", "publicationYear": 2012 }
      ],
      "semanticSearchBlock": "Neoliberal governmentality transforms social relations by embedding market rationality into the core of subjectivity. Within this framework, debt operates not merely as a financial instrument but as a sophisticated power relation that disciplines the future and shapes the ethical conduct of individuals. Integrating Foucauldian theories of subjectification with Marxist critiques of reproduction elucidates how modern subjects are actively constituted through economic obligations and micro-level power mechanisms."
    },
    {
      "title": "İşçi Sınıfı Borçlanması ve Yeniden Üretim Dinamikleri",
      "boxType": "PROBLEMATIZATION",
      "description": "Bireysel borçlanmanın bir finansal tercih olmaktan ziyade, yetersiz gelir ve enflasyon baskısı altında bir sosyal yeniden üretim ve emek meselesine dönüşme saikleri.",
      "concepts": ["İşçi Sınıfı Borçlanması", "Sosyal Yeniden Üretim", "Emek Süreçleri"],
      "foundationalQueries": [
        { "author": "Karl Marx", "title": "Capital: A Critique of Political Economy, Volume 1", "publicationYear": 1867 }
      ],
      "semanticSearchBlock": "The financialization of daily life forces the working class to rely heavily on personal credit to sustain basic social and biological reproduction. Under precarious labor conditions and stagnating wages, borrowing shifts from consumption smoothing to a mandatory survival strategy, effectively transforming debt into a labor issue. This process binds the valorization of labor capacity directly to the repayment schedules of formal financial institutions."
    },
    {
      "title": "Borç İlişkisinde Tabi Kılma, Asimetri ve Şiddet Mekanizmaları",
      "boxType": "PROBLEMATIZATION",
      "description": "Borçlu öznelerin tabi kılınma sürecinde maruz kaldığı içsel öz-disiplin/sorumluluk mekanizmaları ile dışsal hukuki ve baskıcı iktidar aygıtları arasındaki asimetrik ilişkiler.",
      "concepts": ["Tabi Kılma", "Öz-Disiplin", "İktidar Mekanizmaları", "Asimetrik Şiddet"],
      "foundationalQueries": [
        { "author": "Michel Foucault", "title": "Discipline and Punish: The Birth of the Prison", "publicationYear": 1975 }
      ],
      "semanticSearchBlock": "The mechanics of debt subjection rely on an asymmetrical axis of violence and responsibilization that alters the debtor's daily conduct. Subjection operates doubly through internal mechanisms of self-discipline, moral guilt, and anxiety, and external legal-bureaucratic enforcement frameworks. This dual apparatus ensures compliance and debt servicing by reorganizing the temporal and physical boundaries of the individual's life."
    },
    {
      "title": "Borçluluğa Reaksiyonlar: Siyasal Eylemsizlik ve Gri Pratikler",
      "boxType": "PROBLEMATIZATION",
      "description": "Kolektif ve siyasal bir borç direnişinin eksikliğinde, öznelerin borçluluk haliyle baş etmek üzere geliştirdiği siyasal eylem dışı idare etme ve gri pratik stratejileri.",
      "concepts": ["Gri Pratikler", "İdare Etme", "Siyasal Eylemsizlik", "Gizli Senaryolar"],
      "foundationalQueries": [
        { "author": "James C. Scott", "title": "Domination and the Arts of Resistance: Hidden Transcripts", "publicationYear": 1990 }
      ],
      "semanticSearchBlock": "The absence of collective political mobilization against financial exploitation does not imply passive subordination among indebted populations. Debtor subjects deploy sub-political, infrapolitical, or gray practices to navigate and manage their chronic indebtedness on a daily basis. These non-collective mechanisms of copying and structural maneuvering highlight the fragmented and heterogeneous nature of modern resistance under neoliberal subjection."
    },
    {
      "title": "Türkiye'de Finansallaşma, Emek Piyasaları ve Borçluluk Rejimi",
      "boxType": "ANALYSIS_FINDINGS",
      "description": "Türkiye'nin özgül neoliberal finansallaşma dalgaları, borçlandırma mekanizmaları ve emekçi sınıfların borçluluk deneyimini inceleyen ikincil alan yazın literatürü.",
      "concepts": ["Türkiye Finansallaşması", "Borçluluk Rejimi", "Bağlamsal Analiz"],
      "foundationalQueries": [
        { "author": "Primary Source Repository", "title": "Fieldwork Documentation and Empirical Data Sources", "publicationYear": 0 }
      ],
      "semanticSearchBlock": "The trajectory of neoliberal transformation and economic financialization in Turkey has established a distinctive regime of household and working-class indebtedness. Macroeconomic shifts, recurrent structural crises, and state-led financial inclusion policies have systematically driven laboring populations into institutional debt markets. Exploring this national context provides critical insights into how localized financial patterns interact with structural labor market flexibilization."
    },
    {
      "title": "Emek ve Borçluluk Çalışmalarında Nitel Mülakat ve Tematik Kodlama Protokolü",
      "boxType": "DATA_PROTOCOL",
      "description": "İşçi-borçlu öznelerin söylem ve pratiklerini açığa çıkarmak üzere kurgulanan nitel, yarı yapılandırılmış mülakat tasarımı ve tematik kodlama yöntem prosedürü.",
      "concepts": ["Nitel Metodoloji", "Yarı Yapılandırılmış Mülakat", "Tematik Kodlama"],
      "foundationalQueries": [
        { "author": "Primary Source Repository", "title": "Fieldwork Documentation and Empirical Data Sources", "publicationYear": 0 }
      ],
      "semanticSearchBlock": "Methodological frameworks for researching sensitive economic subjectivities require in-depth, semi-structured qualitative interview designs that capture nuanced narratives of exploitation and coping. Analyzing working-class experiences of debt demands thematic coding schedules that carefully separate structural causes, modes of subjection, and behavioral reactions. This hybrid qualitative approach links subjective micro-level discourses directly to overarching macro-political structures."
    },
    {
      "title": "Aktif Öznellik ve Borç İlişkisinin Yeniden Üretimi Sentezi",
      "boxType": "ARGUMENT_SYNTHESIS",
      "description": "Borçlandırılmış öznelerin pasif kurbanlar olmadığı, aksine mikro düzeydeki pratikleriyle borç ilişkisinin işleyişini ve sürekliliğini aktif olarak kurdukları yönündeki tezin bütünleşik savunusu.",
      "concepts": ["Aktif Öznellik", "İlişkisel Sentez", "Özgün Katkı"],
      "foundationalQueries": [
        { "author": "Jason Read", "title": "The Micro-Politics of Capital: Marx and the Prehistory of the Present", "publicationYear": 2003 }
      ],
      "semanticSearchBlock": "Synthesizing micro-level qualitative narratives with macroeconomic dynamics reveals that indebted subjects are active, constitutive participants in the perpetuation of debt relations. Rather than being passive victims of structural financial forces, workers actively internalize, negotiate, and reinforce the debt condition through their daily reproductive choices. This relational perspective redefines capitalism's power as an ongoing, subject-driven process of mutual construction."
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

  return `START_THESIS_MATRIX\n${matrixJson}\nEND_THESIS_MATRIX\n\n# GÖREV VE TALİMAT\nSistem talimatında tanımlanan kütüphanecilik mantığına, "EVRENSEL 4 SABİT + 1 DİNAMİK RAF MİMARİSİ" kısıtlamalarına, dil dengesine ve "AKADEMİK ANTİ-BİAS SÜZGECİ" ilkelerine tam olarak bağlı kalarak yukarıdaki 6 boyutlu matris yapısını analiz et.\n\nMatristeki her bir kuramsal yaklaşımı tek bir CONCEPTUAL kutusunda birleştirerek mükerrerliği engelle. Tezin ampirik yapısı süreç/akış içeriyorsa ampirik sahaları maksimum 3 Kutuya (PROBLEMATIZATION) kadar kronolojik veya tematik olarak böl; eğer düz/tek odaklı bir tez ise tek bir PROBLEMATIZATION kutusu ile ampiriyi çöz. \n\nCONCEPTUAL tipi kutunun akademik İngilizce semantik arama bloğunu kurgularken tezin yerel/coğrafi kokusunu tamamen dışarıda bırakarak saf kavramsal teoriyi ve evrensel tanımı yakala. Çıktı olarak sadece ve sadece tanımlanan şemaya %100 uygun, markdown içermeyen saf JSON nesnesini döndür.`;
}
