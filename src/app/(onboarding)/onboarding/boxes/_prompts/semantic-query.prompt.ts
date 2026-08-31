import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

export interface SemanticQueryInput {
  matrix?: {
    subjectProblem?: string;
    theoreticalFramework?: string;
    methodology?: string;
  };
  subBoxes: {
    title: string;
    boxType: string;
    description: string;
    concepts?: string[];
  }[];
}

/**
 * Builds the standardized PromptPayload for OpenAlex semantic query generation.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Sections 3, 4, 6 & 7).
 *
 * @param input - Matrix context and sub-box metadata.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildSemanticQueryPromptPayload(
  input: SemanticQueryInput,
): PromptPayload {
  const matrixContext = input.matrix
    ? `### Genel Tez Matrisi Bağlamı:
- Araştırma Problemi: ${input.matrix.subjectProblem || "Belirtilmemiş"}
- Teorik Çerçeve: ${input.matrix.theoreticalFramework || "Belirtilmemiş"}
- Yöntem: ${input.matrix.methodology || "Belirtilmemiş"}`
    : "";

  const parts = input.subBoxes.map((sb) => {
    const conceptsText =
      sb.concepts && sb.concepts.length > 0
        ? sb.concepts.join(", ")
        : "Belirtilmemiş";
    return `Sub-Box Başlığı: "${sb.title}"
Box Türü: ${sb.boxType}
Açıklama: ${sb.description ?? ""}
Anahtar Kavramlar (Concepts): [${conceptsText}]`;
  });

  return buildPromptPayload({
    roleAndExpertise:
      "Siz, tüm akademik disiplinlerdeki tez çalışmaları için OpenAlex `search.semantic` arama motoruna özel yüksek kaliteli, disiplin içi kanonik kavramlarla donatılmış ve odaklanmış İngilizce akademik arama sorguları üreten kıdemli bir bilgi bilimi ve araştırma metodolojisi uzmanısınız.",

    primaryTask:
      "Size verilen Genel Tez Matrisini, ilgili Alt Kutuyu (Sub-Box) ve Alt Kutuya ait Anahtar Kavramları (`concepts`) analiz ederek; OpenAlex'in GTE-Large-EN vektör modeline doğrudan beslenecek 150-250 karakterlik son derece yoğun, doğal akademik dilde İngilizce arama sorguları üretin.",

    rulesAndConstraints: `1. **Sıkı Çapalama ve Sıfır Uydurma (Strict Grounding & Zero Extrapolation)**:
   - Yalnızca ve yalnızca kutu başlığında (\`title\`), açıklamasında (\`description\`) ve anahtar kavramlarında (\`concepts\`) açıkça yer alan kuramsal modelleri, kuramcıları, araştırma yöntemlerini veya ampirik aktörleri kullanın.
   - Girdide açıkça yer almayan hiçbir genel teorik jargonu, yan teoriyi, soyut şemsiye kavramları veya genel geçer akademik süs kelimelerini kesinlikle sorguya eklemeyin.
2. **Akademik Karşılık Dönüşümü (Scholarly Mapping)**: Terimleri uluslararası literatürde kabul görmüş kanonik akademik İngilizce karşılıklarına dönüştürün.
3. **Kutu Türü İzolasyonu ve Odaklanma**:
   - **SUBJECT_PROBLEM**: Yalnızca tezin incelediği ampirik vakaya, aktörlere, spesifik döneme ve coğrafyaya odaklanın. Soyut kuramsal terimleri ve yöntem adlarını hariç tutun.
   - **THEORETICAL_FRAMEWORK**: Kutu başlığı ve açıklamasındaki spesifik kuramsal modele, operasyonel mekanizmaya ve belirtilen kuramcıların isimlerine odaklanın. Genel şemsiye kavramlarla sorguyu seyreltmeyin. Ampirik vaka aktörlerini hariç tutun.
   - **METHODOLOGY**: Tezin ve alt kutunun benimsediği araştırma desenine ve analiz yöntemine (nitel, nicel, karma yöntem, ekonometrik, deneysel vb.) tam sadık kalın. Yalnızca ilgili yöntemin metodolojik literatürünü hedefleyin; vaka aktörlerini hariç tutun.
   - **PRIMARY_MATERIAL**: Boş string (\`""\`) döndürün.
4. **Sözdizimi ve Format Kuralları**: Arama sorgularını tırnak işareti ve mantıksal boolean operatörleri (AND/OR/NOT) içermeyen, en fazla 5-8 anahtar kelimelik yalın ve yüksek kesinlikli İngilizce arama sorguları olarak kurgulayın.`,

    workflowSteps: `1. Her bir alt kutunun türünü (\`boxType\`), açıklamasını, kavramlarını ve Genel Tez Matrisindeki bağlamı inceleyin.
2. Kutu türü izolasyon kurallarına ve Strict Grounding prensibine tam uyarak yalnızca verilen girdideki özgül kavramları içeren İngilizce semantik arama sorgusunu oluşturun.`,

    outputFormat:
      "Her alt kutu için `subBoxTitle` ve `semanticQuery` alanlarını içeren JSON nesneleri dizisi döndürün. Şema: [{\"subBoxTitle\": string, \"semanticQuery\": string}]",

    inputContext: `${matrixContext ? `${matrixContext}\n\n` : ""}### İşlenecek Alt Kutular:
${parts.join("\n\n")}`,

    taskTrigger:
      "Yukarıdaki <context> içindeki her alt kutuyu inceleyerek <instructions> kurallarına göre `subBoxTitle` ve `semanticQuery` alanlarını içeren JSON çıktısını üret.",
  });
}
