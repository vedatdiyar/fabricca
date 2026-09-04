import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

function buildQuadrantSpecificInstruction(boxType: string): string {
  switch (boxType) {
    case "SUBJECT_PROBLEM":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — VAKA / KONU KUTUSU (SUBJECT_PROBLEM)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin doğrudan incelediği ampirik vakaya, spesifik tarihsel döneme, kurumsal alana ve aktörlere odaklanır.\n\n## KABUL KRİTERİ\nTezin kapsadığı tarihsel dönemi, vaka alanını ve kutuda belirtilen spesifik aktör/kurumları doğrudan işleyen ampirik monografiler, saha araştırmaları ve vaka analizleri TIER_1 kabul edilmelidir.\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. **Kardeş Alt Kutu ve Spesifik Aktör/Korpus İzolasyonu:** Değerlendirilen alt kutu belirli bir aktöre, kurumsal alana veya korpusa odaklanıyorsa; adayın konusu genel şemsiye kavramı içerse dahi incelediği spesifik aktör veya korpus kardeş bir alt kutunun kapsamına giriyorsa, bu aday şu an değerlendirilen kutu için ELENMELİDİR (tier: "REJECT", isRelevant: false, relevanceScore: 0, gerekçede kardeş kutunun alanına odaklandığını belirt).\n2. **Dönem Uyuşmazlığı:** Tezin kapsadığı olgusal/tarihsel dönemin DIŞINDAKİ başka bir döneme veya olaya odaklanan çalışmaları ele (tier: "REJECT").\n3. **Araştırma Öznesi ve İçsel Eylemlilik Koruması:** Alt kutuda ve kavramlarda tanımlanan birincil araştırma öznesinin/aktörünün doğrudan kendi eylemlerine, belgelerine, söylemlerine ve içsel kurumsal pratiklerine odaklanan çalışmaları önceliklendir (TIER_1). Araştırılan aktöre yönelik dışsal denetim mekanizmalarının prosedürlerine odaklanan çalışmaları tali değerlendir (TIER_2).\n4. Soyut, genel ve zamansız teorik/kuramsal eserler ve metodoloji el kitapları Vaka/Konu Kutusu için elenmelidir (tier: "REJECT").`;

    case "THEORETICAL_FRAMEWORK":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — TEORİK ÇERÇEVE KUTUSU (THEORETICAL_FRAMEWORK)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin ampirik vakasını anlamlandırmada kullanılan soyut kuramlar, teorik kavramlar ve spesifik modellemelere odaklanır.\n\n## KABUL KRİTERİ\n1. **Kuramsal Mekanizma ve Model Uyumu:** Alt kutunun tanımladığı temel kuramsal modele, kavramsal mekanizmaya ve tezin ait olduğu sosyal bilimsel araştırma alanına odaklanan kurucu ve temel kuramsal metinleri, monografileri ve kuramsal tartışmaları TIER_1 olarak kabul et. Belirli bir kuramcının adına kilitlenip alandaki diğer yetkin kuramcıları ve kanonik eserleri dışlama; değerlendirmede yazarın ismine değil, eserin ve özetin kuramsal derinliğine odaklan.\n2. **Kavramsal Derinlik:** İlgili kuramı doğrudan tartışan, geliştiren veya operasyonelleştiren temel birincil kuramsal metinler ve monografiler TIER_1 kabul edilmelidir.\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. **Ampirik Vaka Analizi Yasağı (Empirical Case Study Prohibition):** Başka coğrafyaların, ülkelerin veya yerel hareketlerin ampirik vaka analizlerini, başlığında veya özetinde kutuda adı geçen kuramcının ismi geçse dahi Teorik Çerçeve kutusuna KESİNLİKLE KABUL ETME; doğrudan ele (tier: "REJECT", isRelevant: false, relevanceScore: 0, gerekçede başka bir coğrafyanın ampirik vaka analizi olduğunu belirt). Teorik kutu yalnızca soyut kuramsal modelleri, kavramsal inşa metinlerini ve felsefi/kuramsal tartışmaları içermelidir.\n2. **Disipliner ve Tematik Öz Kalkanı (Substantive Disciplinary Shield):** Yazarı veya kuramcısı kim olursa olsun; eserin başlığı ve özeti tezin disiplin alanı dışındaki başka alanlara (örneğin işletme yönetimi, şirket stratejileri, çevre/iklim diplomasisi, kurumsal yönetişim, tıp, mühendislik vb.) odaklanıyorsa, metinde kuramsal kavramlar geçse dahi bu eseri KESİNLİKLE KABUL ETME; DERHAL ELE (tier: "REJECT", isRelevant: false, relevanceScore: 0).\n3. **Kavramsal Teğetsellik / Yüzeysellik:** Kutuda belirtilen spesifik kuramsal mekanizmaya odaklanmayan; yalnızca kuramcının genel felsefesini yüzeysel tartışan metinleri TIER_2 veya REJECT olarak değerlendir.`;

    case "METHODOLOGY":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — YÖNTEM KUTUSU (METHODOLOGY)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin benimsediği araştırma deseni, veri toplama ve analiz tekniklerine yönelik metodolojik eserlere odaklanır.\n\n## KABUL KRİTERİ\n1. **Metodolojik ve Analitik Kılavuz Niteliği:** Eser, alt kutu açıklamasında (\`description\`) ve başlığında tanımlanan araştırma desenini, veri toplama ve analiz protokollerini doğrudan kuramsallaştıran, metodolojisini öğreten temel yöntem eserleri olmalıdır (TIER_1).\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. **Emsal Vaka veya Disiplin Dışı Uygulama Yasağı:** Yöntemin tezin araştırma alanıyla ilgisiz başka disiplinlerdeki (örneğin edebi roman incelemeleri, klinik deneyler, mühendislik simülasyonları vb.) ampirik vaka uygulamalarını 'emsal yöntem çalışması' gerekçesiyle Yöntem kutusuna KABUL ETME; bu çalışmaları doğrudan ele (tier: "REJECT", isRelevant: false, relevanceScore: 0).\n2. **Metodolojik Derinlik ve Yüzeysel Ders Kitabı Yasağı:** Kavramsal ve analitik derinliği olmayan yüzeysel ders kitabı özetlerini ele (tier: "REJECT"). Alana kurucu metodolojik araç sunan derinlikli monografileri ve yöntem makalelerini önceliklendir.\n3. **Yöntemsel Uyuşmazlık:** Alt kutu açıklamasında tanımlanan metodolojik yaklaşımdan sapan veya alakasız bir analitik tasarım benimseyen çalışmaları ele (tier: "REJECT").`;

    case "PRIMARY_MATERIAL":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — BİRİNCİL MATERYAL KUTUSU (PRIMARY_MATERIAL)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin doğrudan analiz ettiği birincil kaynaklara, belgesel arşivlere veya kanun/karar külliyatına odaklanır.`;

    default:
      return "";
  }
}

export interface ThesisMatrixContext {
  subjectProblem?: string;
  theoreticalFramework?: string;
  methodology?: string;
  primaryMaterial?: string;
}

export interface JuryBatchPromptInput {
  thesisSubject?: string;
  thesisMatrix?: ThesisMatrixContext;
  thesisBoxId: number;
  subBoxTitle: string;
  boxType: string;
  description: string;
  concepts?: string[];
  articlesText: string;
  articleCount: number;
}

/**
 * Builds the standardized PromptPayload for literature review batch jury evaluation.
 * Strictly adheres to docs/LLM_INTEGRATION.md (Sections 3, 4, 6, 7 & 8).
 *
 * @param params - Jury prompt inputs.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildJuryPromptPayload(
  params: JuryBatchPromptInput,
): PromptPayload {
  const {
    thesisSubject,
    thesisMatrix,
    thesisBoxId,
    subBoxTitle,
    boxType,
    description,
    concepts,
    articlesText,
    articleCount,
  } = params;

  const quadrantBlock = buildQuadrantSpecificInstruction(boxType);

  const matrixBlock = thesisMatrix
    ? `### BÜTÜNSEL TEZ MATRİSİ (Araştırmanın Genel Çerçevesi):
- Araştırma Problemi: ${thesisMatrix.subjectProblem || thesisSubject || "Belirtilmemiş"}
- Teorik Çerçeve: ${thesisMatrix.theoreticalFramework || "Belirtilmemiş"}
- Yöntem ve Araştırma Deseni: ${thesisMatrix.methodology || "Belirtilmemiş"}
- Birincil Analiz Korpusu: ${thesisMatrix.primaryMaterial || "Belirtilmemiş"}`
    : `### Tez Konusu (Subject Problem):
${thesisSubject || "Belirtilmemiş"}`;

  const conceptsBlock =
    concepts && concepts.length > 0
      ? `\n- Kutu Anahtar Kavramları: [${concepts.join(", ")}]`
      : "";

  return buildPromptPayload({
    roleAndExpertise:
      "Sen, akademik makaleleri belirli bir tez alt kutusu bağlamında değerlendiren uzman bir akademik jüri üyesisin.",

    primaryTask:
      "Her bir makaleyi, önce Bütünsel Tez Matrisi (Tez Eleği) ve ardından değerlendirilen özel alt kutunun türü, başlığı ve açıklaması (Alt Kutu Eleği) ile hiyerarşik olarak karşılaştır. Önce 1 cümlelik Türkçe gerekçeni (reasoning) yaz, ardından gerekçene dayanarak kategorik sınıflandırma kararını (tier: 'TIER_1' | 'TIER_2' | 'REJECT') belirle.",

    rulesAndConstraints: `1. **Dil Uygunluğu:** Yalnızca Türkçe veya İngilizce dilindeki akademik çalışmaları kabul et. Başlığı veya içeriği bu iki dilin dışındaki (İtalyanca, Fransızca, Almanca, İspanyolca vb.) herhangi bir dilde olan kaynakları, özeti İngilizce olsa dahi doğrudan uygunsuz olarak ele (tier: "REJECT", isRelevant: false, relevanceScore: 0, gerekçede dil uyuşmazlığını belirt). **CJK Özel Kuralı:** Başlık veya özet Han/Kana/Hangul (Çince/Japonca/Korece) karakter içeriyorsa bu eseri doğrudan uygunsuz ele (tier: "REJECT", isRelevant: false, relevanceScore: 0) ve articleTitle alanına asla CJK karakter kopyalama — yerine "[CJK başlık — dil filtresi]" yaz.
2. **Yayın Türü ve Kitap İncelemesi Filtresi:** Yalnızca orijinal araştırma makalelerini, monografileri, lisansüstü tezleri ve metodolojik eserleri kabul et. Bir kitabın 1-3 sayfalık kitap incelemesi/tanıtımı (Book Review), editör notu, konferans duyurusu gibi ikincil tanıtım yazılarını derhal ele (tier: "REJECT", isRelevant: false, relevanceScore: 0).
3. **Temel Monografiler ve Atıf Gücü (Seed Worthiness):** Saygın akademik yayınevlerinden çıkmış veya yüksek akademik atıf almış monografilerin / kitapların özeti veritabanında bulunmasa dahi, başlığı ve yazarı kutu bağlamıyla doğrudan örtüşüyorsa bunları tohum eser olarak TIER_1 kabul et; sırf özeti boş diye temel monografileri eleme.
4. **Çok Kanallı Akademik Eşitlik:** Ulusal tezleri (YÖK) ve uluslararası yayınları (OpenAlex) alt kutu bağlamına uygunlukları açısından tamamen eşit akademik standartta değerlendir.
5. **Kutu İzolasyonu ve Sınır Koruması (Sub-Box Boundary Isolation):** Aday çalışma, Bütünsel Tez Matrisi'ndeki başka bir kadran için değerli olsa bile, yalnızca "Şu An Değerlendirilen Kutu"nun işlevine ve türüne (\`boxType\`) göre değerlendirilmelidir. Örneğin ampirik vaka analizleri kuramsal veya yöntemsel kutulara kabul edilmemelidir. Aynı üst kadran altında kardeş bir alt kutunun aktörüne/korpusuna odaklanan çalışmaları ele (tier: "REJECT", isRelevant: false, relevanceScore: 0).
6. **Metodolojik ve Epistemolojik Tutarlılık:** Aday çalışmanın benimsediği araştırma deseni, veri toplama ve analiz yaklaşımı, Bütünsel Tez Matrisi'nde ilan edilen kuramsal ve yöntemsel paradigmaya zıt veya uyumsuz ise, metodolojik uyumsuzluk nedeniyle elenmelidir (tier: "REJECT").
7. **Dönemsel ve Olgusal Kapsam Uygunluğu (Negatif Eleme İlkesi):** Dönem uyumu tek başına pozitif gerekçe değildir. Tezin dönemini HİÇ İÇERMEYEN ya da tamamen başka bir tarihsel kesite/döneme odaklanan çalışmaları doğrudan eleyin (tier: "REJECT", isRelevant: false, relevanceScore: 0).
8. **Temel Monografiler ve Kanonik Eserler:** Tezin kapsadığı tarihsel dönemi, kuramsal modeli ve vaka alanını doğrudan işleyen kapsayıcı temel monografilere ve araştırmalara TIER_1 verin.
9. **Disipliner ve Nesne Koruması (Substantive Disciplinary Shield):** Kuramsal veya yöntemsel kutularda, tezin disiplini ve araştırma konusuyla hiçbir bağı olmayan alanlardaki çalışmaları (yazarı kutuda adı geçen kuramcı dahi olsa) KESİNLİKLE KABUL ETME; doğrudan ele (tier: "REJECT", isRelevant: false, relevanceScore: 0, gerekçede disiplin dışı olduğunu belirt).
10. **3 Kademeli Jüri Sınıflandırması (Kategorik Standartlar):**
   - **TIER_1 (Kanonik / Doğrudan Çekirdek Literatür):** Tezin araştırma sorusunu ve alt kutunun tanımladığı özgül kuramsal/ampirik/yöntemsel mekanizmayı doğrudan merkezine alan kurucu eserler ve temel monografiler.
   - **TIER_2 (Güçlü Destekleyici Araştırma):** Kapsamı, dönemi veya yöntemi alt kutuyla doğrudan örtüşen, tali veya bağlamsal katkı sunan bağımsız akademik araştırmalar.
   - **REJECT (Uyumsuz / Elenmesi Gereken):** Dönem uyuşmazlığı, dil uyuşmazlığı, yayın türü engeli, yöntem çelişkisi, emsal vaka yasağı ihlali, kardeş kutu alanına sızma veya disiplin dışı çalışmalar.${quadrantBlock}`,

    workflowSteps: `1. **Aşama 1 (Bütünsel Tez ve Epistemoloji Eleği):** Her adayı önce Bütünsel Tez Matrisi'ndeki ana araştırma alanı, epistemolojik paradigma ve tarihsel dönem ile karşılaştır. Tezin genel çerçevesine ve bilimsel disiplinine bütünüyle uyumsuz çalışmaları kutuya bakılmaksızın doğrudan ele (tier: "REJECT", isRelevant: false, relevanceScore: 0).
2. **Aşama 2 (Alt Kutu Rolü ve Sınır Eleği):** İlk aşamayı geçen adayları, değerlendirilen alt kutunun türü (boxType), başlığı, açıklaması ve kavramlarıyla karşılaştır. Kutu türü rehberine ve kardeş kutu izolasyonuna göre değerlendir.
3. **Aşama 3 (Gerekçelendirme ve Sınıflandırma - Reason-before-Decision):** Önce adayın teze ve alt kutuya uyumunu özetleyen Türkçe 1 cümlelik gerekçeni (reasoning) oluştur. Ardından bu gerekçeye dayanarak sınıflandırma kararını (tier: "TIER_1" | "TIER_2" | "REJECT"), isRelevant (tier !== "REJECT") ve relevanceScore (TIER_1 için 95, TIER_2 için 80, REJECT için 0) değerlerini kesinleştir.`,

    outputFormat: `Her değerlendirme için aşağıdaki alanları içeren JSON nesneleri dizisi döndürün. Şema: {"evaluations": [{"thesisBoxId": number, "subBoxTitle": string, "articleTitle": string, "reasoning": string, "tier": "TIER_1" | "TIER_2" | "REJECT", "isRelevant": boolean, "relevanceScore": number}]}:
- thesisBoxId: (girdide verilen box id)
- subBoxTitle: (girdide verilen sub box başlığı)
- articleTitle: makale başlığı (girdide verilen başlığı eksiksiz ve aynen yaz, asla boş bırakma; ANCAK başlık CJK karakter içeriyorsa asla kopyalama — yerine "[CJK başlık — dil filtresi]" yaz)
- reasoning: Türkçe en fazla 1 kısa cümle (maksimum 10-15 kelimelik net gerekçe; sınıflandırmadan önce oluşturulmalıdır)
- tier: "TIER_1" | "TIER_2" | "REJECT"
- isRelevant: boolean (tier !== "REJECT")
- relevanceScore: TIER_1 için 95, TIER_2 için 80, REJECT için 0`,

    inputContext: `${matrixBlock}

### ŞU AN DEĞERLENDİRİLEN ÖZEL KUTU:
- Kutu ID: [Box ${thesisBoxId}]
- Kutu Türü: ${boxType}
- Kutu Başlığı: "${subBoxTitle}"
- Kutu Açıklaması: ${description}${conceptsBlock}

### Değerlendirilecek Makaleler (${articleCount} Adet):
${articlesText}`,

    taskTrigger: `Yukarıdaki <context> içinde listelenen ${articleCount} makaleyi <instructions> kurallarına göre değerlendirerek her biri için thesisBoxId (${thesisBoxId}), subBoxTitle ("${subBoxTitle}"), articleTitle, reasoning (Türkçe), tier ("TIER_1" | "TIER_2" | "REJECT"), isRelevant, relevanceScore alanlarını içeren JSON çıktısını üret.`,
  });
}
