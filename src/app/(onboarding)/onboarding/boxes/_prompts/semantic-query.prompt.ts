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
   - **Kadran Bazlı Cümle İskelesi (5±1 Cümle, 170-210 Kelime, ≈1000-1250 Karakter)**:
     * *SUBJECT_PROBLEM için*: Cümle 1-2'de ampirik aktörler/kurumlar + coğrafi/dönemsel bağlam + kanonik şemsiye kavram; Cümle 3-4'te kurumsal/siyasal eylem dinamikleri ve söylemsel dönüşüm süreçleri; Cümle 5'te temel tarihsel/siyasal çatışma ve nedensellik.
     * *THEORETICAL_FRAMEWORK için*: Cümle 1-2'de kuramsal model, temel kuramcılar ve ontolojik zemin; Cümle 3-4'te çekirdek kuramsal mekanizma, kavramsal ilişkiler ve nedensel hipotezler; Cümle 5'te kuramın analitik operasyonelleştirilme mantığı.
     * *METHODOLOGY için*: Cümle 1-2'de araştırma yöntemi, analiz ekolü ve kurucu metodologlar/yazarlar; Cümle 3-4'te analiz protokolü, metinsel/ampirik inceleme operasyonları ve çekirdek analitik kavramlar; Cümle 5'te yöntemin karşılaştırmalı ve bilimsel geçerlilik zemini.
   - Karakter saymaya çalışmayın; kelime bütçesi (170-210 kelime) ve terminolojik yoğunlukla hedefi tutturun (kesinlikle 1500 karakteri aşamaz).
