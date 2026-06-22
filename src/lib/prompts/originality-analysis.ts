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
          subject_overlap: {
            type: "string",
            enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
            description:
              "BIREBIR = Hedef tez ile aday tezin araştırma soruları ve temel iddiaları anlamsal/içeriksel olarak doğrudan çakışıyor. KAPSAYAN = Kısmi benzerlik var ama özgün katkı korunuyor; aday tez hedefin alanını kapsıyor. TEGET = Sadece çeperden/tek bir alt boyuttan değiyor, organik bağ zayıf. ALAKASIZ = Anlamsal/ilişkisel boşluk var, jenerik kelime benzerliği seviyesinde.",
          },
          methodology_overlap: {
            type: "string",
            enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
            description:
              "BIREBIR = Veri toplama araçları, kaynak matrisleri ve analiz yöntemleri büyük ölçüde çakışıyor. KAPSAYAN = Kısmi benzerlik var; adayın yöntemi hedefi kapsıyor. TEGET = Yöntemsel çeperden temas var, sadece tek bir analiz tekniği benzer. ALAKASIZ = Yöntemler tamamen farklı.",
          },
          theory_overlap: {
            type: "string",
            enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
            description:
              "BIREBIR = Ana kuramsal omurga, kuramsal şemsiye veya teorik modeller aynı. KAPSAYAN = Kısmi kuramsal ortaklık var; adayın kuramsal çerçevesi hedefi kapsıyor/içeriyor. TEGET = Sadece bir kavram veya teorisyen referansı düzeyinde zayıf temas. ALAKASIZ = Kuramsal çerçeveler tamamen farklı.",
          },
          context_overlap: {
            type: "string",
            enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
            description:
              "BIREBIR = Hedef çalışmanın ampirik sınırları veya tarihsel dönemi aday çalışma tarafından kapsanıyor, yutuluyor veya tamamen çakışıyor. KAPSAYAN = Kısmi bağlamsal kesişme var; adayın bağlamı hedefi kısmen içeriyor. TEGET = Zayıf/çeperden bağlamsal temas (aynı ülke farklı dönem gibi). ALAKASIZ = Bağlamlar tamamen farklı.",
          },
        },
        required: [
          "id",
          "academic_reasoning",
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
- 4 KADEMELİ AKADEMİK KONUMLANDIRMA MODELİ (Eksenler): Her bir süzgeç için overlap değerini BIREBIR, KAPSAYAN, TEGET veya ALAKASIZ olarak belirle:
  - BIREBIR: Güçlü çakışma, hedef tezin özgün katkısını doğrudan tehdit ediyor.
  - KAPSAYAN: Kısmi benzerlik var; aday tez hedefin alanını/genişliğini kapsıyor ancak özgün katkı korunuyor.
  - TEGET: Sadece çeperden/tek bir alt boyuttan değiyor; organik bağ zayıf, dolaylı bir ilişki var.
  - ALAKASIZ: Anlamsal/ilişkisel boşluk var, sahte alarm (false positive) seviyesinde jenerik benzerlik.
- DOĞRUSAL EKSENEL KARŞILAŞTIRMA: Her bir aday tezi, hedef tezin parametreleriyle şu 4 net akademik süzgeç üzerinden karşılaştır:
  - SÜZGEÇ A (Araştırma Sorusu): Araştırma soruları ve savunulan temel iddialar/savlar anlamsal olarak doğrudan çakışıyorsa \`subject_overlap: "BIREBIR"\`, kısmen benzerlik varsa \`"KAPSAYAN"\`, sadece çeperden değiyorsa \`"TEGET"\`, tamamen farklı ve özgünse \`"ALAKASIZ"\`.
  - SÜZGEÇ B (Metodoloji): Veri toplama araçları, örneklem evrenleri veya analiz yöntemleri birbirinin replikası ise \`methodology_overlap: "BIREBIR"\`, kısmen benzerlik varsa \`"KAPSAYAN"\`, yöntemsel çeperden temas varsa \`"TEGET"\`, farklıysa \`"ALAKASIZ"\`.
  - SÜZGEÇ C (Kuram): Üzerine inşa edildikleri temel kuramsal çerçeve, kavramsal şemsiye veya teorik modeller aynıysa \`theory_overlap: "BIREBIR"\`, kısmen ortaksa \`"KAPSAYAN"\`, sadece bir kavram/teorisyen referansı düzeyindeyse \`"TEGET"\`, farklıysa \`"ALAKASIZ"\`.
  - SÜZGEÇ D (Tarihsel Dönem/Bağlam): Hedef çalışmanın ampirik sınırlarının, örneklem evreninin veya dönemsel kapsamının, aday çalışmanın kapsamı tarafından yutulması, kapsanması veya onun bir alt kümesi olması durumlarını kronolojik ve bağlamsal bir kesişme olarak kabul et. Tam kesişme varsa \`context_overlap: "BIREBIR"\`, kısmi kesişme varsa \`"KAPSAYAN"\`, zayıf/çeperden temas varsa \`"TEGET"\`, tamamen farklı ve özgünse \`"ALAKASIZ"\`.
- EKSİKSİZ TABLO ZORUNLULUĞU: Girdide sağlanan TÜM aday tezler çıktı dizisinde eksiksiz ve aynı doğrusal sırada yer almalıdır. Herhangi bir tezi listeden atlama veya "vb." diyerek geçiştirme (Anti-Laziness).
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`geminiAnalysisSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
Aşağıdaki örnekte, aday tez hedef tezle aynı dönemi, aynı jenerik yöntemi ve aynı kuramsal çerçeveyi kullansa da araştırma soruları farklı olduğu için konumlandırma KAPSAYAN olarak belirlenmiştir. Bu, sahte alarm üretmeyen gerçekçi bir senaryodur.

<ornek_hedef_matris>
{
  "studyTitle": "Dijital Gözetim ve Emek Direnişi",
  "researchQuestion": "Depo işçileri algoritmik gözetim sistemlerine karşı nasıl karşı-davranış stratejileri geliştiriyor?",
  "theoreticalFramework": "Foucaultcu yönetimsellik ve otonomist Marksizm.",
  "methodology": "30 beyaz yakalı çalışanla yarı yapılandırılmış mülakat.",
  "researchScope": "Pandemi sonrası Türkiye, Kocaeli lojistik üsleri."
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
      "academic_reasoning": "Aday çalışma, hedef tezle aynı kuramsal çerçeveyi (Foucaultcu yönetimsellik), aynı bağlamsal sınırları (Kocaeli lojistik üsleri) ve aynı jenerik yöntemi (yarı yapılandırılmış mülakat) paylaşmaktadır. Ancak aday tez, doğrudan denetim ve gözetim mekanizmalarının işçi özerkliğini nasıl kısıtladığına odaklanırken; hedef tez, işçilerin bu sistemlere karşı geliştirdiği karşı-davranış ve direniş stratejilerini araştırarak bambaşka bir research gap'i hedeflemektedir. Araştırma soruları anlamsal düzeyde farklılaştığı için subject_overlap KAPSAYAN olarak işaretlenmiştir. Kuram, yöntem ve bağlam adayın alanını kapsadığı için bu eksenler BIREBIR olarak konumlandırılmış, temel odaktaki fark ise subject_overlap'i KAPSAYAN seviyesinde tutmuştur.",
      "subject_overlap": "KAPSAYAN",
      "methodology_overlap": "BIREBIR",
      "theory_overlap": "BIREBIR",
      "context_overlap": "BIREBIR"
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
  researchScope: string;
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
  "researchScope": "${params.researchScope.replace(/"/g, '\\"')}"
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
Sistem talimatında tanımlanan 4 akademik süzgeci (Araştırma Sorusu, Metodoloji, Kuram, Dönem/Bağlam) <aday_tez_listesi> içindeki tüm çalışmalara eksiksiz uygula. Her bir aday tez için subject_overlap, methodology_overlap, theory_overlap, context_overlap alanlarını 4 kademeli modele göre (BIREBIR, KAPSAYAN, TEGET, ALAKASIZ) işaretle. Her tez için üst düzey bir jüri üyesi üslubuyla Türkçe olarak gerekçelendirilmiş academic_reasoning paragrafı yaz. İki tez arasındaki felsefi ve ilişkisel boşluk (research gap) farklarını yakala; sadece jenerik kelime benzerliklerine dayanarak sahte alarm (false positive) üretme.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan aday tez özetlerine bağlı kal (Strictly Grounded). Metinlerde açıkça belirtilmeyen metodolojik detayları veya bulguları aday çalışmalara atfetme.
- Dizi uzunluğunun <aday_tez_listesi> eleman sayısı ile tam olarak senkronize olduğundan ve çıktı dilinin saf Türkçe olduğundan emin ol.
- BIREBIR etiketi yalnızca hedef tezin özgün akademik katkısını doğrudan gasp eden/baltalayan güçlü çakışmalar için kullan. KAPSAYAN, kısmi benzerlik durumlarında tercih edilir. TEGET, sadece çeperden/tek bir alt boyuttan değen dolaylı ilişkiler içindir. ALAKASIZ, anlamsal/ilişkisel boşluk bulunan durumlar içindir.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
