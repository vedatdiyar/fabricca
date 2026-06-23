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
        "Girdideki aday tezlerden seçilenleri içerir. 4 akademik süzgecin tamamında DUSUK veya YOK seviyesinde kalan veya tamamen alakasız olan tezler JÜRİ ELEME EMİR KURALI uyarınca bu diziye KESİNLİKLE DAHİL EDİLMEZ. Dizi uzunluğu aday tez sayısından az veya eşit olabilir.",
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
              "4 boyut için verilen kategorik risk seviyelerinin her birini teker teker gerekçelendiren, kelime benzerliğine değil anlam nüanslarına, 'İlişkisel Bütünlük' kuralına ve araştırma boşluğu (research gap) değerlendirmesine dayanan detaylı Türkçe akademik gerekçe paragrafı.",
          },
          subject_scorecard: {
            type: "object",
            description: "Konu/Araştırma Sorusu uyumu için nesnel karne.",
            properties: {
              same_core_question: {
                type: "boolean",
                description:
                  "Hedef tez ile aday tezin temel araştırma sorusu veya temel iddiası doğrudan aynı mı?",
              },
              significant_topic_intersection: {
                type: "boolean",
                description:
                  "İki çalışma aynı spesifik konuyu ve problematiği mi ele alıyor?",
              },
              background_mention_only: {
                type: "boolean",
                description:
                  "Aday tez, hedef tezin konusuna sadece arka plan bilgisi olarak mı değiniyor?",
              },
            },
            required: [
              "same_core_question",
              "significant_topic_intersection",
              "background_mention_only",
            ],
          },
          subject_overlap: {
            type: "string",
            enum: ["KRITIK", "YUKSEK", "ORTA", "DUSUK", "YOK"],
            description:
              "Araştırma sorusu/konu örtüşme seviyesi. KRITIK = Doğrudan gasp/baltalama (same_core_question=true), YUKSEK = Belirgin kapsama/çakışma (significant_topic_intersection=true), ORTA = Çeperden/dolaylı temas, DUSUK = Düşük benzerlik/sınırlı ilişki (background_mention_only=true), YOK = Hiçbir organik bağ yok.",
          },
          methodology_scorecard: {
            type: "object",
            description: "Metodoloji uyumu için nesnel karne.",
            properties: {
              identical_method_and_tools: {
                type: "boolean",
                description:
                  "Veri toplama araçları ve analiz yöntemleri doğrudan birbirinin replikası mı?",
              },
              partially_shared_approach: {
                type: "boolean",
                description:
                  "Kısmi yöntemsel benzerlik veya ortak yaklaşım var mı?",
              },
              different_empirical_design: {
                type: "boolean",
                description: "Yöntemsel tasarımları kökten farklı mı?",
              },
            },
            required: [
              "identical_method_and_tools",
              "partially_shared_approach",
              "different_empirical_design",
            ],
          },
          methodology_overlap: {
            type: "string",
            enum: ["KRITIK", "YUKSEK", "ORTA", "DUSUK", "YOK"],
            description:
              "Metodoloji örtüşme seviyesi. KRITIK = Replika yöntem (identical_method_and_tools=true), YUKSEK = Belirgin ölçüde ortak yaklaşım (partially_shared_approach=true), ORTA = Kısmi yöntemsel temas, DUSUK = Düşük benzerlik, YOK = Tamamen farklı metodoloji (different_empirical_design=true).",
          },
          theory_scorecard: {
            type: "object",
            description: "Kuramsal çerçeve uyumu için nesnel karne.",
            properties: {
              same_theoretical_backbone: {
                type: "boolean",
                description:
                  "Üzerine inşa edildikleri ana kuramsal çerçeve veya teorik modeller doğrudan aynı mı?",
              },
              shared_concepts_only: {
                type: "boolean",
                description:
                  "Sadece benzer kavramlar veya teorisyen referansları mı paylaşılıyor?",
              },
              different_epistemology: {
                type: "boolean",
                description:
                  "Kuramsal ekol veya epistemolojik yaklaşımları kökten farklı mı?",
              },
            },
            required: [
              "same_theoretical_backbone",
              "shared_concepts_only",
              "different_epistemology",
            ],
          },
          theory_overlap: {
            type: "string",
            enum: ["KRITIK", "YUKSEK", "ORTA", "DUSUK", "YOK"],
            description:
              "Kuramsal çerçeve örtüşme seviyesi. KRITIK = Aynı kuramsal omurga (same_theoretical_backbone=true), YUKSEK = Kapsamlı ortak kuram, ORTA = Tek kavram/teorisyen referansı (shared_concepts_only=true), DUSUK = Zayıf kuramsal bağ, YOK = Farklı kuramsal gelenek (different_epistemology=true).",
          },
          context_scorecard: {
            type: "object",
            description: "Bağlam/Dönem/Örneklem uyumu için nesnel karne.",
            properties: {
              overlapping_universe_and_sample: {
                type: "boolean",
                description:
                  "Hedef tezin örneklem evreni, coğrafi alanı ve dönemi aday tez tarafından tamamen veya büyük ölçüde kapsanıyor/yutuluyor mu?",
              },
              partial_contextual_contact: {
                type: "boolean",
                description:
                  "Sadece coğrafya veya dönem bazında kısmi bir kesişme mi var?",
              },
              distinct_context: {
                type: "boolean",
                description: "Bağlamlar tamamen bağımsız mı?",
              },
            },
            required: [
              "overlapping_universe_and_sample",
              "partial_contextual_contact",
              "distinct_context",
            ],
          },
          context_overlap: {
            type: "string",
            enum: ["KRITIK", "YUKSEK", "ORTA", "DUSUK", "YOK"],
            description:
              "Bağlam (dönem/coğrafya/örneklem) örtüşme seviyesi. KRITIK = Tam kesişme/yutulma (overlapping_universe_and_sample=true), YUKSEK = Belirgin bağlamsal örtüşme, ORTA = Kısmi bağlamsal temas (partial_contextual_contact=true), DUSUK = Zayıf bağlamsal ilişki, YOK = Tamamen farklı bağlam (distinct_context=true).",
          },
        },
        required: [
          "id",
          "academic_reasoning",
          "subject_scorecard",
          "subject_overlap",
          "methodology_scorecard",
          "methodology_overlap",
          "theory_scorecard",
          "theory_overlap",
          "context_scorecard",
          "context_overlap",
        ],
      },
    },
  },
  required: ["overlapTable"],
};

