import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

function buildQuadrantSpecificInstruction(boxType: string): string {
  switch (boxType) {
    case "SUBJECT_PROBLEM":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — VAKA / KONU KUTUSU (SUBJECT_PROBLEM)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin doğrudan incelediği ampirik vakaya, spesifik tarihsel döneme ve aktörlere odaklanır.\n\n## KABUL KRİTERİ\nTezin kapsadığı tarihsel dönemi ve vaka alanını doğrudan işleyen ampirik monografiler, saha araştırmaları ve vaka analizleri yüksek puan (80-95+) almalıdır.\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. Tezin kapsadığı olgusal/tarihsel dönemin DIŞINDAKİ başka bir döneme veya olaya odaklanan çalışmalar düşük puanlandırılmalıdır.\n2. Soyut, genel ve zamansız teorik/kuramsal eserler ve metodoloji el kitapları Vaka/Konu Kutusu için ayrı tutulmalıdır.`;

    case "THEORETICAL_FRAMEWORK":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — TEORİK ÇERÇEVE KUTUSU (THEORETICAL_FRAMEWORK)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin ampirik vakasını anlamlandırmada kullanılan soyut kuramlar, teorik kavramlar ve modellemelere odaklanır.\n\n## KABUL KRİTERİ\nİlgili kuramcıların birincil kuramsal metinleri ve bu teorileri tartışan literatür yüksek puan almalıdır.`;

    case "METHODOLOGY":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — YÖNTEM KUTUSU (METHODOLOGY)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin benimsediği araştırma deseni, veri toplama ve analiz tekniklerine yönelik metodolojik eserlere odaklanır.\n\n## KABUL KRİTERİ\n1. **Metodolojik Uyum:** Eserin sunduğu veya uyguladığı analiz yöntemi, alt kutu açıklamasında (description) tanımlanan araştırma deseni ve yöntemsel yaklaşımla doğrudan örtüşmelidir (80-100 puan).\n2. **Emsal Uygulama:** Kutu açıklamasında belirtilen yöntemin benzer araştırma alanlarına başarıyla uygulandığı emsal çalışmalar kabul edilebilir (60-79 puan).\n\n## DEĞERLENDİRME VE ELEME KRİTERLERİ\n1. **Yöntemsel Uyuşmazlık:** Alt kutu açıklamasında tanımlanan metodolojik yaklaşımdan sapan veya zıt bir analitik tasarım benimseyen çalışmaları düşük puanla (0-40 puan).\n2. Soyut genel felsefi tartışmalar veya yöntemsel kılavuz niteliği taşımayan kuramsal metinleri Yöntem Kutusu için ayrı tut.`;

    case "PRIMARY_MATERIAL":
      return `\n\n═══════════════════════════════════════════════════════════════════════════════\nKUTU TÜRE ÖZGÜ DEĞERLENDİRME REHBERİ — BİRİNCİL MATERYAL KUTUSU (PRIMARY_MATERIAL)\n═══════════════════════════════════════════════════════════════════════════════\n\nAmaç: Bu kutu tezin doğrudan analiz ettiği birincil kaynaklara, belgesel arşivlere veya kanun/karar külliyatına odaklanır.`;

    default:
      return "";
  }
}

