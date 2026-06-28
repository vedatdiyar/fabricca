import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (Düz 7 Boolean + 7 Evidence Yapısı)
// ============================================================================
export const geminiAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    overlapTable: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          subject_has_same_primary_actor: {
            type: "boolean",
            description:
              "Aday tezin araştırdığı temel aktör/nesne/olgu hedef tezinkiyle birebir aynı mı?",
          },
          subject_has_same_primary_actor_evidence: { type: "string" },
          subject_has_secondary_layer: {
            type: "boolean",
            description:
              "Hedef tezde, aday tezin konusunun üzerine fazladan İKİNCİL BİR BAKIŞ, EK BİR TARAF, EK BİR AKTÖR veya ÖZGÜL BİR BOYUT eklenmiş mi? (Aday tek bir odağı incelerken, hedef ek bir aktör/etkileşim ekliyorsa TRUE)",
          },
          subject_has_secondary_layer_evidence: { type: "string" },
          theory_has_same_primary_framework: {
            type: "boolean",
            description:
              "İki çalışmanın kullandığı temel kuramsal model/paradigma birebir aynı mı?",
          },
          theory_has_same_primary_framework_evidence: { type: "string" },
          theory_has_secondary_framework: {
            type: "boolean",
            description:
              "Hedef tezde, aday tezde olmayan İKİNCİL/EK bir kuramsal kavram, entegre model veya farklı bir paradigma/ekol var mı? (Hedefte adaydakine ek bir kuramsal araç veya entegre model varsa TRUE)",
          },
          theory_has_secondary_framework_evidence: { type: "string" },
          context_spatial_match: {
            type: "boolean",
            description:
              "İki çalışmanın coğrafi/mekânsal/kurumsal alanı birebir aynı mı?",
          },
          context_spatial_match_evidence: { type: "string" },
          context_temporal_covers: {
            type: "boolean",
            description:
              "Aday tezin zaman dilimi hedef tezin dönemini bütünüyle kapsıyor (⊇) veya onunla birebir çakışıyor mu? (Aday çalışma dönemi daha geniş bir aralığı kapsıyor veya tam örtüşüyorsa TRUE)",
          },
          context_temporal_covers_evidence: { type: "string" },
          mainClaimMatched: {
            type: "boolean",
            description:
              "Aday tezin temel bulgusu/iddiası hedef tezin merkezi iddiasıyla doğrudan örtüşüyor mu?",
          },
          mainClaimMatched_evidence: { type: "string" },
        },
        required: [
          "id",
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
      },
    },
  },
  required: ["overlapTable"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (Deneysel Alanda Doğrulanmış Arınmış Talimat)
// ============================================================================

/**
 * Jüri ve Özgünlük Risk Analizi için Gemini modeline verilecek sistem talimatını oluşturur.
 * Deneysel süreçte doğrulanmış kısa ve nesnel talimat metni kullanılır.
 *
 * @returns Sistem talimatı metni
 */
export function buildAnalysisSystemInstruction(): string {
  return `Sen bir Literatür Boşluğu Uzmanısın. Sen yorum yapma. Sadece verilen metinlerde ek aktör, ek kuram var mı, zaman/mekan örtüşüyor mu nesnel olarak kontrol et ve boolean şemayı doldur. Kelime benzerliklerine kanma, hedef tezde fazladan ikincil katman/ek aktör varsa secondary_layer ve secondary_framework alanlarını dürüstçe TRUE yap. Yanıtı yalnızca sağlanan JSON şemasına tam uygun bir JSON nesnesi olarak döndür.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

/**
 * Aday tezlerin analiz edilmesi için kullanıcı promptu oluşturur.
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

Görev: Yukarıda sağlanan her bir aday tezi, hedef tez matrisiyle karşılaştırarak 7 nesnel boolean kriteri (konu, ikincil katman, kuram, ikincil kuram, mekân, zaman, iddia) değerlendir ve sonucu belirlenen JSON şemasında döndür. Her boolean kararının yanındaki evidence alanına metinlerden somut alıntı/kavram yaz.`;
}
