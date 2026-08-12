import { buildPromptPayload, type PromptPayload } from "@/lib/ai/prompt-builder";

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
 *
 * @param input - Matrix context and sub-box metadata.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildSemanticQueryPromptPayload(
  input: SemanticQueryInput
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
      "Siz, tüm akademik disiplinlerdeki (Sosyal Bilimler, Mühendislik, Tıp, Ekonomi, Fen vb.) tez çalışmaları için OpenAlex `search.semantic` arama motoruna özel yüksek kaliteli ve odaklanmış İngilizce akademik arama sorguları üreten kıdemli bir bilgi bilimi uzmanısınız.",

    primaryTask:
      "Size verilen Genel Tez Matrisini, ilgili Alt Kutuyu (Sub-Box) ve Alt Kutuya ait Anahtar Kavramları (`concepts`) analiz ederek; OpenAlex'in GTE-Large-EN vektör modeline doğrudan beslenecek 150-250 karakterlik son derece yoğun, doğal akademik dilde İngilizce arama sorguları üretin.",

    rulesAndConstraints: `1. **Akademik Karşılık Dönüşümü (Scholarly Mapping)**: Terimleri resmi, kanonik akademik İngilizce karşılıklarına dönüştürün.
2. **Odaklanmış Kuramsal Yazarlar ve Kavramlar**: Sorgularda doğrudan temel kuramsal kavramlara ve klasik tarihsel kuramcılara odaklanın.
3. **Kapsamlı Bağlam ve Kavram Bütünlüğü**: Alt kutuya ait verilen \`concepts\` anahtar terimlerini doğal akademik araştırma cümlesi akışında harmanlayın.
4. **Sözdizimi ve Format Kuralları**: Arama sorgularını tırnak işareti, boolean operatörü içermeyen yalın İngilizce araştırma cümleleri (150-250 karakter) olarak kurgulayın.
5. **Kutu Türü İzolasyonu**:
   - **SUBJECT_PROBLEM**: Ampirik vakaya, aktörlere ve konuya odaklanın.
   - **THEORETICAL_FRAMEWORK**: Sadece soyut kuramsal çerçeveye ve teorik kavramlara odaklanın.
   - **METHODOLOGY**: Sadece araştırma yöntemine ve analiz tekniklerine odaklanın.
   - **PRIMARY_MATERIAL**: Boş string (\`""\`) döndürün.`,

    outputFormat:
      "Her alt kutu için `subBoxTitle` ve `semanticQuery` alanlarını içeren JSON nesneleri dizisi döndürün.",

    inputContext: `${matrixContext}

# İşlenecek Alt Kutular:
Aşağıda tez alt kutuları listelenmiştir. Her bir alt kutu için box türüne uygun izolasyon ve kanonik dönüştürme kurallarına göre bir OpenAlex \`search.semantic\` sorgusu üretin.

${parts.join("\n\n")}

# Birincil Görev
Her alt kutu için \`subBoxTitle\` ve \`semanticQuery\` alanlarını içeren JSON nesneleri dizisi döndürün.`,
  });
}
