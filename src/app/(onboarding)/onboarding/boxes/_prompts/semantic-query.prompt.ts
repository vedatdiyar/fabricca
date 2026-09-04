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
      "Siz, tüm akademik disiplinlerdeki lisansüstü tez çalışmaları için OpenAlex'in GTE-Large-EN vektör motoruna özel yüksek kaliteli, hedeflenmiş ve disiplinlerarası kanonik İngilizce arama sorguları üreten kıdemli bir bilgi bilimi ve araştırma metodolojisi uzmanısınız.",

    primaryTask:
      "Size verilen Genel Tez Matrisini, ilgili Alt Kutuyu (Sub-Box) ve Alt Kutuya ait Anahtar Kavramları (`concepts`) analiz ederek; her alt kutu için OpenAlex GTE-Large-EN vektör modeli için zengin ve yoğun bir akademik araştırma paragrafı (`openAlexQuery`) ve OpenAlex 100 req/s metin arama motoru için tam 3 adet hedeflenmiş sözcüksel sorgu (`openAlexLexicalQueries`) üretin.",

    rulesAndConstraints: `1. **Bütünsel Tez Matrisi ve Alt Kutu Çapalaması (Holistic Matrix & Sub-Box Grounding)**:
   - İlgili alt kutunun ait olduğu kadranın Genel Tez Matrisindeki detaylarından, alt kutu başlığından (\`title\`), açıklamasından (\`description\`) ve anahtar kavramlarından (\`concepts\`) yararlanın.
   - Tezin ve kutunun incelediği spesifik kuramcıları, kuramsal modelleri, araştırma yöntemlerini, ampirik aktörleri, coğrafyayı ve tarihsel/olgusal dönem sınırlarını doğrudan sorgulara dahil edin.
2. **Akademik Karşılık ve Kanonik Literatür Eşlemesi (Scholarly Mapping & Canonical Keywords)**:
   - Terimleri uluslararası literatürde kabul görmüş kanonik akademik İngilizce karşılıklarına dönüştürün.
   - İlgili araştırma alanının uluslararası indeksli literatürde taranmasını sağlayacak temel kavramsal anahtarları ekleyin.
3. **Kutu Türü İzolasyonu ve Odaklanma**:
   - **SUBJECT_PROBLEM**: Yalnızca tezin incelediği ampirik vakaya, aktörlere, kurumlara, spesifik tarihsel döneme ve coğrafyaya odaklanın. Soyut kuramsal terimleri ve yöntem adlarını hariç tutun.
   - **THEORETICAL_FRAMEWORK**: Kutu başlığı, açıklaması ve Genel Tez Matrisindeki spesifik kuramsal modele, kavramsal mekanizmaya ve belirtilen kuramcıların isimlerine odaklanın. Ampirik vaka aktörlerini hariç tutun.
   - **METHODOLOGY**: Tezin ve alt kutunun benimsediği araştırma desenine, veri toplama ve analiz protokollerine odaklanın. Yalnızca ilgili yöntemin metodolojik literatürünü hedefleyin; ampirik vaka aktörlerini hariç tutun.
   - **PRIMARY_MATERIAL**: Boş string (\`""\`) ve boş dizi (\`[]\`) döndürün (birincil kaynaklar literatür taramasına tabi değildir).
4. **Yoğun ve Odaklanmış Vektör Sorgusu (\`openAlexQuery\`)**:
   - OpenAlex \`search.semantic\` motoru (GTE-Large-EN 1024d embedding), genel niyet veya proje hedefleri yerine; **akademik literatürün terminolojik ve kavramsal yoğunluğuyla** en yüksek isabeti sağlar.
   - Boş yöntemsel veya bürokratik dolgu ifadeleri ('this study explores', 'it employs qualitative design' vb.) KULLANMAYIN.
   - Alt kutunun ve matrisin benimsediği **kuramcıların/metodologların isimlerini, temel kuramsal kavramlarını ve literatürdeki analitik mekanizmaları** metne doğrudan ve yoğun biçimde işleyin.
   - **1000-1250 karakter** uzunluğunda, doğrudan ilgili akademik literatürün göbeğine odaklanan doğal, akıcı ve yoğun bir akademik İngilizce araştırma metni oluşturun (kesinlikle 1500 karakteri aşamaz; 900 karakterin altına inmeyin).
5. **Hedeflenmiş Sözcüksel Arama Sorguları (\`openAlexLexicalQueries\` - TAM 3 ADET)**:
   - OpenAlex'in yüksek hızlı (100 req/s) metin arama motoru için kutu başına **tam 3 adet** hedeflenmiş İngilizce arama sorgusu üretin.
   - **Evrensel "Anchor + Focus" Modeli**:
     - Her sorgu iki temel kutuptan oluşur: Birincil Çapa (Kanonik Kuramcı / Metodolog / Kurum / Olgusal Aktör adı) + Odak Mekanizma (Spesifik kavram, analiz protokolü veya tarihsel süreç).
     - Çok kelimeli öbekler mutlaka çift tırnak içine alınmalıdır (örneğin \`"critical realism"\`, \`"process tracing"\`).
     - İki öbeği yan yana yazdığınızda OpenAlex örtük AND (kesişim) mantığıyla arar (örneğin \`"Roy Bhaskar" "critical realism"\`). Gerekirse büyük harfle \`AND\` veya \`OR\` kullanın.
     - **KESİNLİKLE YASAK (CRITICAL)**: Asla yıldız (\`*\`) veya soru işareti (\`?\`) gibi joker karakterler (wildcards) KULLANMAYIN! OpenAlex metin arama motorunda \`*\` veya \`?\` kullanımı HTTP 400 Bad Request hatasına yol açar.
   - **Kadran Bazlı Arama Yapısı**:
     - **SUBJECT_PROBLEM**:
       * Query 1: \`"<Anahtar Aktör/Kurum>" "<Olgusal Olay / Süreç>"\`
       * Query 2: \`"<Aktör/Konu>" "<Spesifik Coğrafya / Tarihsel Dönem>"\`
       * Query 3: \`"<Alternatif Terim/Kurum>" "<Tematik Boyut>"\`
     - **THEORETICAL_FRAMEWORK**:
       * Query 1: \`"<1. Kuramcı Adı>" "<Özgül Mekanizma / Kavram Çifti>"\`
       * Query 2: \`"<2. Kuramcı Adı (veya 1. Kuramcının 2. Temel Kavramı)>" "<Özgül Analitik Boyut>"\`
       * Query 3: \`"<Kavram 1>" "<Kavram 2>"\`
     - **METHODOLOGY**:
       * Query 1: \`"<Kanonik Metodolog Adı>" "<Metodolojik Yaklaşım>"\`
       * Query 2: \`"<Veri Toplama / Örneklem Deseni>" "<Analiz Protokolü>"\`
       * Query 3: \`"<Metodoloji Adı>" "<Uygulama Alanı / Disiplin>"\``,

    workflowSteps: `1. Her bir alt kutunun türünü (\`boxType\`), açıklamasını, kavramlarını ve Genel Tez Matrisindeki bağlamı inceleyin.
2. Kutu türü izolasyon kurallarına tam uyarak zengin \`openAlexQuery\` araştırma paragrafını (1000-1450 karakter) oluşturun.
3. Kutu için Anchor + Focus modeline göre ve kesinlikle wildcard (\`*\`, \`?\`) içermeyen tam 3 adet \`openAlexLexicalQueries\` sorgusu hazırlayın.
4. Çıktıyı vermeden önce her \`openAlexQuery\`’yi karakter sayısıyla doğrulayın: 1000 altı ise zenginleştirin; 1450 üstü ise kısaltın.`,

    outputFormat:
      'Her alt kutu için `subBoxTitle`, `openAlexQuery` ve `openAlexLexicalQueries` alanlarını içeren JSON nesneleri dizisi döndürün. Şema: [{"subBoxTitle": string, "openAlexQuery": string, "openAlexLexicalQueries": string[]}]',

    inputContext: `${matrixContext ? `${matrixContext}\n\n` : ""}### İşlenecek Alt Kutular:
${parts.join("\n\n")}`,

    taskTrigger:
      "Yukarıdaki <context> içindeki her alt kutuyu inceleyerek <instructions> kurallarına göre `subBoxTitle`, `openAlexQuery` ve `openAlexLexicalQueries` alanlarını içeren JSON çıktısını üret.",
  });
}