export interface JuryBatchPromptInput {
  thesisSubject: string;
  thesisBoxId: number;
  subBoxTitle: string;
  boxType: string;
  description: string;
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
    thesisBoxId,
    subBoxTitle,
    boxType,
    description,
    articlesText,
    articleCount,
  } = params;

  const quadrantBlock = buildQuadrantSpecificInstruction(boxType);

  return buildPromptPayload({
    roleAndExpertise:
      "Sen, akademik makaleleri belirli bir tez alt kutusu bağlamında değerlendiren uzman bir akademik jüri üyesisin.",

    primaryTask:
      "Her bir makaleyi, sana verilen alt kutunun türü, başlığı ve açıklaması ile karşılaştırarak değerlendir. Makalenin kutu bağlamıyla doğrudan alakalı olup olmadığına karar ver, 0-100 arası alaka skoru belirle ve 1 cümlelik Türkçe gerekçe yaz.",

    rulesAndConstraints: `1. **Dil Uygunluğu:** Yalnızca Türkçe veya İngilizce dilindeki akademik çalışmaları kabul et. Başlığı veya içeriği bu iki dilin dışındaki (İspanyolca, Fransızca, Almanca, İtalyanca vb.) herhangi bir dilde olan kaynakları doğrudan uygunsuz olarak ele (isRelevant: false, relevanceScore: 0, gerekçede dil uyuşmazlığını belirt).
2. **Bütünsel Örtüşme:** Soyut teorik benzerliklerin ötesine geçerek makalenin incelediği spesifik olgunun, aktörlerin ve tarihsel kesitin; Sub-Box bağlamı ve tezin kapsadığı olgusal/tarihsel çerçeve ile bütünsel olarak örtüşüp örtüşmediğini değerlendir.
3. **Dönemsel Uygunluk:** Tezin ve kutunun kapsadığı tarihsel/olgusal dönemin dışındaki başka bir döneme veya olaya odaklanan çalışmalar düşük puanlandırılmalıdır.
4. **Temel Monografiler:** Tezin kapsadığı tarihsel dönemi ve vaka alanını doğrudan işleyen kapsayıcı temel monografilere ve saha araştırmalarına yüksek relevans puanı (80-95+) ver.${quadrantBlock}`,

    outputFormat: `Her değerlendirme için aşağıdaki alanları içeren JSON nesneleri dizisi döndürün:
- thesisBoxId: (girdide verilen box id)
- subBoxTitle: (girdide verilen sub box başlığı)
- articleTitle: makale başlığı (aynen)
- isRelevant: boolean
- relevanceScore: 0-100 arası tam sayı
- reasoning: Türkçe 1 cümlelik gerekçe`,

    examples: `<example>
<input>
Tez Konusu: 1991-1999 döneminde Kürt siyasal hareketinin taleplerindeki niteliksel dönüşümü
Kutu Bağlamı:
- Kutu ID: [Box 1]
- Kutu Türü: SUBJECT_PROBLEM
- Kutu Başlığı: "Yasal Kürt Partileri ve Meclis Siyaseti"
- Kutu Açıklaması: "1990'larda HEP, DEP ve HADEP çizgisinin meclis içi ve dışı siyasal söylemleri."

Makaleler:
Makale 1: "The Kurdish Political Movement in Turkey (1990-2000): From HEP to DEHAP"
Authors: Cengiz Gunes
Abstract: Examines the mobilization and discourse of pro-Kurdish political parties in 1990s Turkey.

Makale 2: "Agricultural Policies and Cotton Production in South America"
Authors: John Doe
Abstract: Analyzes soybean and cotton export economics in Brazil during the 1990s.
</input>
<output>
{
  "evaluations": [
    {
      "thesisBoxId": 1,
      "subBoxTitle": "Yasal Kürt Partileri ve Meclis Siyaseti",
      "articleTitle": "The Kurdish Political Movement in Turkey (1990-2000): From HEP to DEHAP",
      "openAlexId": null,
      "isRelevant": true,
      "relevanceScore": 92,
      "reasoning": "Tezin ve alt kutunun odaklandığı 1990'lar yasal Kürt partileri ve meclis siyaseti konusunu doğrudan ve kapsamlı bir biçimde incelemektedir."
    },
    {
      "thesisBoxId": 1,
      "subBoxTitle": "Yasal Kürt Partileri ve Meclis Siyaseti",
      "articleTitle": "Agricultural Policies and Cotton Production in South America",
      "openAlexId": null,
      "isRelevant": false,
      "relevanceScore": 0,
      "reasoning": "Makalenin konusu ve araştırma alanı tez ve alt kutu bağlamıyla tamamen ilgisizdir."
    }
  ]
}
</output>
</example>`,

    inputContext: `### Tez Konusu (Subject Problem):
${thesisSubject}

### Kutu Bağlamı:
- Kutu ID: [Box ${thesisBoxId}]
- Kutu Türü: ${boxType}
- Kutu Başlığı: "${subBoxTitle}"
- Kutu Açıklaması: ${description}

### Değerlendirilecek Makaleler (${articleCount} Adet):
${articlesText}`,

    taskTrigger:
      `Yukarıdaki <context> içinde listelenen ${articleCount} makaleyi <instructions> kurallarına göre değerlendirerek her biri için thesisBoxId (${thesisBoxId}), subBoxTitle ("${subBoxTitle}"), articleTitle, isRelevant, relevanceScore (0-100), reasoning (Türkçe) alanlarını içeren JSON çıktısını üret.`,
  });
}
