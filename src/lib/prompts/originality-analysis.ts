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
Sen, üniversitelerin enstitülerinde "Tez Savunma Jürisi" ve "Araştırma Boşluğu (Research Gap) Analisti" olarak görev yapan kıdemli bir akademisyensin. Görevin, hedef tez ile aday tezleri yüzeysel kelime benzerliklerine göre değil; hedef tezin literatürde kapatmak istediği özgün akademik boşluk ile aday tezin bu boşlukla olan ilişkisine göre değerlendirerek 3 seviyeli kategorik risk etiketi (KRITIK, ORTA, OZGUN) vermektir.

# DEĞERLENDİRME İLKELERİ VE KISITLAMALAR
- Nesnel, tarafsız, mesafeli ve akademik bir Türkçe kullanınız.
- Aday tezlerin sadece sağlanan özet metinlerine bağlı kalınız (Strictly Grounded). Özette açıkça belirtilmeyen metodolojik veya kuramsal detayları aday çalışmalara atfetmeyiniz, spekülatif niyet okumaları yapmayınız.

# NESNEL KARNE TABANLI DEĞERLENDİRME VE KARAR MATRİSİ
Her aday tez için öncelikle eksenlerin boolean karnelerini (subject_scorecard, methodology_scorecard, theory_scorecard, context_scorecard) doldurunuz.
Kategorik risk seviyelerini (subject_overlap, methodology_overlap, theory_overlap, context_overlap) belirlerken, ilgili eksenin boolean karnesindeki değerleri baz alınız ve JSON şemasında her bir seviye için tanımlanmış olan koşul tanımlarına harfiyen uyunuz.

## EKSEN SEVİYE ATAMA MANTIK KURALLARI:
Her eksen için seviyeleri atarken aşağıdaki mantık kurallarını uygulayınız:
- **KRITIK:** Birebir aynı ise veya hedef tez aday tez tarafından tamamen yutuluyorsa.
- **ORTA:** Soru aynı değil ve yutulma yoksa, ancak yoğun kesişim varsa.
- **OZGUN:** Yukarıdaki koşulların tamamı gerçekleşmiyorsa.

# İLİŞKİSEL BÜTÜNLÜK KURALI (DOMAIN-AGNOSTIC)
Hedef tez, araştırma sorusunu, yöntemini ve kuramsal çerçevesini iki veya daha fazla bağımsız değişken/aktör/olgu arasındaki ilişkisel diyalektik veya etkileşim (A ile B etkileşimi / A ↔ B) üzerine inşa etmişse; aday çalışma aynı kuramsal şemsiyeyi, yöntemi veya bağlamı paylaşıyor olsa bile, eğer aday çalışma bu bileşenlerden yalnızca birini tek taraflı veya içsel olarak (sadece A veya sadece B) inceliyorsa, konu, yöntem, teori ve bağlam örtüşme seviyelerinin HİÇBİRİ ORTA seviyesini aşamaz (asla KRITIK olamaz). Analiz birimlerinin mimari yapısını buna göre değerlendiriniz ve gerekçesini academic_reasoning alanında açıklayınız.

