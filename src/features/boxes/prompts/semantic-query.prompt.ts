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
    ? `# Girdinin Genel Tez Matrisi Bağlamı:
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

    examples: `## Örnek 1: Nitel Söylem Analizi ve Kodlama Şeması (METHODOLOGY)
### Girdi
- Box Türü: METHODOLOGY
- Sub-Box Başlığı: "Tarihsel ve Söylemsel Kodlama"
- Açıklama: "Birincil siyasal kaynakların talep tipolojisi ve kodlama şeması ile nitel söylem analizi."
- Anahtar Kavramlar: [Söylem Analizi, Talep Tipolojisi, Kodlama Şeması, Tarihsel İnşa]
### Çıktı
{
  "subBoxTitle": "Tarihsel ve Söylemsel Kodlama",
  "semanticQuery": "Qualitative discourse-historical approach and qualitative content analysis of political texts using systematic coding frames, category systems, and demand typologies."
}

## Örnek 2: Kuramsal Çerçeve (THEORETICAL_FRAMEWORK)
### Girdi
- Box Türü: THEORETICAL_FRAMEWORK
- Sub-Box Başlığı: "Gramsciyen Hegemonya ve Mevzi Savaşı"
- Açıklama: "Antonio Gramsci'nin hegemonya, karşı-hegemonya ve mevzi savaşı kuramı."
- Anahtar Kavramlar: [Hegemonya, Mevzi Savaşı, Karşı-Hegemonya]
### Çıktı
{
  "subBoxTitle": "Gramsciyen Hegemonya ve Mevzi Savaşı",
  "semanticQuery": "Antonio Gramsci hegemony counter-hegemony war of position and passive revolution in political theory and state power."
}

## Örnek 3: Ampirik Vaka (SUBJECT_PROBLEM)
### Girdi
- Box Türü: SUBJECT_PROBLEM
- Sub-Box Başlığı: "Yasal Kürt Siyaseti ve HEP-HADEP Çizgisi"
- Açıklama: "1990'lı yıllarda yasal Kürt partilerinin siyasal söylemleri ve talepleri."
- Anahtar Kavramlar: [HEP, HADEP, Kürt Hareketi]
### Çıktı
{
  "subBoxTitle": "Yasal Kürt Siyaseti ve HEP-HADEP Çizgisi",
  "semanticQuery": "Kurdish political movement in Turkey HEP DEP HADEP parliamentary politics discourse and legal party mobilization during the 1990s."
}`,

    inputContext: `${matrixContext}

# İşlenecek Alt Kutular:
Aşağıda tez alt kutuları listelenmiştir. Her bir alt kutu için box türüne uygun izolasyon, paradigma disiplini ve kanonik dönüştürme kurallarına göre bir OpenAlex \`search.semantic\` sorgusu üretin.

${parts.join("\n\n")}

# Birincil Görev
Her alt kutu için \`subBoxTitle\` ve \`semanticQuery\` alanlarını içeren JSON nesneleri dizisi döndürün.`,
  });
}
