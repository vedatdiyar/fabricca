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
      "Size verilen Genel Tez Matrisini, ilgili Alt Kutuyu (Sub-Box) ve Alt Kutuya ait Anahtar Kavramları (`concepts`) analiz ederek; her alt kutu için OpenAlex GTE-Large-EN vektör modeli için zengin ve yoğun bir akademik araştırma paragrafı (`openAlexSemanticQuery`) ve OpenAlex 100 req/s metin arama motoru için tam 3 adet hedeflenmiş sözcüksel sorgu (`openAlexLexicalQueries`) üretin.",

    rulesAndConstraints: `1. **Bütünsel Tez Matrisi ve Alt Kutu Çapalaması (Holistic Matrix & Sub-Box Grounding)**:
   - İlgili alt kutunun ait olduğu kadranın Genel Tez Matrisindeki detaylarından, alt kutu başlığından (\`title\`), açıklamasından (\`description\`) ve anahtar kavramlarından (\`concepts\`) yararlanın.
   - Tezin ve kutunun incelediği spesifik kuramcıları, kuramsal modelleri, araştırma yöntemlerini, ampirik aktörleri, coğrafyayı ve tarihsel/olgusal dönem sınırlarını doğrudan sorgulara dahil edin.
2. **Akademik Karşılık ve Kanonik Literatür Eşlemesi (Scholarly Mapping & Canonical Keywords)**:
   - Terimleri uluslararası literatürde kabul görmüş kanonik akademik İngilizce karşılıklarına dönüştürün.
   - **Birebir Çeviri Yasağı (Scholarly Nomenclature vs Literal Translation)**: Tez matrisindeki yerel ifadeleri motamot kelimesi kelimesine çevirmeyin (örneğin yerel dildeki 'yasal siyaset' veya 'yasal partiler' gibi adlandırmaları motamot 'legal parties' olarak çevirmeyin; uluslararası akademik literatürde bu tür siyasal oluşumlar için yerleşik olan kanonik şemsiye kavramları —örn. \`"pro-[actor/movement] parties"\` veya \`"[movement] political parties"\`— ve partilerin/kurumların tescilli resmi İngilizce adlarını kullanın).
   - İlgili araştırma alanının uluslararası indeksli literatürde taranmasını sağlayacak temel kavramsal anahtarları ekleyin.
3. **Kutu Türü İzolasyonu ve Odaklanma (Cross-Quadrant Leakage & Dilution Shield)**:
   - **SUBJECT_PROBLEM**: Yalnızca tezin incelediği ampirik vakaya, aktörlere, kurumlara, spesifik tarihsel döneme ve coğrafyaya odaklanın. Soyut kuramsal modelleri ve yöntem ekollerini hariç tutun.
   - **THEORETICAL_FRAMEWORK**: Kutu başlığı, açıklaması ve Genel Tez Matrisindeki spesifik kuramsal modele, kavramsal mekanizmaya ve belirtilen kuramcıların isimlerine odaklanın. Ampirik vaka aktörlerini, yerel parti/örgüt isimlerini ve spesifik vaka tarihlerini KESİNLİKLE hariç tutun.
   - **METHODOLOGY**: Tezin ve alt kutunun benimsediği araştırma desenine, veri toplama ve analiz protokollerine, kurucu metodologlara ve analitik kavramlara odaklanın. Ampirik vaka aktörlerini, spesifik vaka tarihlerini ve harici kuramcıları KESİNLİKLE hariç tutun. Yalnızca yöntemin kendi bilimsel/metodolojik literatürünü hedefleyin.
   - **PRIMARY_MATERIAL**: Boş string (\`""\`) ve boş dizi (\`[]\`) döndürün (birincil kaynaklar literatür taramasına tabi değildir).
4. **Yoğun ve Odaklanmış Vektör Sorgusu (\`openAlexSemanticQuery\` — ENGLISH ONLY, asla Türkçe olamaz)**:
   - OpenAlex \`search.semantic\` motoru (GTE-Large-EN 1024d embedding), genel niyet veya proje hedefleri yerine; **akademik literatürün terminolojik ve kavramsal yoğunluğuyla** en yüksek isabeti sağlar.
   - **Bürokratik Dolgu Yasağı (CRITICAL)**: Asla 'This chapter outlines...', 'This study explores...', 'Employing a qualitative design...' gibi metin içi bürokratik dolgularla başlamayın. Paragrafa doğrudan temel kuramsal/metodolojik/ampirik kavramsal özneyle başlayın.
   - **Anlamsal Merkez Kaymasını Önleme (Centroid Drift Shield)**: Embedding uzayında anlamın teğetsel genel disiplinlere kaymaması için; metni birbirine gevşek bağlı onlarca soyut terimle doldurmaktan kaçının. Paragraf, doğrudan alt kutunun tanımladığı özgül kuramsal tartışmaya, çekirdek kavramsal mekanizmaya veya ampirik vaka dinamiğine odaklanmalı; tek bir epistemik doğrultuyu korumalıdır.
   - **Kadran Bazlı Cümle İskelesi (5±1 Cümle, 140-180 Kelime, ≈900-1200 Karakter)**:
     * *SUBJECT_PROBLEM için*: Cümle 1-2'de ampirik aktörler/kurumlar + coğrafi/dönemsel bağlam + kanonik şemsiye kavram; Cümle 3-4'te kurumsal/siyasal eylem dinamikleri ve söylemsel dönüşüm süreçleri; Cümle 5'te temel tarihsel/siyasal çatışma ve nedensellik.
     * *THEORETICAL_FRAMEWORK için*: Cümle 1-2'de kuramsal model, temel kuramcılar ve ontolojik zemin; Cümle 3-4'te çekirdek kuramsal mekanizma, kavramsal ilişkiler ve nedensel hipotezler; Cümle 5'te kuramın analitik operasyonelleştirilme mantığı.
     * *METHODOLOGY için*: Cümle 1-2'de araştırma yöntemi, analiz ekolü ve kurucu metodologlar/yazarlar; Cümle 3-4'te analiz protokolü, metinsel/ampirik inceleme operasyonları ve çekirdek analitik kavramlar; Cümle 5'te yöntemin karşılaştırmalı ve bilimsel geçerlilik zemini.
5. **Hedeflenmiş Sözcüksel ve Boolean Arama Sorguları (\`openAlexLexicalQueries\` - TAM 3 ADET)**:
   - OpenAlex'in yüksek hızlı (100 req/s) metin arama motoru için kutu başına **tam 3 adet** hedeflenmiş İngilizce arama sorgusu üretin.
   - **OpenAlex Boolean Operatörleri ve Sözdizim Standartları (CRITICAL)**:
     - OpenAlex metin arama motoru parantezli gruplamaları ve büyük harfli **\`AND\`, \`OR\`, \`NOT\`** Boolean operatörlerini tam olarak destekler. Eşanlamlı aktörler, kısaltmalar veya ilişkili kavramlar parantez içinde \`OR\` ile birleştirilmeli; zorunlu bağlamlar (coğrafya, disiplin veya süreç) \`AND\` ile bağlanmalıdır.
     - Çift tırnak (\`"..."\`), OpenAlex'te morfolojik kök bulmayı (stemming) devre dışı bırakır ve kelimelerin tam o sırada harfi harfine yan yana bulunmasını zorunlu kılar.
     - **TIRNAK KULLANILACAK YERLER (Yalnızca Kanonik Varlıklar)**:
       * Kişi tam adları — HER ZAMAN Ad + Soyad iki kelime (kuramcı, yazar, metodolog adları); tek soyadını tırnaklamak KESİNLİKLE YASAKTIR.
       * Kanonik telif kitap veya monografi başlıkları.
       * Resmi kurum, örgüt veya siyasal aktörlerin tescilli/resmi çok kelimeli tam adları.
       * İlgili disiplinin uluslararası akademik literatüründe kalıplaşmış çok kelimeli kanonik şemsiye kavramları.
     - **TIRNAK KULLANILMAYACAK YERLER (Serbest / Kök Bulma Sözcükleri - Bare Words)**:
       * Araştırmacının serbest kavramlaştırmaları, yerel çeviri tamlamalar veya 3+ kelimelik sentetik kavram öbekleri KESİNLİKLE tırnak içine alınamaz.
       * Tematik boyutlar, süreçler, olgusal niteleyiciler, tarihsel dönemler ve coğrafya tırnaksız (serbest sözcük) olarak yazılmalıdır.
     - **YASAK (CRITICAL)**: Asla yıldız (\`*\`) veya soru işareti (\`?\`) gibi joker karakterler (wildcards) KULLANMAYIN (OpenAlex'te HTTP 400 hatasına yol açar).
     - **TEKİL YAZAR KURALI**: Her bir sorguda en fazla BİR (1) adet kişi/yazar tam adı çift tırnak içinde yer alabilir. İki yazar tam adının aynı sorgu içinde tırnaklanması (\`"Author A" "Author B"\`) KESİNLİKLE YASAKTIR.
   - **Kadran Bazlı Evrensel Arama Yapısı**:
     - **SUBJECT_PROBLEM (Boolean Kurum ve Vaka Çapalaması)**:
       * *Kurum ve Parti Adlandırma Kuralı*: Siyasi parti, örgüt, hareket veya kurum adlarında; kısaltma (varsa), tescilli resmi İngilizce adı ve yerel/orijinal adı parantez içinde Boolean \`OR\` ile birleştirilmeli; araştırmanın coğrafi bağlamı (varsa) ve temel vaka süreci Boolean \`AND\` ile bağlanmalıdır.
       * **Query 1 (Kurum/Aktör Boolean Çapası + Coğrafya)**: \`(<Acronym> OR "<Official English Name>" OR "<Original Local Name>") AND <Geography>\`.
       * **Query 2 (Hareket/Örgüt + Temel Eylem/Çatışma Süreci + Coğrafya)**: \`(<Actor OR Movement>) AND (<Process1> OR <Process2>) AND <Geography>\`.
       * **Query 3 (Spesifik Alan / Söylemsel Çapa + Coğrafya)**: İncelenen 2. temel aktör veya kutunun odaklandığı özgül kurumsal alan (parlamento, seçim, insan hakları, meşruiyet) + coğrafi bağlam.
     - **THEORETICAL_FRAMEWORK (Kurucu Ekol, Çerçeveleyen Düşünür ve Boolean Diyalektik)**:
       * **Query 1 (Kurucu Ekol / Kanonik Düşünür Çapası)**: \`"<Foundational Thinker Full Name>" AND ("<Core Concept 1>" OR "<Core Concept 2>")\` VEYA \`"<Canonical Title>"\`.
       * **Query 2 (Çerçeveleyen / Çağdaş Yorumcu Düşünür Çapası)**: \`"<Framing Author Full Name>" AND "<Core Concept>"\`.
       * **Query 3 (Diyalektik / Kavramsal Boolean Çapa)**: \`("<Concept A>" OR "<Concept B>") AND ("<Foundational Thinker>" OR "<Theory School>")\`.
     - **METHODOLOGY (Kanonik Ekol, Analitik Metodolog ve Protokol Çapalaması)**:
       * **Query 1 (Kanonik Yöntem Ekolü / Kurucu Başyapıt)**: \`"<Canonical Method School>"\` VEYA yöntemin kurucu metodoloğunun tam adı tırnaklı çapa olarak.
       * **Query 2 (Analitik Metodolog / Uygulayıcı Çapası)**: \`"<Methodologist Full Name>" <analytical dimension>\`.
       * **Query 3 (Analitik Protokol / Metodolojik Araç Çapası)**: \`"<Method School>" <protocol / coding / text analysis concept>\`.
     - **NEGATİF KURAL (CRITICAL)**: Asla ampirik vaka dönemlerini (örn. "1990s") METHODOLOGY sorgularına DAHİL ETMEYİN. Yalnızca yöntemin kendi bilimsel/metodolojik literatürünü hedefleyin.`,

    workflowSteps: `1. Her bir alt kutunun türünü (\`boxType\`), açıklamasını, kavramlarını ve Genel Tez Matrisindeki bağlamı inceleyin.
2. Kutu türü izolasyon kurallarına tam uyarak odaklanmış, terminolojik yoğunluğu yüksek, anlamsal merkez kaymasından arındırılmış \`openAlexSemanticQuery\` araştırma paragrafını (5±1 cümle, 140-180 kelime, ≈900-1200 karakter, bürokratik dolgusuz) oluşturun.
3. Her alt kutu için ilgili kutu türünün (\`boxType\`) Kadran Bazlı Evrensel Arama Yapısına (Kural 5) göre tam 3 adet hedeflenmiş \`openAlexLexicalQueries\` sorgusu hazırlayın; siyasi aktörlerde ve kavramsal ikiliklerde parantezli Boolean \`AND\` / \`OR\` operatörlerini eksiksiz işletin.
4. Çıktıyı vermeden önce her sorguyu doğrulayın: Kişi adlarının Ad + Soyad tam ad olduğunu, çıplak çeviri tamlama tuzaklarının bulunmadığını, kuram ve yöntem kutularında hem kanonik kurucuya hem analitik yazara yer verildiğini teyit edin.`,

    outputFormat:
      'Her alt kutu için `subBoxTitle`, `openAlexSemanticQuery` ve `openAlexLexicalQueries` alanlarını içeren JSON nesneleri dizisi döndürün. Şema: [{"subBoxTitle": string, "openAlexSemanticQuery": string, "openAlexLexicalQueries": string[]}]. MUTLAK DİL KURALI: `openAlexSemanticQuery` ve `openAlexLexicalQueries` alanlarının tamamı istisnasız İngilizce olacaktır; bağlam Türkçe olsa dahi tek bir Türkçe kelime, ek ya da harf (ç, ğ, ı, İ, ö, ş, ü) tüm yanıtı geçersiz kılar.',

    inputContext: `${matrixContext ? `${matrixContext}\n\n` : ""}### İşlenecek Alt Kutular:
${parts.join("\n\n")}`,

    taskTrigger:
      "Yukarıdaki <context> içindeki her alt kutuyu inceleyerek <instructions> kurallarına göre `subBoxTitle`, `openAlexSemanticQuery` ve `openAlexLexicalQueries` alanlarını içeren JSON çıktısını üret.",
  });
}
