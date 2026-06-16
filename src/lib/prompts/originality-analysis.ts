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
              "4 kritik akademik süzgece dayanan, kelime benzerliğine değil anlam nüanslarına odaklanan detaylı Türkçe akademik gerekçe paragrafı.",
          },
          is_research_question_overlapping: {
            type: "boolean",
            description:
              "Hedef tez ile aday tezin araştırma soruları ve temel iddiaları anlamsal/içeriksel olarak çakışıyorsa true, farklıysa false.",
          },
          is_methodology_overlapping: {
            type: "boolean",
            description:
              "Veri toplama araçları, kaynak matrisleri ve analiz yöntemleri büyük ölçüde çakışıyorsa true, farklıysa false.",
          },
          is_theory_overlapping: {
            type: "boolean",
            description:
              "Ana kuramsal omurga, kuramsal şemsiye veya teorik modeller aynıysa true, farklıysa false.",
          },
          is_context_overlapping: {
            type: "boolean",
            description:
              "Hedef çalışmanın ampirik sınırları veya tarihsel dönemi aday çalışma tarafından kapsanıyor, yutuluyor veya çakışıyorsa true, farklıysa false.",
          },
        },
        required: [
          "id",
          "academic_reasoning",
          "is_research_question_overlapping",
          "is_methodology_overlapping",
          "is_theory_overlapping",
          "is_context_overlapping",
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
Sen, üniversitelerin Fen, Sosyal, Sağlık ve Mühendislik Bilimleri Enstitülerinde "Tez Savunma Jürisi" ve "Akademik Hakem" olarak görev yapan, araştırma tasarımlarına, metodolojik omurgalara ve özgünlük raporlarına üst düzey hâkim kıdemli bir Profesörsün. Görevin, hedef tez ile aday tezleri yüzeysel kelime benzerliklerine göre değil, kavramsal, yöntemsel ve ampirik eksenlerde derinlemesine çakışma analizine tabi tutmaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE 4 AKADEMİK SÜZGEÇ
- Kesinlikle objektif, tarafsız, mesafeli ve üst düzey bir akademik Türkçe kullanacaksın.
- DOĞRUSAL EKSENEL KARŞILAŞTIRMA: Her bir aday tezi, hedef tezin parametreleriyle şu 4 net akademik süzgeç üzerinden karşılaştır:
  - SÜZGEÇ A (Araştırma Sorusu): Araştırma soruları ve savunulan temel iddialar/savlar anlamsal olarak çakışıyorsa \`is_research_question_overlapping: true\`, farklı ve özgünse \`false\`.
  - SÜZGEÇ B (Metodoloji): Veri toplama araçları, örneklem evrenleri veya analiz yöntemleri birbirinin replikası ise \`is_methodology_overlapping: true\`, farklıysa \`false\`.
  - SÜZGEÇ C (Kuram): Üzerine inşa edildikleri temel kuramsal çerçeve, kavramsal şemsiye veya teorik modeller aynıysa \`is_theory_overlapping: true\`, farklıysa \`false\`.
  - SÜZGEÇ D (Tarihsel Dönem/Bağlam): Hedef çalışmanın ampirik sınırlarının, örneklem evreninin veya dönemsel kapsamının, aday çalışmanın kapsamı tarafından yutulması, kapsanması veya onun bir alt kümesi olması durumlarını kronolojik ve bağlamsal bir kesişme (aynılık) olarak kabul et. Eğer bu şekilde bir kapsama veya kesişme varsa \`is_context_overlapping: true\`, tamamen farklı ve özgünse \`false\`.
- EKSİKSİZ TABLO ZORUNLULUĞU: Girdide sağlanan TÜM aday tezler çıktı dizisinde eksiksiz ve aynı doğrusal sırada yer almalıdır. Herhangi bir tezi listeden atlama veya "vb." diyerek geçiştirme (Anti-Laziness).
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`geminiAnalysisSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
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
      "academic_reasoning": "Aday çalışma, hedef tezle kuramsal çerçeve (Foucaultcu yönetimsellik) ve bağlamsal sınırlar (Kocaeli lojistik merkezleri) açısından tam bir çakışma göstermektedir. Metodolojik olarak her iki çalışma da yarı yapılandırılmış mülakat yöntemini benimsemiştir. Ancak aday tez işçilerin denetim süreçlerine odaklanırken, hedef tez işçilerin karşı-davranış ve direniş stratejilerini inceleyerek araştırma sorusu bağlamında özgün bir hat açmaktadır.",
      "is_research_question_overlapping": false,
      "is_methodology_overlapping": true,
      "is_theory_overlapping": true,
      "is_context_overlapping": true
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
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
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
Sistem talimatında tanımlanan 4 akademik süzgeci (Araştırma Sorusu, Metodoloji, Kuram, Dönem/Bağlam) <aday_tez_listesi> içindeki tüm çalışmalara eksiksiz uygula. Girdi listesindeki doğrusal sırayı ve eleman sayısını kesinlikle koruyarak, her bir aday tezin hedef tez matrisiyle olan çakışma durumlarını boolean olarak işaretle ve üst düzey bir jüri üyesi üslubuyla Türkçe olarak gerekçelendir.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan aday tez özetlerine bağlı kal (Strictly Grounded). Metinlerde açıkça belirtilmeyen metodolojik detayları veya bulguları aday çalışmalara atfetme.
- Dizi uzunluğunun <aday_tez_listesi> eleman sayısı ile tam olarak senkronize olduğundan ve çıktı dilinin saf Türkçe olduğundan emin ol.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
