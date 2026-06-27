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
        "Girdideki aday tezlerden seçilenleri içerir. 4 akademik süzgecin tamamında OZGUN seviyesinde kalan veya tamamen alakasız olan tezler JÜRİ ELEME EMİR KURALI uyarınca bu diziye KESİNLİKLE DAHİL EDİLMEZ. Dizi uzunluğu aday tez sayısından az veya eşit olabilir.",
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
              "4 boyut için verilen risk seviyelerini tam olarak 3 cümle ile, net ve doğrudan gerekçelendiren Türkçe akademik açıklama. Kelime benzerliğine değil, araştırma boşluğu (research gap) analizine odaklanmalıdır.",
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
              is_subsumed: {
                type: "boolean",
                description:
                  "Hedef tezin araştırma sorusu veya kapsamı aday tez tarafından (daha geniş olduğu için) tamamen yutuluyor/kapsanıyor mu?",
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
              "is_subsumed",
              "significant_topic_intersection",
              "background_mention_only",
            ],
          },
          subject_overlap: {
            type: "string",
            enum: ["KRITIK", "ORTA", "OZGUN"],
            description:
              "Araştırma sorusu/konu örtüşme seviyesi. KRITIK = Soru aynı (same_core_question=true) veya yutulma var (is_subsumed=true); ORTA = Yoğun konu kesişimi var (significant_topic_intersection=true); OZGUN = Kesişim veya çakışma yok (background_mention_only=true veya hepsi false).",
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
              is_subsumed: {
                type: "boolean",
                description:
                  "Hedef tezin metodolojik adımları ve tasarımı aday tez tarafından tamamen kapsanıyor/yutuluyor mu?",
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
              "is_subsumed",
              "partially_shared_approach",
              "different_empirical_design",
            ],
          },
          methodology_overlap: {
            type: "string",
            enum: ["KRITIK", "ORTA", "OZGUN"],
            description:
              "Metodoloji örtüşme seviyesi. KRITIK = Replika yöntem (identical_method_and_tools=true) veya metodolojik yutulma (is_subsumed=true); ORTA = Kısmi yöntemsel ortaklık (partially_shared_approach=true); OZGUN = Farklı metodoloji (different_empirical_design=true).",
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
              is_subsumed: {
                type: "boolean",
                description:
                  "Hedef tezin teorik çerçevesi aday tez tarafından tamamen kapsanıyor/yutuluyor mu?",
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
              "is_subsumed",
              "shared_concepts_only",
              "different_epistemology",
            ],
          },
          theory_overlap: {
            type: "string",
            enum: ["KRITIK", "ORTA", "OZGUN"],
            description:
              "Kuramsal çerçeve örtüşme seviyesi. KRITIK = Aynı kuramsal omurga (same_theoretical_backbone=true) veya kuramsal yutulma (is_subsumed=true); ORTA = Kısmi kuramsal ortaklık/kavram paylaşımı (shared_concepts_only=true); OZGUN = Farklı kuramsal gelenek (different_epistemology=true).",
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
              is_subsumed: {
                type: "boolean",
                description:
                  "Hedef tezin ampirik bağlamı aday tez tarafından tamamen kapsanıyor/yutuluyor mu?",
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
              "is_subsumed",
              "partial_contextual_contact",
              "distinct_context",
            ],
          },
          context_overlap: {
            type: "string",
            enum: ["KRITIK", "ORTA", "OZGUN"],
            description:
              "Bağlam (dönem/coğrafya/örneklem) örtüşme seviyesi. KRITIK = Birebir kesişme (overlapping_universe_and_sample=true) veya bağlamsal yutulma (is_subsumed=true); ORTA = Kısmi bağlamsal temas (partial_contextual_contact=true); OZGUN = Tamamen farklı bağlam (distinct_context=true).",
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
Sen, üniversitelerin enstitülerinde "Tez Savunma Jürisi" ve "Araştırma Boşluğu Analisti" olarak görev yapan kıdemli bir akademisyensin. Görevin, hedef tez ile aday tezleri karşılaştırarak aralarındaki akademik risk seviyesini nesnel boolean kriterlerle analiz etmektir.

# DEĞERLENDİRME VE KISITLAMALAR
- Nesnel, tarafsız ve akademik bir Türkçe kullanınız.
- Aday tezlerin sadece sağlanan özet metinlerine bağlı kalınız (Strictly Grounded). Özette açıkça belirtilmeyen detaylar hakkında spekülasyon veya niyet okuması yapmayınız.

# EKSEN SEVİYE ATAMA MANTIK KURALLARI
Her aday tez için nesnel boolean karnelerini doldururken ve buna bağlı kategorik risk seviyelerini seçerken aşağıdaki katı esleştirmelere uyunuz:

1. Konu/Araştırma Sorusu (Subject):
   - KRITIK: Temel araştırma sorusu aynıysa (same_core_question=true) veya kapsam yutuluyorsa (is_subsumed=true).
   - ORTA: Yoğun konu kesişimi varsa (significant_topic_intersection=true).
   - OZGUN: Sadece arka plan bilgisi düzeyindeyse veya kesişim yoksa.

2. Metodoloji (Methodology):
   - KRITIK: Veri toplama araçları ve analiz yöntemleri hedef tez ile doğrudan, açıkça ve şüpheye yer bırakmayacak şekilde birebir replika ise (identical_method_and_tools=true) veya yutuluyorsa (is_subsumed=true). 
     [KATI KURAL: Aday tezin özet metnindeki anlatım yüzeysel veya eksikse ve yöntemin %100 birebir replika olduğu metinden doğrudan KANITLANAMIYORSA, 'identical_method_and_tools' alanını KESİNLİKLE 'false' işaretleyiniz ve 'KRITIK' seviyesini pas geçiniz.]
   - ORTA: Yöntem %100 replika değilse veya replika olduğu net kanıtlanamıyorsa, ancak kısmi yöntemsel ortaklık, benzer veri toplama araçları veya ortak bir yaklaşım varsa (partially_shared_approach=true).
   - OZGUN: Yöntemsel tasarımlar, veri kaynakları ve analiz modelleri kökten farklıysa (different_empirical_design=true).
   
3. Kuramsal Çerçeve (Theory):
   - KRITIK: Üzerine inşa edilen teorik omurga aynıysa (same_theoretical_backbone=true) veya yutuluyorsa (is_subsumed=true).
   - ORTA: Kısmi kuramsal ortaklık veya ortak kavram referansları varsa (shared_concepts_only=true).
   - OZGUN: Kuramsal ekoller kökten farklıysa (different_epistemology=true).

4. Bağlam (Context):
   - KRITIK: Örneklem evreni, coğrafya ve dönem büyük ölçüde örtüşüyorsa (overlapping_universe_and_sample=true) veya yutuluyorsa (is_subsumed=true).
   - ORTA: Kısmi bağlamsal temas varsa (partial_contextual_contact=true).
   - OZGUN: Bağlamlar tamamen bağımsızsa (distinct_context=true).

# JÜRİ SAVUNMA ELEME KURALI
4 süzgecin (subject, methodology, theory, context) tamamında BİRDEN "OZGUN" seviyesinde kalan aday tezleri overlapTable dizisine DAHİL ETMEYİNİZ. En az bir eksende ORTA veya KRITIK risk taşıyan tüm tezler bu tabloda yer almalıdır.

# BİÇİMLENDİRME VE YASAKLAR
- "academic_reasoning" gerekçe alanı en fazla 3 cümleden oluşmalı; tamamen elit bir akademik Türkçe ile doğrudan sonuca odaklanmalıdır. Metin içinde asla programlama değişkenleri veya JSON anahtarları sızdırılmamalıdır.
- Yanıtı, sağlanan JSON şemasına tamamen uygun, doğrulanmış ve parse edilebilir bir ham JSON nesnesi olarak döndürünüz.

# UZMAN FEW-SHOT ÖRNEĞİ
Aşağıdaki örnek, girdi ve beklenen çıktı arasındaki yapısal ve kategorik eşleşmeyi göstermektedir.

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
      "academic_reasoning": "Aday çalışma, hedef tezle aynı kuramsal çerçeveyi, coğrafi bağlamı ve benzer bir yöntemi paylaşmaktadır. Ancak temel araştırma sorusu bağlamında, hedef tezin odaklandığı aktif işçi direnişi ve karşı-davranış stratejileri boyutunu içermemekte, yalnızca kurumsal denetimin etkilerine odaklanmaktadır. Bu durum iki çalışma arasında yoğun bir konu ve bağlam kesişimi yaratmakla birlikte tam bir yutulma veya birebir aynılık oluşturmamaktadır.",
      "subject_scorecard": {
        "same_core_question": false,
        "is_subsumed": false,
        "significant_topic_intersection": true,
        "background_mention_only": false
      },
      "subject_overlap": "ORTA",
      "methodology_scorecard": {
        "identical_method_and_tools": false,
        "is_subsumed": false,
        "partially_shared_approach": true,
        "different_empirical_design": false
      },
      "methodology_overlap": "ORTA",
      "theory_scorecard": {
        "same_theoretical_backbone": false,
        "is_subsumed": false,
        "shared_concepts_only": true,
        "different_epistemology": false
      },
      "theory_overlap": "ORTA",
      "context_scorecard": {
        "overlapping_universe_and_sample": true,
        "is_subsumed": false,
        "partial_contextual_contact": false,
        "distinct_context": false
      },
      "context_overlap": "KRITIK"
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
