import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const geminiAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    overlapTable: {
      type: "array",
      description:
        "Girdideki her aday tez için mutlaka bir satır içermelidir. Hiçbir tez listeden çıkarılamaz. Dizi uzunluğu aday tez sayısına tam olarak eşit olmalıdır.",
      items: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Analiz edilen aday tezin benzersiz numarası (ID)",
          },
          academic_reasoning: {
            type: "string",
            description:
              "4 kritik akademik süzgece ve araştırma boşluğu (research gap) değerlendirmesine dayanan, kelime benzerliğine değil anlam nüanslarına odaklanan detaylı Türkçe akademik gerekçe paragrafı.",
          },
          originality_level: {
            type: "string",
            enum: ["HIGH_RISK", "MEDIUM_RISK", "LOW_RISK", "ZERO_RISK"],
            description:
              "Jürinin bu aday tez için verdiği nihai bütünsel konumlandırma kararı. HIGH_RISK = hedef tezin özgün katkısını doğrudan tehdit ediyor. MEDIUM_RISK = kayda değer benzerlik var ama özgün katkı korunuyor. LOW_RISK = zemin oluşturan, destekleyici çalışma. ZERO_RISK = doğrudan ilişki kurulamayan, tamamen özgün alan.",
          },
          subject_overlap: {
            type: "string",
            enum: ["HIGH", "PARTIAL", "NONE"],
            description:
              "HIGH = Hedef tez ile aday tezin araştırma soruları ve temel iddiaları anlamsal/içeriksel olarak doğrudan çakışıyor. PARTIAL = Kısmi benzerlik var ama özgün katkı korunuyor. NONE = Anlamsal/ilişkisel boşluk var, jenerik kelime benzerliği seviyesinde.",
          },
          methodology_overlap: {
            type: "string",
            enum: ["HIGH", "PARTIAL", "NONE"],
            description:
              "HIGH = Veri toplama araçları, kaynak matrisleri ve analiz yöntemleri büyük ölçüde çakışıyor. PARTIAL = Kısmi benzerlik var. NONE = Yöntemler tamamen farklı.",
          },
          theory_overlap: {
            type: "string",
            enum: ["HIGH", "PARTIAL", "NONE"],
            description:
              "HIGH = Ana kuramsal omurga, kuramsal şemsiye veya teorik modeller aynı. PARTIAL = Kısmi kuramsal ortaklık var. NONE = Kuramsal çerçeveler tamamen farklı.",
          },
          context_overlap: {
            type: "string",
            enum: ["HIGH", "PARTIAL", "NONE"],
            description:
              "HIGH = Hedef çalışmanın ampirik sınırları veya tarihsel dönemi aday çalışma tarafından kapsanıyor, yutuluyor veya tamamen çakışıyor. PARTIAL = Kısmi bağlamsal kesişme var. NONE = Bağlamlar tamamen farklı.",
          },
        },
        required: [
          "id",
          "academic_reasoning",
          "originality_level",
          "subject_overlap",
          "methodology_overlap",
          "theory_overlap",
          "context_overlap",
        ],
      },
    },
  },
  required: ["overlapTable"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildAnalysisSystemInstruction(): string {
  return `# ROL
Sen, üniversitelerin Fen, Sosyal, Sağlık ve Mühendislik Bilimleri Enstitülerinde "Tez Savunma Jürisi", "Araştırma Boşluğu (Research Gap) Analisti" ve "Bilimsel Metodolog" olarak görev yapan kıdemli bir Profesörsün. Görevin, hedef tez ile aday tezleri yüzeysel kelime benzerliklerine göre değil; hedef tezin literatürde kapatmak istediği özgün akademik boşluk (research gap) ile aday tezin bu boşlukla olan ilişkisine göre tartmaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE JÜRİ KARAR SÜRECİ
- Kesinlikle objektif, tarafsız, mesafeli ve üst düzey bir akademik Türkçe kullanacaksın.
- 3 KADEMELİ AKADEMİK KONUMLANDIRMA MODELİ (Eksenler): Her bir süzgeç için overlap değerini HIGH, PARTIAL veya NONE olarak belirle:
  - HIGH: Güçlü çakışma, hedef tezin özgün katkısını doğrudan tehdit ediyor.
  - PARTIAL: Kısmi benzerlik var ancak hedef tezin özgün katkısı net şekilde korunuyor.
  - NONE: Anlamsal/ilişkisel boşluk var, sahte alarm (false positive) seviyesinde jenerik benzerlik.
- DOĞRUSAL EKSENEL KARŞILAŞTIRMA: Her bir aday tezi, hedef tezin parametreleriyle şu 4 net akademik süzgeç üzerinden karşılaştır:
  - SÜZGEÇ A (Araştırma Sorusu): Araştırma soruları ve savunulan temel iddialar/savlar anlamsal olarak doğrudan çakışıyorsa \`subject_overlap: "HIGH"\`, kısmen benzerlik varsa \`"PARTIAL"\`, tamamen farklı ve özgünse \`"NONE"\`.
  - SÜZGEÇ B (Metodoloji): Veri toplama araçları, örneklem evrenleri veya analiz yöntemleri birbirinin replikası ise \`methodology_overlap: "HIGH"\`, kısmen benzerlik varsa \`"PARTIAL"\`, farklıysa \`"NONE"\`.
  - SÜZGEÇ C (Kuram): Üzerine inşa edildikleri temel kuramsal çerçeve, kavramsal şemsiye veya teorik modeller aynıysa \`theory_overlap: "HIGH"\`, kısmen ortaksa \`"PARTIAL"\`, farklıysa \`"NONE"\`.
  - SÜZGEÇ D (Tarihsel Dönem/Bağlam): Hedef çalışmanın ampirik sınırlarının, örneklem evreninin veya dönemsel kapsamının, aday çalışmanın kapsamı tarafından yutulması, kapsanması veya onun bir alt kümesi olması durumlarını kronolojik ve bağlamsal bir kesişme olarak kabul et. Tam kesişme varsa \`context_overlap: "HIGH"\`, kısmi kesişme varsa \`"PARTIAL"\`, tamamen farklı ve özgünse \`"NONE"\`.
- NİHAİ BÜTÜNSEL KONUMLANDIRMA (\`originality_level\`): 4 eksenin her biri için verdiğin HIGH / PARTIAL / NONE kararlarını tek tek hesapladıktan sonra, aday tezin hedef teze göre genel konumunu jürinin kendi bütünsel vizyonuyla değerlendirerek \`originality_level\` alanını belirle. Bu karar, hiçbir kod veya suni kurala bağlı değildir; tamamen senin akademik muhakemene ve alan bilgine dayanır:
  - HIGH_RISK = Hedef tezin özgün katkısını doğrudan gasp eden/baltalayan kritik çakışma. Aday tez, hedef tezin araştırma sorusunun büyük ölçüde aynısını yanıtlıyor olabilir; özgünlük ciddi tehdit altında.
  - MEDIUM_RISK = Kayda değer benzerlikler var ancak hedef tezin research gap'i ve özgün katkısı büyük ölçüde korunuyor. Bazı eksenler örtüşse de temel odak farklı.
  - LOW_RISK = Benzer alanda çalışan, zemin oluşturan, referans niteliğinde bir çalışma. Özgün katkıya tehdit yok, aksine destekliyor.
  - ZERO_RISK = Doğrudan ilişki kurulamayan, tamamen farklı bir araştırma boşluğuna hitap eden çalışma. Sahte alarm seviyesinde jenerik benzerlik olabilir.
- EKSİKSİZ TABLO ZORUNLULUĞU: Girdide sağlanan TÜM aday tezler çıktı dizisinde eksiksiz ve aynı doğrusal sırada yer almalıdır. Herhangi bir tezi listeden atlama veya "vb." diyerek geçiştirme (Anti-Laziness).
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`geminiAnalysisSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
Aşağıdaki örnekte, aday tez hedef tezle aynı dönemi, aynı jenerik yöntemi ve aynı kuramsal çerçeveyi kullansa da araştırma soruları farklı olduğu için nihai konumlandırma MEDIUM_RISK olarak belirlenmiştir. Bu, sahte alarm üretmeyen gerçekçi bir senaryodur.

<ornek_hedef_matris>
{
  "studyTitle": "Dijital Gözetim ve Emek Direnişi",
  "researchQuestion": "Depo işçileri algoritmik gözetim sistemlerine karşı nasıl karşı-davranış stratejileri geliştiriyor?",
  "theoreticalFramework": "Foucaultcu yönetimsellik ve otonomist Marksizm.",
  "methodology": "30 beyaz yakalı çalışanla yarı yapılandırılmış mülakat.",
  "historicalSpatialLimits": "Pandemi sonrası Türkiye, Kocaeli lojistik üsleri."
}
</ornek_hedef_matris>

<ornek_aday_tez>
[
  {
    "id": 999,
    "title": "E-Ticaret Depolarında Algoritmik Kontrol Mekanizmaları",
    "author": "Ahmet Yılmaz",
    "university": "Kocaeli Üniversitesi",
    "year": 2023,
    "thesisType": "Yüksek Lisans",
    "department": "Sosyoloji",
    "abstract": "Bu çalışma Kocaeli'deki e-ticaret lojistik merkezlerinde çalışan işçilerin algoritmik yönetim sistemleri altındaki denetim süreçlerini incelemektedir. Foucaultcu yönetimsellik perspektifinden, dijital gözetimin işçi özerkliğini nasıl kısıtladığı yarı yapılandırılmış mülakatlarla analiz edilmiştir..."
  }
]
</ornek_aday_tez>

<ornek_beklenen_cikti>
{
  "overlapTable": [
    {
      "id": 999,
      "academic_reasoning": "Aday çalışma, hedef tezle aynı kuramsal çerçeveyi (Foucaultcu yönetimsellik), aynı bağlamsal sınırları (Kocaeli lojistik üsleri) ve aynı jenerik yöntemi (yarı yapılandırılmış mülakat) paylaşmaktadır. Ancak aday tez, doğrudan denetim ve gözetim mekanizmalarının işçi özerkliğini nasıl kısıtladığına odaklanırken; hedef tez, işçilerin bu sistemlere karşı geliştirdiği karşı-davranış ve direniş stratejilerini araştırarak bambaşka bir research gap'i hedeflemektedir. Araştırma soruları anlamsal düzeyde farklılaştığı için subject_overlap PARTIAL olarak işaretlenmiştir. Kuram, yöntem ve bağlam örtüşmesine rağmen temel odaktaki bu fark, nihai konumlandırmayı MEDIUM_RISK seviyesinde tutmuştur.",
      "subject_overlap": "PARTIAL",
      "methodology_overlap": "HIGH",
      "theory_overlap": "HIGH",
      "context_overlap": "HIGH",
      "originality_level": "MEDIUM_RISK"
    }
  ]
}
</ornek_beklenen_cikti>_`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildAnalysisPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
  validDetails: {
    id: number;
    title: string;
    author: string;
    university: string;
    year: number;
    thesisType: string;
    department: string;
    abstract: string;
  }[];
}): string {
  const temporalSpatialContext = `${params.historicalLimits} | ${params.spatialLimits}`;
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "historicalSpatialLimits": "${temporalSpatialContext.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

<aday_tez_listesi>
${JSON.stringify(
  params.validDetails.map((t) => ({
    id: t.id,
    title: t.title,
    author: t.author,
    university: t.university,
    year: t.year,
    thesisType: t.thesisType,
    department: t.department,
    abstract: t.abstract,
  })),
)}
</aday_tez_listesi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan 4 akademik süzgeci (Araştırma Sorusu, Metodoloji, Kuram, Dönem/Bağlam) <aday_tez_listesi> içindeki tüm çalışmalara eksiksiz uygula. Her bir aday tez için subject_overlap, methodology_overlap, theory_overlap, context_overlap alanlarını 3 kademeli modele göre (HIGH, PARTIAL, NONE) işaretle. Ardından, jürinin bütünsel vizyonuyla aday tezin hedef teze göre genel konumunu değerlendirerek originality_level alanını (HIGH_RISK, MEDIUM_RISK, LOW_RISK veya ZERO_RISK) belirle. Her tez için üst düzey bir jüri üyesi üslubuyla Türkçe olarak gerekçelendirilmiş academic_reasoning paragrafı yaz. İki tez arasındaki felsefi ve ilişkisel boşluk (research gap) farklarını yakala; sadece jenerik kelime benzerliklerine dayanarak sahte alarm (false positive) üretme.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan aday tez özetlerine bağlı kal (Strictly Grounded). Metinlerde açıkça belirtilmeyen metodolojik detayları veya bulguları aday çalışmalara atfetme.
- Dizi uzunluğunun <aday_tez_listesi> eleman sayısı ile tam olarak senkronize olduğundan ve çıktı dilinin saf Türkçe olduğundan emin ol.
- HIGH etiketi yalnızca hedef tezin özgün akademik katkısını doğrudan gasp eden/baltalayan güçlü çakışmalar için kullan. PARTIAL, kısmi benzerlik durumlarında tercih edilir. NONE, anlamsal/ilişkisel boşluk bulunan durumlar içindir.
- originality_level kararını herhangi bir kod veya formüle bağlı kalmadan, sadece kendi akademik muhakemene güvenerek ver.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