/**
 * Jüri ve Özgünlük Risk Analizi için Gemini modeline verilecek sistem talimatını (System Instruction) oluşturur.
 * Modelin akademik rolünü, analiz kurallarını ve kıyaslama kriterlerini tanımlar.
 *
 * @returns Sistem talimatı metni
 */
export function buildAnalysisSystemInstruction(): string {
  return `# ROL
Sen, üniversitelerin enstitülerinde "Tez Savunma Jürisi" ve "Araştırma Boşluğu (Research Gap) Analisti" olarak görev yapan kıdemli bir akademisyensin. Görevin, hedef tez ile aday tezleri yüzeysel kelime benzerliklerine göre değil; hedef tezin literatürde kapatmak istediği özgün akademik boşluk ile aday tezin bu boşlukla olan ilişkisine göre değerlendirerek 5 seviyeli kategorik risk etiketi (KRITIK, YUKSEK, ORTA, DUSUK, YOK) vermektir.

# DEĞERLENDİRME İLKELERİ VE KISITLAMALAR
- Nesnel, tarafsız, mesafeli ve akademik bir Türkçe kullanınız.
- Aday tezlerin sadece sağlanan özet metinlerine bağlı kalınız (Strictly Grounded). Özette açıkça belirtilmeyen metodolojik veya kuramsal detayları aday çalışmalara atfetmeyiniz, spekülatif niyet okumaları yapmayınız.

# NESNEL KARNE TABANLI DEĞERLENDİRME VE KARAR MATRİSİ
Her aday tez için öncelikle eksenlerin boolean karnelerini (\`subject_scorecard\`, \`methodology_scorecard\`, \`theory_scorecard\`, \`context_scorecard\`) doldurunuz. Kategorik risk seviyelerini seçerken bu karnelerle tam tutarlı olunuz:

1. Araştırma Sorusu/Konu Etiketi (\`subject_overlap\`):
   - \`KRITIK\`: \`same_core_question\` === true (hedef tez ile temel araştırma sorusu veya iddiası doğrudan aynı ise).
   - \`YUKSEK\`: \`same_core_question\` === false ve \`significant_topic_intersection\` === true (aynı spesifik konu ve problematiği ele alıyorlarsa).
   - \`ORTA\`: \`same_core_question\` === false, \`significant_topic_intersection\` === false ve \`background_mention_only\` === false (çeperden, dolaylı temas varsa).
   - \`DUSUK\`: \`background_mention_only\` === true (aday tez hedef tezin konusuna sadece arka plan olarak değiniyorsa).
   - \`YOK\`: Aday tez hedef tezle tamamen alakasız ise veya tüm karnedeki alanlar false ise.

2. Metodoloji Örtüşme Etiketi (\`methodology_overlap\`):
   - \`KRITIK\`: \`identical_method_and_tools\` === true (yöntem ve araçlar doğrudan replika ise).
   - \`YUKSEK\`: \`identical_method_and_tools\` === false ve \`partially_shared_approach\` === true (belirgin ölçüde ortak bir metodolojik yaklaşım varsa).
   - \`ORTA\`: \`identical_method_and_tools\` === false, \`partially_shared_approach\` === false ve \`different_empirical_design\` === false (kısmi yöntemsel temas varsa).
   - \`DUSUK\`: \`different_empirical_design\` === true (yöntemsel tasarımları farklı ise).
   - \`YOK\`: Yöntemler tamamen bağımsız ve farklı ise.

3. Kuramsal Örtüşme Etiketi (\`theory_overlap\`):
   - \`KRITIK\`: \`same_theoretical_backbone\` === true (aynı kuramsal çerçeve veya teorik modeller üzerine inşa edilmişlerse).
   - \`YUKSEK\`: \`same_theoretical_backbone\` === true fakat kuramsal/epistemolojik zıtlık/rakip yaklaşım deklare edilmişse.
   - \`ORTA\`: \`same_theoretical_backbone\` === false ve \`shared_concepts_only\` === true (yalnızca benzer kavramlar veya teorisyen referansları paylaşılıyorsa).
   - \`DUSUK\`: \`different_epistemology\` === true (kuramsal ekol veya epistemolojik yaklaşımları farklı ise).
   - \`YOK\`: Kuramsal çerçeveler tamamen farklı ise.

4. Bağlam Örtüşme Etiketi (\`context_overlap\`):
   - \`KRITIK\`: \`overlapping_universe_and_sample\` === true (evren, örneklem, coğrafi alan ve dönemsel takvim büyük ölçüde çakışıyor veya yutuluyorsa).
   - \`YUKSEK\`: \`overlapping_universe_and_sample\` === false ve \`partial_contextual_contact\` === true (coğrafya veya dönem bazında kısmi kesişme varsa).
   - \`ORTA\`: \`partial_contextual_contact\` === false ve \`distinct_context\` === false (örneklem/takvim zayıf temas içeriyorsa).
   - \`DUSUK\`: \`distinct_context\` === false (zayıf bağlamsal ilişki varsa).
   - \`YOK\`: \`distinct_context\` === true (bağlamlar tamamen bağımsız ise).

# İLİŞKİSEL BÜTÜNLÜK KURALI (DOMAIN-AGNOSTIC)
Hedef tez, araştırma sorusunu, yöntemini ve kuramsal çerçevesini iki veya daha fazla bağımsız değişken/aktör/olgu arasındaki ilişkisel diyalektik veya etkileşim ($A \leftrightarrow B$) üzerine inşa etmişse; aday çalışma aynı kuramsal şemsiyeyi, yöntemi veya bağlamı paylaşıyor olsa bile, eğer aday çalışma bu bileşenlerden yalnızca birini tek taraflı veya içsel olarak ($A$ veya $B$) inceliyorsa, \`subject_overlap\`, \`theory_overlap\`, \`methodology_overlap\` ve \`context_overlap\` seviyelerinin HİÇBİRİ **ORTA** seviyesini aşamaz (asla YUKSEK veya KRITIK olamaz). Analiz birimlerinin mimari yapısını buna göre değerlendiriniz ve gerekçesini \`academic_reasoning\` alanında açıklayınız.

# JÜRİ SAVUNMA ELEME KURALI
4 süzgecin tamamında DUSUK veya YOK seviyesinde kalan aday tezler hedef tez için akademik bir risk teşkil etmediğinden, bu çalışmaları \`overlapTable\` dizisine dahil etmeyiniz.

# BİÇİMLENDİRME
Yanıtı, sağlanan JSON şemasına tamamen uygun, doğrulanmış ve parse edilebilir bir ham JSON nesnesi olarak döndürünüz. Markdown kod blokları (\`\`\`json ...) kesinlikle kullanmayınız.

# UZMAN FEW-SHOT ÖRNEĞİ
Aşağıdaki örnekte, aday tez hedef tezle aynı dönemi, aynı yöntemi ve kuramsal çerçeveyi paylaşıyor olsa da, hedef tezin ilişkisel yapısına ($A \leftrightarrow B$) karşılık tekil bir yapı ($A$) sunduğu için, 'İlişkisel Bütünlük' kuralı gereği tüm eksenlerin seviyeleri ORTA seviyesinde sınırlandırılmıştır.

<ornek_hedef_matris>
{
  "studyTitle": "Dijital Gözetim ve Emek Direnişi",
  "researchQuestion": "Depo işçileri algoritmik gözetim sistemlerine karşı nasıl karşı-davranış stratejileri geliştiriyor?",
  "theoreticalFramework": "Foucaultcu yönetimsellik ve otonomist Marksizm.",
  "methodology": "30 depo çalışanıyla yarı yapılandırılmış mülakat.",
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
    "abstract": "Bu çalışma Kocaeli'deki e-ticaret lojistik merkezlerinde çalışan işçilerin algoritmik yönetim sistemleri altındaki içsel denetim süreçlerini incelemektedir. Foucaultcu yönetimsellik perspektifinden, dijital gözetimin işçi özerkliğini nasıl kısıtladığı ve kurumsal kontrol matrisleri yarı yapılandırılmış mülakatlarla analiz edilmiştir..."
  }
]
</ornek_aday_tez>

<ornek_beklenen_cikti>
{
  "overlapTable": [
    {
      "id": 999,
      "academic_reasoning": "Aday çalışma, hedef tezle aynı jenerik kuramsal şemsiyeyi (Foucaultcu yönetimsellik), aynı coğrafi/dönemsel bağlamı (Kocaeli lojistik üsleri) ve benzer bir yöntemi (mülakat) paylaşmaktadır. Ancak hedef tez, kuramsal omurgasını otonomist Marksizm ile eklemleyerek gözetim mekanizmaları ile işçilerin aktif direniş stratejileri arasındaki 'ilişkisel diyalektiği' ($A \\leftrightarrow B$) merkeze almaktadır. Aday çalışma ise süreci sadece kurumsal denetimin işçi üzerindeki tek taraflı, içsel kontrol etkileri ($A$) ekseninde incelemektedir. 'İlişkisel Bütünlük' kuralı uyarınca, tek aktörlü/tekil bir analitik mimari, hedef tezin ilişkisel diyalektik modelini kapsayamayacağından, subject_overlap, theory_overlap, methodology_overlap ve context_overlap seviyelerinin hiçbiri ORTA seviyesini aşamaz. Bu nedenle tüm eksenler en fazla ORTA seviyesinde sınırlandırılmıştır.",
      "subject_scorecard": {
        "same_core_question": false,
        "significant_topic_intersection": true,
        "background_mention_only": false
      },
      "subject_overlap": "ORTA",
      "methodology_scorecard": {
        "identical_method_and_tools": false,
        "partially_shared_approach": true,
        "different_empirical_design": false
      },
      "methodology_overlap": "ORTA",
      "theory_scorecard": {
        "same_theoretical_backbone": false,
        "shared_concepts_only": true,
        "different_epistemology": false
      },
      "theory_overlap": "ORTA",
      "context_scorecard": {
        "overlapping_universe_and_sample": true,
        "partial_contextual_contact": false,
        "distinct_context": false
      },
      "context_overlap": "ORTA"
    }
  ]
}
</ornek_beklenen_cikti>`;
}

/**
 * Aday tezin analiz edilmesi için kullanıcı promptu oluşturur.
 * Prompt sadece girdi verilerini içerir; değerlendirme kuralları sistem talimatlarındadır.
 *
 * @param params - Hedef tez matrisi ve aday tez detayları
 * @returns Oluşturulan kullanıcı promptu
 */
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

Görev: Yukarıda sağlanan aday tezi, sistem talimatlarında tanımlanan 4 akademik süzgeç ve karar kuralları doğrultusunda hedef tez matrisiyle karşılaştırarak analiz ediniz ve sonucu belirlenen JSON şemasında döndürünüz.`;
}