5. **Hedeflenmiş Sözcüksel Arama Sorguları (\`openAlexLexicalQueries\` - TAM 3 ADET)**:
   - OpenAlex'in yüksek hızlı (100 req/s) metin arama motoru için kutu başına **tam 3 adet** hedeflenmiş İngilizce arama sorgusu üretin.
   - **OpenAlex Arama Motoru Sözdizimi ve Tırnak Kuralları (CRITICAL)**:
     - Çift tırnak (\`"..."\`), OpenAlex metin arama motorunda morfolojik kök bulmayı (stemming) devre dışı bırakır ve kelimelerin tam o sırada harfi harfine yan yana bulunmasını zorunlu kılar. İki tırnaklı öbek yan yana yazıldığında aralarında örtük AND işletilir.
     - **TIRNAK KULLANILACAK YERLER (Yalnızca Kanonik Varlıklar)**:
       * Kişi tam adları (kuramcı, yazar, metodolog adları; örn. çok kelimeli isimler).
       * Kanonik telif kitap veya monografi başlıkları.
       * Resmi kurum, örgüt veya siyasal aktörlerin tescilli/resmi çok kelimeli tam adları.
       * İlgili disiplinin uluslararası akademik literatüründe kalıplaşmış çok kelimeli kanonik şemsiye kavramları.
     - **TIRNAK KULLANILMAYACAK YERLER (Serbest / Kök Bulma Sözcükleri - Bare Words)**:
       * Araştırmacının serbest kavramlaştırmaları, yerel çeviri tamlamalar veya 3+ kelimelik sentetik kavram öbekleri KESİNLİKLE tırnak içine alınamaz.
       * Tematik boyutlar, süreçler, olgusal niteleyiciler, tarihsel dönemler ve coğrafya tırnaksız (serbest sözcük) olarak yazılmalıdır. Tırnaksız sözcükler OpenAlex tarafından köklerine ayrılarak (stemming) ve alaka (BM25/proximity) esnekliğiyle taranır.
        * Sentetik/çeviri tamlamaların tırnak içine alınması durumunda arama motoru sıfır (0) sonuç döndürür.
        * **Evrensel Kanoniklik Testi**: Tırnaklı her öbek, uluslararası indeksli literatürde bağımsız doğrulanabilir kanonik varlık olmalıdır (kişi tam adı / tescilli eser başlığı / resmi kurum adı / kalıplaşmış şemsiye kavram). \`concepts\` içinden gelen araştırmacı-içi analitik yönerge veya serbest kavramlaştırma bu testi geçemezse KESİNLİKLE tırnaklanamaz; gerekiyorsa tırnaksız serbest sözcük olarak yazılır veya kişi-adı çapasıyla değiştirilir.
     - **YASAK (CRITICAL)**: Asla yıldız (\`*\`) veya soru işareti (\`?\`) gibi joker karakterler (wildcards) KULLANMAYIN (OpenAlex'te HTTP 400 Bad Request hatasına yol açar).
   - **Sözcüksel Sorgu Uzunluğu ve Aşırı Kısıtlama Yasağı (Concise: 2-4 Terms)**:
     - OpenAlex arama motorunda boşluklar örtük AND mantığıyla çalışır. Bir sorguya 5-8 kelime (aktör + kısaltma + tüm kavramlar + dönem + coğrafya) yığmak, ilgili makalelerin neredeyse tamamını eleyerek sıfır veya yetersiz sonuca yol açar.
     - Her sorgu **öz ve hedeflenmiş (toplam 2 ila 4 terim)** olmalıdır (örn. 1 tırnaklı kanonik çapa + 1-2 tırnaksız bağlam/süreç sözcüğü).
   - **Kadran Bazlı Evrensel Arama Yapısı**:
     - **SUBJECT_PROBLEM**:
       * *Kısaltma ve İsimlendirme Kuralları*:
         - Asla birden fazla kısaltmayı tek bir tırnak içine yazmayın (\`"A B C"\` tamlaması KESİNLİKLE YASAKTIR).
         - Yerel dildeki niteleyicileri (örn. 'yasal', 'hukuki') motamot 'legal parties' gibi yapay İngilizce kelimelere çevirmeyin. Uluslararası sosyal bilim literatüründe ilgili hareket/aktör grubu için yerleşik olan kanonik şemsiye kavramları ve partilerin/kurumların tescilli resmi İngilizce adlarını kullanın.
         - Birden fazla kurum/parti varsa hepsini tek sorguya yığmayın; her sorguda farklı bir aktörü veya kanonik şemsiye terimi hedefleyin.
       * **Query 1 (Kanonik Şemsiye Terim Çapası)**: Literatürdeki yerleşik çok kelimeli şemsiye aktör/alan adı tırnaklı çapa olarak + coğrafi/dönemsel bağlam (toplam 2-4 kelime, örn. \`"<Canonical Umbrella Term>" <Geography>\`).
       * **Query 2 (1. Temel Kurum/Parti: Kısaltma + Resmi İngilizce Tam Adı veya Coğrafya)**: İncelenen temel aktörün kısaltması ve literatürdeki resmi İngilizce karşılığı (\`"<Acronym>" "<Official Full English Name>"\`) ya da doğrudan coğrafi bağlamı (\`"<Acronym>" <Geography>\`).
       * **Query 3 (2. Temel Kurum/Parti veya Spesifik Çapa + Coğrafya/Süreç)**: Varsa incelenen 2. aktörün kısaltması ve resmi adı (\`"<2nd Acronym>" "<Official English Name>"\`) ya da \`"<2nd Acronym>" <Geography>\` (toplam 2-3 kelime).
     - **THEORETICAL_FRAMEWORK**:
       * Query 1: \`"<1. Kuramcı Adı>" "<Kanonik Eser veya Çekirdek Kuramsal Mekanizma>"\`
       * Query 2: \`"<2. Kuramcı Adı (veya 1. Kuramcının Adı)>" "<Özgül Analitik Boyut>"\`
       * Query 3: \`"<Kanonik Kuramsal Kavram>" <serbest ilişki sözcüğü>\` — buradaki tırnaklı kavram Evrensel Kanoniklik Testini geçmelidir; geçemezse tırnak kaldırılarak tırnaksız serbest sözcük yazılır veya sorgu kuramcı-adı çapasına döndürülür. 3 sorgudan en az 2'si kuramcı-adı çapası taşır.
     - **METHODOLOGY**:
        * **Kanonik Ekol ve Kurucu Metodolog Çapalaması**: Yöntem ekolünün uluslararası literatürdeki kurucu metodoloğu/başyapıtı ile alt kutuda veya matriste belirtilen analitik yazarlar dengeli biçimde hedeflenmelidir.
        * **Query 1 (Kurucu Yöntem Ekolü / Kurucu Başyapıt)**: İncelenen kanonik yöntem/analiz ekolünün tescilli adı çift tırnaklı + kuramsal diyalog kavramı (örn. \`"<Kanonik Yöntem Ekolü>" <hegemony / power / framing>\`, toplam 2-3 kelime) VEYA doğrudan o yöntemin uluslararası alandaki kurucu metodoloğunun tam adı tırnaklı çapa olarak (örn. \`"<Kurucu Metodolog Adı>" <key method concept>\`).
        * **Query 2 (Kutuda/Matriste Belirtilen 1. Metodolog)**: Alt kutuda veya matriste belirtilen 1. analitik yazarın tam adı çift tırnaklı + uyguladığı yöntem veya temel kavram (örn. \`"<1. Yazar Adı>" <discourse / methodology>\`, toplam 2-4 kelime).
        * **Query 3 (Kutuda/Matriste Belirtilen 2. Metodolog veya Kurucu Telif Eser)**: Varsa belirtilen 2. analitik yazarın tam adı çift tırnaklı + kavram (örn. \`"<2. Yazar Adı>" <language / hegemony>\`) VEYA yöntemin kanonik kurucu eserinin tam adı tırnaklı çapa olarak (örn. \`"<Kanonik Eser Başlığı>"\`).
        * **NEGATİF KURAL (CRITICAL)**:
          - Asla ampirik vaka dönemi, tarihsel momentler veya araştırmacının vaka takvimine özgü niteleyicileri (örn. "historical moments", "1990s" vb.) METHODOLOGY sorgularına DAHİL ETMEYİN. Yalnızca yöntemin kendi bilimsel/metodolojik literatürünü hedefleyin.
          - Asla "close reading", "comparative research design", "qualitative research design", "data collection protocol" gibi her disiplinde rastlanan içi boş, jenerik araştırma deseni kalıplarını tırnaklı arama çapası olarak KULLANMAYIN. Tırnaklı çapa her zaman somut bir kurucu metodolog/yazar adı (\`"Author Name"\`), kanonik yöntem eseri (\`"Book Title"\`) veya uluslararası literatürde tescilli bir analiz ekolü (\`"critical discourse analysis"\`) olmalıdır.`,

    workflowSteps: `1. Her bir alt kutunun türünü (\`boxType\`), açıklamasını, kavramlarını ve Genel Tez Matrisindeki bağlamı inceleyin.
2. Kutu türü izolasyon kurallarına tam uyarak zengin ve terminolojik olarak yoğun \`openAlexSemanticQuery\` araştırma paragrafını (5±1 cümle, 170-210 kelime, ≈1000-1250 karakter, bürokratik dolgusuz) oluşturun.
3. Her alt kutu için ilgili kutu türünün (\`boxType\`) Kadran Bazlı Evrensel Arama Yapısına (Kural 5) göre tam 3 adet hedeflenmiş \`openAlexLexicalQueries\` sorgusu hazırlayın:
   - **SUBJECT_PROBLEM için**: Query 1'de kanonik şemsiye kavram tırnaklı + coğrafya; Query 2'de temel kurum/aktör tekil kısaltması ve resmi tam adı veya coğrafya; Query 3'te varsa ikinci aktör/kurum veya tematik süreç sözcüğü. Asla birden fazla kısaltmayı tek tırnak içinde birleştirmeyin ("A B C" yasaktır).
   - **THEORETICAL_FRAMEWORK için**: Query 1 ve 2'de kutuda veya matriste adı geçen kuramcıların tam adları tırnaklı çapa olarak; Query 3'te kanonik kuramsal kavram tırnaklı veya serbest sözcük (en az 2 sorgu kuramcı adı taşımalıdır).
   - **METHODOLOGY için**: Query 1'de yöntemin kanonik ekolü veya kurucu metodoloğu; Query 2 ve 3'te kutuda/matriste adı geçen analitik yöntem yazarları tırnaklı çapa olarak (örn. "<Author Name>" <key concept>). Asla vaka dönemi/tarihsel moment kelimeleri eklenemez ve asla "close reading", "comparative research design" gibi jenerik desen kalıpları tırnaklanamaz.
   - Genel kısıt: Hiçbir sorguda wildcard (*, ?) ve sentetik yapay çeviri tamlamaları tırnaklanamaz; her sorgu öz ve hedeflenmiş (2-4 terim) olmalıdır.
4. Çıktıyı vermeden önce her \`openAlexSemanticQuery\`’yi cümle ve kelime sayısıyla doğrulayın: 4 cümleden kısaysa kuramcı/kavram ekleyerek zenginleştirin; 210 kelimeyi aştıysa kısaltın. Karakter saymaya çalışmayın. Çıktıdan önce her tırnaklı öbeği Evrensel Kanoniklik Testinden geçirin: kanonik değilse tırnağı kaldırın veya kuramcı/yazar-adı çapasıyla değiştirin; hiçbir sorguda araştırmacı-içi yönergeyi tırnaklı bırakmayın.`,

    outputFormat:
      'Her alt kutu için `subBoxTitle`, `openAlexSemanticQuery` ve `openAlexLexicalQueries` alanlarını içeren JSON nesneleri dizisi döndürün. Şema: [{"subBoxTitle": string, "openAlexSemanticQuery": string, "openAlexLexicalQueries": string[]}]. MUTLAK DİL KURALI: `openAlexSemanticQuery` ve `openAlexLexicalQueries` alanlarının tamamı istisnasız İngilizce olacaktır; bağlam Türkçe olsa dahi tek bir Türkçe kelime, ek ya da harf (ç, ğ, ı, İ, ö, ş, ü) tüm yanıtı geçersiz kılar.',

    inputContext: `${matrixContext ? `${matrixContext}\n\n` : ""}### İşlenecek Alt Kutular:
${parts.join("\n\n")}`,

    taskTrigger:
      "Yukarıdaki <context> içindeki her alt kutuyu inceleyerek <instructions> kurallarına göre `subBoxTitle`, `openAlexSemanticQuery` ve `openAlexLexicalQueries` alanlarını içeren JSON çıktısını üret.",
  });
}
