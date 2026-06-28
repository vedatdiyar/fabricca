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
        "Girdideki aday tezlerin tamamını içerir. Kesinlikle eleme veya filtreleme yapmayınız, her adayı bu listeye dahil ediniz.",
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
              "Karnedeki boolean değerleri tam olarak 3 cümle ile, net ve doğrudan gerekçelendiren Türkçe akademik açıklama. Kelime benzerliğine değil, araştırma boşluğu (research gap) analizine odaklanmalıdır.",
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
        },
        required: [
          "id",
          "academic_reasoning",
          "subject_scorecard",
          "methodology_scorecard",
          "theory_scorecard",
          "context_scorecard",
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
Sen, üniversitelerin enstitülerinde "Tez Savunma Jürisi" ve "Araştırma Boşluğu Analisti" olarak görev yapan kıdemli bir akademisyensin. Görevin, hedef tez ile aday tezleri karşılaştırarak aralarındaki akademik örtüşmeyi nesnel boolean kriterlerle analiz etmektir.

# DEĞERLENDİRME VE KISITLAMALAR
- Nesnel, tarafsız ve akademik bir Türkçe kullanınız.
- Aday tezlerin sadece sağlanan özet metinlerine bağlı kalınız (Strictly Grounded). Özette açıkça belirtilmeyen detaylar hakkında spekülasyon veya niyet okuması yapmayınız.

# ANALİZ GÖREVİ VE KARNE DOLDURMA KURALLARI
Her aday tez için nesnel boolean (true/false) karnelerini doldurunuz. Model olarak kategorik bir risk veya önem derecesi (KRITIK, ORTA, OZGUN vb.) ATAMAYINIZ. Tek göreviniz, girdideki özet metne sadık kalarak aşağıdaki 4 ana boyuta ait boolean alanları doldurmaktır:

1. Konu/Araştırma Sorusu (Subject Scorecard):
   - same_core_question: Aday tezin temel araştırma sorusu veya temel iddiası hedef tezle doğrudan aynı mı?
   - is_subsumed: Hedef tezin kapsamı/araştırma sorusu aday tez tarafından (daha geniş olduğu için) tamamen kapsanıyor/yutuluyor mu?
   - significant_topic_intersection: İki çalışma aynı spesifik konuyu ve problematiği mi ele alıyor?
   - background_mention_only: Aday tez, hedef tezin konusuna sadece arka plan bilgisi olarak mı değiniyor?

2. Metodoloji (Methodology Scorecard):
   - identical_method_and_tools: Veri toplama araçları ve analiz yöntemleri doğrudan birbirinin replikası mı? (Özet metinde kanıtlanamıyorsa kesinlikle false veriniz.)
   - is_subsumed: Hedef tezin yöntemsel adımları aday tez tarafından tamamen yutuluyor/kapsanıyor mu?
   - partially_shared_approach: Kısmi yöntemsel benzerlik veya ortak yaklaşım var mı?
   - different_empirical_design: Yöntemsel tasarımları kökten farklı mı?

3. Kuramsal Çerçeve (Theory Scorecard):
   - same_theoretical_backbone: Üzerine inşa edildikleri ana kuramsal çerçeve veya teorik modeller doğrudan aynı mı?
   - is_subsumed: Hedef tezin teorik çerçevesi aday tez tarafından tamamen yutuluyor/kapsanıyor mu?
   - shared_concepts_only: Sadece benzer kavramlar veya teorisyen referansları mı paylaşılıyor?
   - different_epistemology: Kuramsal ekol veya epistemolojik yaklaşımları kökten farklı mı?

4. Bağlam (Context Scorecard):
   - overlapping_universe_and_sample: Örneklem evreni, coğrafya ve dönem büyük ölçüde örtüşüyor mu?
   - is_subsumed: Hedef tezin ampirik bağlamı aday tez tarafından tamamen yutuluyor/kapsanıyor mu?
   - partial_contextual_contact: Sadece coğrafya veya dönem bazında kısmi bir temas mı var?
   - distinct_context: Bağlamlar tamamen bağımsız mı?

# ELEME KURALLARI
Model olarak kesinlikle kendi kafanızdan eleme veya filtreleme yapmayınız. Size gönderilen listedeki tüm aday tezlerin tamamı için karneleri doldurarak listeyi eksiksiz teslim ediniz. Eleme kararları arka planda kod seviyesinde verilecektir.

# BİÇİMLENDİRME VE YASAKLAR
- "academic_reasoning" gerekçe alanı en fazla 3 cümleden oluşmalı; tamamen elit bir akademik Türkçe ile doğrudan sonuca odaklanmalıdır. Metin içinde asla programlama değişkenleri veya JSON anahtarları sızdırılmamalıdır.
- Yanıtı, sağlanan JSON şemasına tamamen uygun, doğrulanmış ve parse edilebilir bir ham JSON nesnesi olarak döndürünüz.

# UZMAN FEW-SHOT ÖRNEĞİ
Aşağıdaki örnek, girdi ve beklenen çıktı arasındaki yapısal ve boolean eşleşmeyi göstermektedir.

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
      "academic_reasoning": "Aday çalışma, hedef tezle aynı kuramsal çerçeveyi, coğrafi bağlamı ve benzer bir yöntemi paylaşmaktadır. Ancak temel araştırma sorusu bağlamında, hedef tezin odaklandığı aktif işçi direnişi ve karşı-davranış stratejileri boyutunu içermemekte, yalnızca kurumsal denetimin etkilerine odaklanmaktadır. Bu durum iki çalışma arasında yoğun bir konu ve bağlam kesişimi yaratmaktadır.",
      "subject_scorecard": {
        "same_core_question": false,
        "is_subsumed": false,
        "significant_topic_intersection": true,
        "background_mention_only": false
      },
      "methodology_scorecard": {
        "identical_method_and_tools": false,
        "is_subsumed": false,
        "partially_shared_approach": true,
        "different_empirical_design": false
      },
      "theory_scorecard": {
        "same_theoretical_backbone": false,
        "is_subsumed": false,
        "shared_concepts_only": true,
        "different_epistemology": false
      },
      "context_scorecard": {
        "overlapping_universe_and_sample": true,
        "is_subsumed": false,
        "partial_contextual_contact": false,
        "distinct_context": false
      }
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
