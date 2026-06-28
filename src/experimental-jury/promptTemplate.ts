import type { JsonSchema } from "../lib/gemini";

// ============================================================================
// 1. VANILLA JSON SCHEMA (Strict JSON response mode)
// ============================================================================
export const JURY_RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    subject_has_same_primary_actor: {
      type: "boolean",
      description: "Aday tezin araştırdığı temel aktör/nesne/olgu hedef tezinkiyle birebir aynı mı?",
    },
    subject_has_same_primary_actor_evidence: {
      type: "string",
      description: "Her iki metinden bu kararı destekleyen somut alıntı/kavramlar.",
    },
    subject_has_secondary_layer: {
      type: "boolean",
      description: "Hedef tezde, aday tezin konusunun üzerine fazladan İKİNCİL BİR BAKIŞ, EK BİR TARAF, EK BİR AKTÖR veya ÖZGÜL BİR BOYUT eklenmiş mi? (Örn: aday tez sadece tek bir odağı incelerken, hedef tez o odağa ek olarak ikincil bir aktör veya etkileşim katmanı ekliyorsa TRUE)",
    },
    subject_has_secondary_layer_evidence: {
      type: "string",
      description: "Hedef metinde adayda olmayan ek aktör/taraf/boyutu gösteren alıntı.",
    },
    theory_has_same_primary_framework: {
      type: "boolean",
      description: "İki çalışmanın kullandığı temel kuramsal model/paradigma birebir aynı mı?",
    },
    theory_has_same_primary_framework_evidence: {
      type: "string",
      description: "Her iki metinden ortak kuram/kavram setini gösteren alıntılar.",
    },
    theory_has_secondary_framework: {
      type: "boolean",
      description: "Hedef tezde, aday tezde olmayan İKİNCİL/EK bir kuramsal kavram, entegre model veya farklı bir paradigma/ekol var mı? (Örn: hedef tezde aday tezdeki temel modele ek olarak ikincil bir kuramsal araç veya entegre bir model varsa TRUE)",
    },
    theory_has_secondary_framework_evidence: {
      type: "string",
      description: "Hedef metinde adayda olmayan ek kuram/kavram/ekolü gösteren alıntı.",
    },
    context_spatial_match: {
      type: "boolean",
      description: "İki çalışmanın coğrafi/mekânsal/kurumsal alanı birebir aynı mı?",
    },
    context_spatial_match_evidence: {
      type: "string",
      description: "Mekan ortaklığını gösteren alıntılar.",
    },
    context_temporal_covers: {
      type: "boolean",
      description: "Aday tezin zaman dilimi hedef tezin dönemini bütünüyle kapsıyor (⊇) veya onunla birebir çakışıyor mu? (Örn: aday çalışma dönemi daha geniş bir aralığı kapsıyor veya hedef aralıkla tam örtüşüyorsa TRUE)",
    },
    context_temporal_covers_evidence: {
      type: "string",
      description: "Zaman dilimi kapsama/çakışma ilişkisini gösteren alıntılar.",
    },
    mainClaimMatched: {
      type: "boolean",
      description: "Aday tezin temel bulgusu/iddiası hedef tezin merkezi iddiasıyla doğrudan örtüşüyor mu?",
    },
    mainClaimMatched_evidence: {
      type: "string",
      description: "İddia örtüşmesini gösteren alıntılar.",
    },
  },
  required: [
    "subject_has_same_primary_actor",
    "subject_has_same_primary_actor_evidence",
    "subject_has_secondary_layer",
    "subject_has_secondary_layer_evidence",
    "theory_has_same_primary_framework",
    "theory_has_same_primary_framework_evidence",
    "theory_has_secondary_framework",
    "theory_has_secondary_framework_evidence",
    "context_spatial_match",
    "context_spatial_match_evidence",
    "context_temporal_covers",
    "context_temporal_covers_evidence",
    "mainClaimMatched",
    "mainClaimMatched_evidence",
  ],
};

// ============================================================================
// 2. SİTEM TALİMATI
// ============================================================================
export const JURY_SYSTEM_INSTRUCTION = `Sen bir Literatür Boşluğu Uzmanısın. Sen yorum yapma. Sadece verilen metinlerde ek aktör, ek kuram var mı, zaman/mekan örtüşüyor mu nesnel olarak kontrol et ve boolean şemayı doldur.

subject_has_same_primary_actor: İki metin de aynı temel olguyu/aktörü mü inceliyor?
subject_has_secondary_layer: Hedef metinde adayda olmayan ek bir aktör/boyut var mı?
theory_has_same_primary_framework: İki metin de aynı temel kuramsal modeli mi kullanıyor?
theory_has_secondary_framework: Hedef metinde adayda olmayan ek bir kavram/model var mı?
context_spatial_match: Coğrafya/mekan aynı mı?
context_temporal_covers: Aday tezin dönemi hedefi kapsıyor (⊇) veya çakışıyor mu?
mainClaimMatched: İddialar örtüşüyor mu?

Yanıtı yalnızca sağlanan JSON şemasına tam uygun bir JSON nesnesi olarak döndür.`;

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================
export function buildJuryPrompt(
  matrix: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    methodology: string;
    researchScope: string;
    mainClaim: string;
  },
  candidate: {
    id: number;
    title: string;
    author: string;
    university: string;
    year: number;
    thesisType: string;
    department: string;
    abstract: string;
  },
): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${matrix.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${matrix.researchQuestion.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${matrix.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${matrix.methodology.replace(/"/g, '\\"')}",
  "researchScope": "${matrix.researchScope.replace(/"/g, '\\"')}",
  "mainClaim": "${matrix.mainClaim.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

<aday_tez>
{
  "id": ${candidate.id},
  "title": "${candidate.title.replace(/"/g, '\\"')}",
  "author": "${candidate.author}",
  "university": "${candidate.university}",
  "year": ${candidate.year},
  "thesisType": "${candidate.thesisType}",
  "department": "${candidate.department}",
  "abstract": "${candidate.abstract.replace(/"/g, '\\"')}"
}
</aday_tez>

Görev: Yukarıdaki aday tezi yukarıdaki nesnel kriterlere göre değerlendir ve JSON şemasına uygun çıktıyı üret. Her boolean kararının yanında evidence alanına metinlerden somut alıntı/kavram yaz.`;
}