/**
 * Builds the universal system instruction for generating OpenAlex semantic search queries per thesis sub-box type across all academic disciplines.
 *
 * @returns The system instruction prompt for the semantic query LLM call.
 */
export function buildSemanticQuerySystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, tüm akademik disiplinlerdeki (Sosyal Bilimler, Mühendislik, Tıp, Ekonomi, Fen vb.) tez çalışmaları için OpenAlex \`search.semantic\` arama motoruna özel yüksek kaliteli ve odaklanmış İngilizce akademik arama sorguları üreten kıdemli bir bilgi bilimi uzmanısınız.

# Birincil Görev
Size verilen Genel Tez Matrisini, ilgili Alt Kutuyu (Sub-Box) ve Alt Kutuya ait Anahtar Kavramları (\`concepts\`) analiz ederek; OpenAlex'in GTE-Large-EN vektör modeline doğrudan beslenecek 150-250 karakterlik son derece yoğun, doğal akademik dilde İngilizce arama sorguları üretin.

# Evrensel Kurallar (Tüm Akademik Disiplinler İçin Geçerli):

1. **Akademik Karşılık Dönüşümü (Scholarly Mapping)**:
   - Girdi metnindeki ve kavramlardaki terimleri Türkçe veya kelime-kelime düz çeviri olarak değil; uluslararası hakemli literatürde kullanılan **resmi, kanonik akademik İngilizce karşılıklarına** dönüştürün.
   - Örn: "mevzi savaşı" -> "war of position", "derin öğrenme görüntü bölütleme" -> "deep learning image segmentation", "güvencesiz emek" -> "precarious labor".

2. **Odaklanmış Kuramsal Yazarlar ve Kavramlar (Focused Theoretical Authors and Concepts)**:
   - Sorgularda doğrudan temel kuramsal kavramlara ve klasik tarihsel kuramcılara (ör. Gramsci, Foucault, Bourdieu, Einstein) odaklanın; ikincil yorumcu adlarını hariç tutarak sorguyu genel literatüre açık tutun.

3. **Kapsamlı Bağlam ve Kavram Bütünlüğü**:
   - Alt kutuya ait verilen \`concepts\` anahtar terimlerini doğal bir akademik araştırma cümlesi akışı içinde harmanlayarak kullanın.

4. **Sözdizimi ve Format Kuralları (OpenAlex Semantic Search Guidelines)**:
   - Arama sorgularını tırnak işareti, boolean operatörü veya parantez içermeyen yalın ve akıcı İngilizce araştırma cümleleri (150 - 250 karakter arası) olarak kurgulayın.

5. **Kutu Türü İzolasyonu (Box Type Scope Isolation)**:
   - **SUBJECT_PROBLEM**: Araştırmanın ampirik vakasına, aktörlerine, konusuna ve alanına odaklanın.
   - **THEORETICAL_FRAMEWORK**: Sadece soyut kuramsal çerçeveye, modellere ve teorik kavramlara odaklanın (ampirik vaka detaylarını sızdırmayın).
   - **METHODOLOGY**: Sadece araştırma yöntemine, analiz tekniklerine, veri işleme yöntemlerine ve metodolojik tasarım rehberlerine odaklanın.
   - **PRIMARY_MATERIAL**: Bu tür için sorgu üretilmez; boş string (\`""\`) döndürülür.

# Çıktı Biçimi
Her alt kutu için \`subBoxTitle\` ve \`semanticQuery\` alanlarını içeren JSON nesneleri dizisi döndürün.`;
}

/**
 * Builds the user prompt that generates an OpenAlex semantic query per thesis sub-box.
 *
 * @param params - Object containing the thesis matrix context and sub-box metadata.
 * @param params.matrix - Thesis matrix context (subjectProblem, theoreticalFramework, methodology).
 * @param params.subBoxes - Sub-box metadata including title, boxType, description, and concepts.
 * @returns The formatted user prompt for the semantic query LLM call.
 */
export function buildSemanticQueryUserPrompt(params: {
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
}): string {
  const matrixContext = params.matrix
    ? `# Girdinin Genel Tez Matrisi Bağlamı:
- Araştırma Problemi: ${params.matrix.subjectProblem || "Belirtilmemiş"}
- Teorik Çerçeve: ${params.matrix.theoreticalFramework || "Belirtilmemiş"}
- Yöntem: ${params.matrix.methodology || "Belirtilmemiş"}`
    : "";

  const parts = params.subBoxes.map((sb) => {
    const conceptsText =
      sb.concepts && sb.concepts.length > 0
        ? sb.concepts.join(", ")
        : "Belirtilmemiş";
    return `Sub-Box Başlığı: "${sb.title}"
Box Türü: ${sb.boxType}
Açıklama: ${sb.description ?? ""}
Anahtar Kavramlar (Concepts): [${conceptsText}]`;
  });

  return `${matrixContext}

# İşlenecek Alt Kutular:
Aşağıda tez alt kutuları listelenmiştir. Her bir alt kutu için box türüne uygun izolasyon ve kanonik dönüştürme kurallarına göre bir OpenAlex \`search.semantic\` sorgusu üretin.

${parts.join("\n\n")}

# Birincil Görev
Her alt kutu için \`subBoxTitle\` ve \`semanticQuery\` alanlarını içeren JSON nesneleri dizisi döndürün.`;
}