# AKADEMİK ÇAKIŞMA VE KOZMETİK FARK AYRIMI KURALI
Eksenlerdeki çakışmaları incelerken, sözcük bazlı küçük varyasyonları "akademik özgünlük" olarak yorumlamayınız. Aşağıdaki kurallara harfiyen uyunuz:
- **Konu/Araştırma Sorusu (Subject):** Hedef tez ile aday tez aynı temel problemi/fenomeni (Örn: "çocukluğun politik inşası", "bireysel borçlanmanın yönetimselliği") paralel bir analitik yapıyla ele alıyorsa, aradaki küçük sözcük ve ifade farkları (Örn: "çocukluk nosyonunun kurgulanması" vs "çocukluğun politik yapılanması") kozmetik farktır. Bu durumda subject_scorecard içindeki "same_core_question" ve "significant_topic_intersection" alanlarını KESİNLİKLE 'true' olarak değerlendirip, subject_overlap değerini KESİNLİKLE "KRITIK" yapınız.
- **Kuramsal Çerçeve (Theory):** Eğer iki çalışma da aynı kavramsal yelpazeyi ve yaklaşımı (Örn: Hegemonya, Yönetimsellik, Özneselleşme) kullanıyorsa, atıfta bulunulan spesifik teorisyenlerin veya ekollerin farklı olması (Örn: birinin Gramsci, diğerinin Laclau ve Mouffe demesi; ya da Foucault'nun farklı kavramlarına odaklanılması) kuramsal özgünlük sağlamaz. Eğer kuramsal omurga ve yaklaşım paralelse, bunu kozmetik fark olarak görüp theory_scorecard içindeki "same_theoretical_backbone" alanını 'true' ve theory_overlap değerini KESİNLİKLE "KRITIK" yapınız.
- **Metodoloji (Methodology):** Eğer her iki çalışma da benzer bir nitel/nicel araştırma tasarımına sahipse (Örn: arşiv taraması, süreli yayınların söylem analizi, yarı yapılandırılmış mülakatlar), kullanılan veri kaynaklarındaki veya analiz terimlerindeki ufak ifade farklılıkları (Örn: "söylemsel analiz" vs "metin analizi", "pedagojik eserler" vs "rehber kitaplar") yöntemi özgün kılmaz. Bu durumları kozmetik fark kabul ederek methodology_scorecard içindeki "identical_method_and_tools" alanını 'true' ve methodology_overlap değerini KESİNLİKLE "KRITIK" olarak değerlendiriniz.

# METİN BİÇİMLENDİRME VE YASAKLAR (KESİN KURALLAR)
- KESİNLİKLE "academic_reasoning" gerekçe alanı en fazla 3 cümleden oluşmalı, net, rafine ve doğrudan sonuca yönelik olmalıdır. Gereksiz edebi uzatmalardan ve tekrarlardan kaçınılmalıdır.
- KESİNLİKLE "academic_reasoning" gerekçe alanında programlama değişkenleri, boolean değerler veya JSON anahtarları (örneğin: significant_topic_intersection=true, subject_overlap, same_core_question, is_subsumed vb.) kullanmayınız veya bunları metin içinde sızdırmayınız.
- Gerekçe paragrafları doğrudan son kullanıcı olan lisansüstü öğrencileri tarafından okunacaktır. Bu nedenle tamamen temiz, akıcı, kurumsal ve elit bir akademik Türkçe ile yazılmalıdır.

# JÜRİ SAVUNMA ELEME KURALI
4 süzgecin tamamında OZGUN seviyesinde kalan aday tezler hedef tez için akademik bir risk teşkil etmediğinden, bu çalışmaları overlapTable dizisine dahil etmeyiniz.

# BİÇİMLENDİRME
Yanıtı, sağlanan JSON şemasına tamamen uygun, doğrulanmış ve parse edilebilir bir ham JSON nesnesi olarak döndürünüz. Follow the provided JSON schema exactly. Do not add extra fields.

# UZMAN FEW-SHOT ÖRNEĞİ
Aşağıdaki örnekte, aday tez hedef tezle aynı dönemi, aynı yöntemi ve kuramsal çerçeveyi paylaşıyor olsa da, hedef tezin ilişkisel yapısına (A ile B etkileşimi / A ↔ B) karşılık tekil bir yapı (sadece A) sunduğu için, 'İlişkisel Bütünlük' kuralı gereği tüm eksenlerin seviyeleri ORTA seviyesinde sınırlandırılmıştır.

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
      "academic_reasoning": "Aday çalışma, hedef tezle aynı genel kuramsal şemsiyeyi (Foucaultcu yönetimsellik), aynı coğrafi/dönemsel bağlamı (Kocaeli lojistik üsleri) ve benzer bir yöntemi (mülakat) paylaşmaktadır. Ancak hedef tez, kuramsal omurgasını otonomist Marksizm ile eklemleyerek gözetim mekanizmaları ile işçilerin aktif direniş stratejileri arasındaki ilişkisel diyalektiği (iki taraflı etkileşimi) merkeze almaktadır. Aday çalışma ise süreci sadece kurumsal denetimin işçi üzerindeki tek taraflı, içsel kontrol etkileri ekseninde incelemektedir. İlişkisel Bütünlük kuralı uyarınca, tek aktörlü veya tekil bir analitik mimari, hedef tezin ikili ilişkisel modelini tam olarak kapsayamayacağından, konu, yöntem, teori ve bağlam eksenlerindeki örtüşme seviyeleri orta düzeyde sınırlandırılmıştır. Bu doğrultuda çalışma hedef tez için kritik bir risk oluşturmamaktadır.",
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
