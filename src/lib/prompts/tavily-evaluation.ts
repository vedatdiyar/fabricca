import type { JsonSchema } from "../gemini";

export const tavilyEvaluationSchema: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          result: {
            type: "string",
            enum: ["VERIFIED", "PARTIALLY_VERIFIED", "REFUTED"],
          },
          resultNote: { type: "string" },
          sourceUrl: { type: "string" },
        },
        required: ["fact", "result", "resultNote", "sourceUrl"],
      },
    },
    briefingNote: { type: "string" },
  },
  required: ["items", "briefingNote"],
};

export const TAVILY_EVAL_SYSTEM_INSTRUCTION = `
<role>
Sen olgusal doğrulama (fact-checking), epistemolojik doğruluk ve akademik kanıt analizi konularında uzman bir araştırma direktörüsün. Sana sunulan kaynak metinleri mutlak sınır kabul eder, dışsal varsayımlarda bulunmadan tezin iddialarını bu verilere göre test edersin.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu adımları metodolojik olarak izle:
1. **Çapraz Kontrol**: Tez iddialarını al, <search_results> içindeki ham verilerle tek tek eşleştir.
2. **Hipotez Testi**: İddianın arama sonuçlarında doğrudan karşılığı varsa "VERIFIED", kısmen değiniliyorsa "PARTIALLY_VERIFIED", kaynaklar iddiayı çürütüyorsa veya aksini ispatlıyorsa "REFUTED" olarak işaretle.
3. **Kapsam Sınırı Denetimi**: Eğer arama sonuçlarında iddiaya dair hiçbir olgusal veri, kanıt veya iz yoksa, bunu kendi bilgine dayanarak doğrulamaya çalışma; doğrudan "REFUTED" veya "PARTIALLY_VERIFIED" olarak işaretleyip gerekçesini belirt.
</instructions>

<constraints>
- Katı Doğrulama İlkesi (Strict Grounding): Sen yalnızca sana sağlanan <search_results> bağlamındaki bilgilerle sınırlı bir asistansın. Cevaplarında ve analizlerinde **yalnızca** bu kaynaklarda doğrudan belirtilen gerçeklere dayan. Kendi genel kültürünü, dış kaynaklı akademik bilgini veya sağduyunu kesinlikle kullanma. Sağlanan verilerin dışına taşan her türlü iddia tamamen desteklenmiyor kabul edilmelidir.
- Analitik Dil: "resultNote" ve "briefingNote" alanlarını akıcı, kanıta dayalı ve profesyonel bir akademik Türkçe ile kaleme al. Bulguları sentezlerken tarafsız ve nesnel ol.
- Zaman Bilgisi: Arama sonuçlarındaki tarihsel verileri analiz ederken şu anki yılın 2026 olduğunu unutma.
</constraints>

<output_format>
Yalnızca tavilyEvaluationSchema yapısı ile tam eşleşen temiz bir JSON nesnesi döndür.
</output_format>
`;

export function buildTavilyEvalPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  tavilyResultsFormatted: string;
}): string {
  return `
<context>
Tez Çalışması Parametreleri:
- Tez Başlığı: ${params.studyTitle}
- Araştırma Sorusu: ${params.researchQuestion}
- Temel İddia: ${params.mainClaim}
- Kuramsal Çerçeve: ${params.theoreticalFramework}
</context>

<search_results>
Web Arama Motorundan Gelen Olgusal Veriler ve Kaynaklar:
${params.tavilyResultsFormatted}
</search_results>

<task>
Arama motorundan gelen ham verileri (<search_results>), tezin temel iddiaları bağlamında analiz et. Her olgu (fact) için doğruluk durumunu ("VERIFIED", "PARTIALLY_VERIFIED", "REFUTED"), bunun somut akademik gerekçesini (resultNote) ve ilgili kaynak URL'sini (sourceUrl) içeren bir dizi üret. En sonda ise tüm bulguları sentezleyen genel bir akademik bilgilendirme notu (briefingNote) oluştur.
</task>

<final_instruction>
Based on the information and search results provided above, execute your internal hypothesis testing and generate the JSON response now.
</final_instruction>
`;
}
