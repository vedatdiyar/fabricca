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

    rulesAndConstraints: `1. **Akademik Karşılık Dönüşümü (Scholarly Mapping)**: Terimleri resmi, uluslararası literatürde kabul görmüş kanonik akademik İngilizce karşılıklarına dönüştürün.
2. **Kutu Türü İzolasyonu ve Paradigma Disiplini**:
   - **SUBJECT_PROBLEM**: Yalnızca tezin incelediği ampirik vakaya, aktörlere, döneme ve coğrafyaya odaklanın. Soyut kuramsal terimleri ve genel yöntem adlarını hariç tutun.
   - **THEORETICAL_FRAMEWORK**: Yalnızca soyut kuramsal çerçeveye, kavramsal modellere ve temel teorisyenlere odaklanın. Ampirik vaka aktörlerini hariç tutun.
   - **METHODOLOGY**: Tezin benimsediği araştırma paradigmasına (Nitel vs. Nicel) kesinlikle sadık kalın:
     - **Nitel Araştırmalar (Söylem, Nitel İçerik, Yorumsama):** Kanonik nitel metodoloji literatürüne odaklanın (*Qualitative Discourse Analysis, Discourse-Historical Approach (DHA), Qualitative Content Analysis, Category & Coding Frame Development, Thematic Analysis*). Hesaplamalı veya algoritmik ("text as data", "machine learning", "automated content analysis", "topic modeling", "natural language processing", "wordscores") ifadeleri hariç tutun.
     - **Nicel Araştırmalar:** İlgili istatistiksel, ekonometrik veya sayısal modelleme tekniklerinin metodolojik literatürüne odaklanın.
     - Yöntem kutularında vaka aktörlerini (parti, örgüt, kişi adları vb.) sorguya dahil etmeyin; yöntemin akademik literatürünü hedefleyin.
   - **PRIMARY_MATERIAL**: Boş string (\`""\`) döndürün.
3. **Kapsamlı Bağlam ve Kavram Bütünlüğü**: Alt kutuya ait verilen \`concepts\` anahtar terimlerini doğal akademik araştırma cümlesi akışında harmanlayın.
4. **Sözdizimi ve Format Kuralları**: Arama sorgularını tırnak işareti, boolean operatörü (AND/OR/NOT) içermeyen yalın ve yoğun İngilizce araştırma cümleleri (150-250 karakter) olarak kurgulayın.`,

    workflowSteps: `1. Her bir alt kutunun türünü (\`boxType\`), açıklamasını, kavramlarını ve Genel Tez Matrisindeki metodolojik/kuramsal bağlamı inceleyin.
2. \`METHODOLOGY\` türündeki kutular için matristeki araştırma paradigmasını (Nitel / Söylemsel / Yorumlayıcı) tespit edin ve yönteme uygun kanonik terimleri seçin.
3. Kutu türü izolasyon kurallarına tam uyarak her alt kutu için 150-250 karakterlik İngilizce semantik arama sorgusunu oluşturun.`,

    outputFormat:
      "Her alt kutu için `subBoxTitle` ve `semanticQuery` alanlarını içeren JSON nesneleri dizisi döndürün.",

    examples: `<example>
<input>
Box Türü: METHODOLOGY
Sub-Box Başlığı: "Tarihsel ve Söylemsel Kodlama"
Açıklama: "Birincil kurumsal politika kaynaklarının talep tipolojisi ve kodlama şeması ile nitel söylem analizi."
Anahtar Kavramlar: [Söylem Analizi, Talep Tipolojisi, Kodlama Şeması, Tarihsel İnşa]
</input>
<output>
{
  "subBoxTitle": "Tarihsel ve Söylemsel Kodlama",
  "semanticQuery": "Qualitative discourse-historical approach and qualitative content analysis of policy texts using systematic coding frames, category systems, and demand typologies."
}
</output>
</example>

<example>
<input>
Box Türü: THEORETICAL_FRAMEWORK
Sub-Box Başlığı: "Kurumsal Teori ve Yol Bağımlılığı"
Açıklama: "Tarihsel kurumsalcılık, yol bağımlılığı ve kurumsal kilitlenme kuramsal modeli."
Anahtar Kavramlar: [Tarihsel Kurumsalcılık, Yol Bağımlılığı, Kurumsal Değişim]
</input>
<output>
{
  "subBoxTitle": "Kurumsal Teori ve Yol Bağımlılığı",
  "semanticQuery": "Historical institutionalism path dependency critical junctures institutional change and lock-in mechanisms in public policy and governance."
}
</output>
</example>

<example>
<input>
Box Türü: SUBJECT_PROBLEM
Sub-Box Başlığı: "Yenilenebilir Enerji Politikaları ve Yerel Yönetişim"
Açıklama: "Gelişmekte olan ülkelerde yerel paydaşların yenilenebilir enerjiye geçiş dinamikleri."
Anahtar Kavramlar: [Yenilenebilir Enerji, Yerel Yönetişim, Paydaş Katılımı]
</input>
<output>
{
  "subBoxTitle": "Yenilenebilir Enerji Politikaları ve Yerel Yönetişim",
  "semanticQuery": "Renewable energy policy transition local governance citizen participation stakeholder mobilization and sustainable regional development in emerging economies."
}
</output>
</example>`,

    inputContext: `${matrixContext ? `${matrixContext}\n\n` : ""}### İşlenecek Alt Kutular:
${parts.join("\n\n")}`,

    taskTrigger:
      "Yukarıdaki <context> içindeki her alt kutuyu inceleyerek <instructions> kurallarına göre `subBoxTitle` ve `semanticQuery` alanlarını içeren JSON çıktısını üret.",
  });
}
