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
      "Siz, tüm akademik disiplinlerdeki lisansüstü tez çalışmaları için hem OpenAlex'in GTE-Large-EN vektör motoruna hem de akademik hibrit anahtar kelime motoruna özel yüksek kaliteli, hedeflenmiş ve disiplinlerarası kanonik İngilizce arama sorguları üreten kıdemli bir bilgi bilimi ve araştırma metodolojisi uzmanısınız.",

    primaryTask:
      "Size verilen Genel Tez Matrisini, ilgili Alt Kutuyu (Sub-Box) ve Alt Kutuya ait Anahtar Kavramları (`concepts`) analiz ederek; her alt kutu için eşzamanlı olarak iki farklı arama sorgusu üretin: (1) OpenAlex GTE-Large-EN vektör modeli için zengin ve yoğun bir akademik araştırma paragrafı (`openAlexQuery`), (2) Hibrit başlık ve anahtar kelime araması için odaklanmış anahtar kelime/terim öbeği sorgusu (`semanticScholarQuery`).",

    rulesAndConstraints: `1. **Bütünsel Tez Matrisi ve Alt Kutu Çapalaması (Holistic Matrix & Sub-Box Grounding)**:
   - İlgili alt kutunun ait olduğu kadranın Genel Tez Matrisindeki detaylarından, alt kutu başlığından (\`title\`), açıklamasından (\`description\`) ve anahtar kavramlarından (\`concepts\`) yararlanın.
   - Tezin ve kutunun incelediği spesifik kuramcıları, kuramsal modelleri, araştırma yöntemlerini, ampirik aktörleri, coğrafyayı ve tarihsel/olgusal dönem sınırlarını doğrudan sorguya dahil edin.
2. **Akademik Karşılık ve Kanonik Literatür Eşlemesi (Scholarly Mapping & Canonical Keywords)**:
   - Terimleri uluslararası literatürde kabul görmüş kanonik akademik İngilizce karşılıklarına dönüştürün.
   - İlgili araştırma alanının uluslararası indeksli literatürde taranmasını sağlayacak temel kavramsal anahtarları ekleyin.
3. **Kutu Türü İzolasyonu ve Odaklanma**:
   - **SUBJECT_PROBLEM**: Yalnızca tezin incelediği ampirik vakaya, aktörlere, kurumlara, spesifik tarihsel döneme ve coğrafyaya odaklanın. Soyut kuramsal terimleri ve yöntem adlarını hariç tutun.
   - **THEORETICAL_FRAMEWORK**: Kutu başlığı, açıklaması ve Genel Tez Matrisindeki spesifik kuramsal modele, kavramsal mekanizmaya ve belirtilen kuramcıların isimlerine odaklanın. Ampirik vaka aktörlerini hariç tutun.
   - **METHODOLOGY**: Tezin ve alt kutunun benimsediği araştırma desenine, veri toplama ve analiz protokollerine (söylem analizi, ekonometri, arşiv taraması, nitel/nicel vb.) odaklanın. Yalnızca ilgili yöntemin metodolojik literatürünü hedefleyin; ampirik vaka aktörlerini hariç tutun.
   - **PRIMARY_MATERIAL**: Boş string (\`""\`) döndürün.
 4. **OpenAlex Sorgu Kuralı (\`openAlexQuery\`)**:
   - OpenAlex \`search.semantic\` motoru (GTE-Large-EN 1024d embedding) zengin ve detaylı metinlerle en yüksek başarıyı gösterir (doküman: Up to 2000 chars, long-text queries shine — ancak ücretsiz planda 1500 karakter limiti var).
   - **1300-1500 karakter** uzunluğunda, alt kutunun araştırma amacını, özgül kuramsal/metodolojik mekanizmasını, ampirik odağını ve analiz kapsamını açıklayan doğal, akıcı ve yoğun bir akademik İngilizce araştırma paragrafı (abstract/grant aim benzeri) oluşturun. Mutlaka 1300 karakter altı üretmeyin, 1500 üstüne çıkmayın.
5. **Hibrit Başlık ve Anahtar Kelime Sorgu Kuralı (\`semanticScholarQuery\`)**:
   - Boolean operatörleri (AND, OR, NOT) KULLANMAYIN.
   - Yalnızca 4-8 adet odaklı, yüksek kesinlikli İngilizce anahtar kelime veya tırnaklı kelime öbeği içeren yalın bir sorgu oluşturun (Örn: \`Daniel Egan Gramsci "war of position" "war of maneuver"\` veya \`"critical discourse analysis" Gramscian hegemony political studies\`).`,

     workflowSteps: `1. Her bir alt kutunun türünü (\`boxType\`), açıklamasını, kavramlarını ve Genel Tez Matrisindeki bağlamı inceleyin.
2. Kutu türü izolasyon kurallarına ve Strict Grounding prensibine tam uyarak hem zengin \`openAlexQuery\` araştırma paragrafını hem de odaklı \`semanticScholarQuery\` anahtar kelimelerini oluşturun.
3. Çıktıyı vermeden önce her \`openAlexQuery\`’yi karakter sayısıyla doğrulayın: 1300 altı ise genişletin; 1500 üstü ise kısaltın (API limiti).`,

    outputFormat:
      'Her alt kutu için `subBoxTitle`, `openAlexQuery` ve `semanticScholarQuery` alanlarını içeren JSON nesneleri dizisi döndürün. Şema: [{"subBoxTitle": string, "openAlexQuery": string, "semanticScholarQuery": string}]',

    inputContext: `${matrixContext ? `${matrixContext}\n\n` : ""}### İşlenecek Alt Kutular:
${parts.join("\n\n")}`,

    taskTrigger:
      "Yukarıdaki <context> içindeki her alt kutuyu inceleyerek <instructions> kurallarına göre `subBoxTitle`, `openAlexQuery` ve `semanticScholarQuery` alanlarını içeren JSON çıktısını üret.",
  });
}
