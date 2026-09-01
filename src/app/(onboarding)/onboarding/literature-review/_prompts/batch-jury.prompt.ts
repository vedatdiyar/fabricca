import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

function buildQuadrantSpecificInstruction(boxType: string): string {
  switch (boxType) {
    case "SUBJECT_PROBLEM":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — VAKA / KONU KUTUSU (SUBJECT_PROBLEM)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin doğrudan incelediği ampirik vakaya, spesifik tarihsel döneme ve aktörlere odaklanır.\n\n## KABUL KRİTERİ\nTezin kapsadığı tarihsel dönemi ve vaka alanını doğrudan işleyen ampirik monografiler, saha araştırmaları ve vaka analizleri yüksek puan (80-95+) almalıdır.\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. Tezin kapsadığı olgusal/tarihsel dönemin DIŞINDAKİ başka bir döneme veya olaya odaklanan çalışmalar düşük puanlandırılmalıdır.\n2. Soyut, genel ve zamansız teorik/kuramsal eserler ve metodoloji el kitapları Vaka/Konu Kutusu için ayrı tutulmalıdır.`;

    case "THEORETICAL_FRAMEWORK":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — TEORİK ÇERÇEVE KUTUSU (THEORETICAL_FRAMEWORK)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin ampirik vakasını anlamlandırmada kullanılan soyut kuramlar, teorik kavramlar ve spesifik modellemelere odaklanır.\n\n## KABUL KRİTERİ\n1. **Spesifik Model ve Mekanizma Uyumu:** Alt kutu başlığında ve açıklamasında (\`subBoxTitle\`, \`description\`) tanımlanan spesifik kuramsal modele, kavramsal mekanizmaya veya belirtilen kuramcının doğrudan bu özgül modeline odaklanan eserler yüksek puan (80-100) almalıdır.\n2. **Kavramsal Derinlik:** İlgili kuramı doğrudan tartışan, geliştiren veya operasyonelleştiren temel birincil kuramsal metinler ve monografiler kabul edilmelidir.\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. **Kavramsal Teğetsellik / Yüzeysellik:** Kutuda belirtilen spesifik kuramsal mekanizmaya odaklanmayan; yalnızca kuramcının genel felsefesini, biyografisini veya şemsiye teorisini yüzeysel/genel geçer tartışan metinleri düşük puanla (0-40 puan) veya ele (\`isRelevant: false\`).\n2. Kutunun kuramsal çerçevesiyle ilgisiz genel felsefi veya disiplinlerarası tartışmaları ele.`;

    case "METHODOLOGY":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — YÖNTEM KUTUSU (METHODOLOGY)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin benimsediği araştırma deseni, veri toplama ve analiz tekniklerine yönelik metodolojik eserlere odaklanır.\n\n## KABUL KRİTERİ\n1. **Metodolojik Uyum:** Eserin sunduğu veya uyguladığı analiz yöntemi, alt kutu açıklamasında (\`description\`) ve başlığında tanımlanan araştırma deseni ve yöntemsel yaklaşımla doğrudan örtüşmelidir (80-100 puan).\n2. **Emsal Uygulama:** Kutu açıklamasında belirtilen yöntemin benzer araştırma alanlarına başarıyla uygulandığı emsal metodolojik çalışmalar kabul edilebilir (60-79 puan).\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. **Yöntemsel Uyuşmazlık:** Alt kutu açıklamasında tanımlanan metodolojik yaklaşımdan sapan veya alakasız bir analitik tasarım benimseyen çalışmaları düşük puanla (0-40 puan).\n2. Soyut genel felsefi tartışmalar veya yöntemsel kılavuz niteliği taşımayan kuramsal metinleri Yöntem Kutusu için ayrı tut.`;

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
      "Her bir makaleyi, sana verilen Bütünsel Tez Matrisi ve özel alt kutunun türü, başlığı ve açıklaması ile karşılaştırarak değerlendir. Makalenin kutu bağlamıyla doğrudan alakalı olup olmadığına karar ver, 0-100 arası alaka skoru belirle ve 1 cümlelik Türkçe gerekçe yaz.",

    rulesAndConstraints: `1. **Dil Uygunluğu:** Yalnızca Türkçe veya İngilizce dilindeki akademik çalışmaları kabul et. Başlığı veya içeriği bu iki dilin dışındaki (İspanyolca, Fransızca, Almanca, İtalyanca vb.) herhangi bir dilde olan kaynakları doğrudan uygunsuz olarak ele (isRelevant: false, relevanceScore: 0, gerekçede dil uyuşmazlığını belirt). **CJK Özel Kuralı:** Başlık veya özet Han/Kana/Hangul (Çince/Japonca/Korece, \\u4E00-\\u9FFF, \\u3400-\\u4DBF, \\u3040-\\u30FF, \\uAC00-\\uD7AF) karakter içeriyorsa bu eseri doğrudan uygunsuz ele (isRelevant: false, relevanceScore: 0, gerekçede "Dil uygunluğu: Çince/Japonca/Korece karakter" belirt) ve articleTitle alanına asla CJK karakter kopyalama — yerine "[CJK başlık — dil filtresi]" yaz. Bu kural LANGUAGE_GUARD ile çelişmeyi önler ve verbatim-echo yasağını aşar.
2. **Yayın Türü Filtresi (Book Review / Tanıtım Yasağı):** Yalnızca orijinal araştırma makalelerini, monografileri, lisansüstü tezleri ve metodolojik eserleri kabul et. Bir kitabın 1-3 sayfalık kitap incelemesi/tanıtımı (Book Review), editör notu, konferans duyurusu gibi ikincil tanıtım yazılarını doğrudan uygunsuz olarak ele (isRelevant: false, relevanceScore: 0, gerekçede "Bağımsız araştırma makalesi olmayıp kitap incelemesidir" şeklinde belirt).
3. **Özet Derinliği ve Tohum Gücü (Seed Worthiness):** Eserin özeti (abstract) çalışmanın kuramsal/metodolojik iddiasını veya ampirik bulgularını açıkça yansıtmalıdır. Özeti olmayan veya içi boş tanıtım cümlelerinden ibaret olan çalışmaları tohum olmaya uygun görme (düşük puan ver veya ele).
4. **Çok Kanallı Akademik Eşitlik:** Ulusal tezleri (YÖK), hakemli dergi makalelerini (DergiPark) ve uluslararası yayınları (OpenAlex, Semantic Scholar) alt kutu bağlamına uygunlukları açısından tamamen eşit akademik standartta ve liyakatle değerlendir.
5. **Kutu İzolasyonu ve Sınır Koruması (Sub-Box Boundary Isolation):** Aday çalışma, Bütünsel Tez Matrisi'ndeki başka bir kadran için değerli olsa bile, yalnızca "Şu An Değerlendirilen Kutu"nun işlevine ve türüne (\`boxType\`) göre puanlanmalıdır. Örneğin ampirik vaka analizleri kuramsal veya yöntemsel kutulara kabul edilmemeli, vaka kutusuna yönlendirilerek bu kutu için düşük puanlandırılmalıdır.
6. **Metodolojik ve Epistemolojik Tutarlılık:** Aday çalışmanın benimsediği araştırma deseni, veri toplama ve analiz yaklaşımı, Bütünsel Tez Matrisi'nde ilan edilen kuramsal ve yöntemsel paradigmaya zıt veya uyumsuz ise (örneğin tezin yöntemi nitel söylem analizi iken adayın nicel ekonometri olması veya tam tersi), metodolojik uyumsuzluk nedeniyle elenmeli veya düşük puanlandırılmalıdır.
7. **Dönemsel ve Olgusal Kapsam Uygunluğu:** Tezin kapsadığı tarihsel dönemi içeren veya bu dönemi temel bir evre olarak ele alan boylamsal (longitudinal/tarihsel) monografileri ve kapsamlı çalışmaları yüksek puanlandırın (85-95+ puan). Yalnızca tezin dönemini HİÇ İÇERMEYEN ya da tamamen başka bir tarihsel kesite (örneğin tezin dönemi 1990'lar iken yalnızca 2015 sonrasına veya yalnızca 1920'lere) odaklanan çalışmaları düşük puanlandırın veya eleyin.
8. **Temel Monografiler ve Kanonik Eserler:** Tezin kapsadığı tarihsel dönemi, kuramsal modeli ve vaka alanını doğrudan işleyen kapsayıcı temel monografilere ve araştırmalara yüksek relevans puanı (80-100) ver.${quadrantBlock}`,

    outputFormat: `Her değerlendirme için aşağıdaki alanları içeren JSON nesneleri dizisi döndürün. Şema: {"evaluations": [{"thesisBoxId": number, "subBoxTitle": string, "articleTitle": string, "isRelevant": boolean, "relevanceScore": number, "reasoning": string}]}:
- thesisBoxId: (girdide verilen box id)
- subBoxTitle: (girdide verilen sub box başlığı)
- articleTitle: makale başlığı (girdide verilen başlığı eksiksiz ve aynen yaz, asla boş bırakma; ANCAK başlık CJK karakter içeriyorsa asla kopyalama — yerine "[CJK başlık — dil filtresi]" yaz, böylece LANGUAGE_GUARD ihlali oluşmaz)
- isRelevant: boolean
- relevanceScore: 0-100 arası tam sayı
- reasoning: Türkçe 1 cümlelik gerekçe`,

    inputContext: `${matrixBlock}

### ŞU AN DEĞERLENDİRİLEN ÖZEL KUTU:
- Kutu ID: [Box ${thesisBoxId}]
- Kutu Türü: ${boxType}
- Kutu Başlığı: "${subBoxTitle}"
- Kutu Açıklaması: ${description}${conceptsBlock}

### Değerlendirilecek Makaleler (${articleCount} Adet):
${articlesText}`,

    taskTrigger: `Yukarıdaki <context> içinde listelenen ${articleCount} makaleyi <instructions> kurallarına göre değerlendirerek her biri için thesisBoxId (${thesisBoxId}), subBoxTitle ("${subBoxTitle}"), articleTitle, isRelevant, relevanceScore (0-100), reasoning (Türkçe) alanlarını içeren JSON çıktısını üret.`,
  });
}
