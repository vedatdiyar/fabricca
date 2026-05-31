"use server";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";

import { checkTezaraOriginalityAction } from "./_services/originality-service";

export interface ChatMessage {
  role: "user" | "model" | "originality_report";
  content: string;
  reportData?: {
    risk: "Düşük" | "Orta" | "Yüksek";
    reasoning: string;
    gapAnalysis: string;
    theses: {
      id: string;
      title: string;
      author: string;
      advisor: string;
      year: string;
      university: string;
      abstract?: string;
      abstract_en?: string;
    }[];
  };
}

export interface OnboardingResponse {
  success: boolean;
  message?: string;
  structuredData?: {
    title: string;
    researchQuestion: string;
    argument: string;
    methodology: string;
    isAcademicApproval?: boolean;
    boxes?: {
      name: string;
      description: string;
    }[];
    coreBooks?: {
      title: string;
      author: string;
      publisher: string;
      year: string;
      rationale: string;
    }[];
  } | null;
  needsReview?: boolean;
  isAcademicApproval?: boolean;
  error?: string;
  originalityReport?: {
    risk: "Düşük" | "Orta" | "Yüksek";
    reasoning: string;
    gapAnalysis: string;
    theses: {
      id: string;
      title: string;
      author: string;
      advisor: string;
      year: string;
      university: string;
      abstract?: string;
      abstract_en?: string;
    }[];
  } | null;
}

/**
 * Server Action to call Gemini 3.1 Flash Lite and get the next question or the final synthesis.
 */
export async function getProfessorOnboardingResponseAction(
  chatHistory: ChatMessage[],
  userResponse: string,
  originalityReport?: { risk: string; gapAnalysis: string },
): Promise<OnboardingResponse> {
  const correlationId = `ob-${Date.now()}`;
  const pipelineStart = performance.now();
  try {
    const userTurnCount = chatHistory.filter((m) => m.role === "user").length;
    console.log(
      `[Onboarding Pipeline Started] [ID: ${correlationId}] User Msg Length: ${userResponse.trim().length} chars | User Turns: ${userTurnCount}`,
    );

    if (!userResponse || !userResponse.trim()) {
      return { success: false, error: "Cevap boş olamaz." };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // --- FAZ 4: İKİ AŞAMALI MODEL ENTEGRASYONU ---
    // Aşama 1 (Denetçi Katmanı - Gemma 4):
    // Kullanıcının gönderdiği son mesajı al ve ana modele beslemeden önce gemma-4-26b-a4b-it modeline gönder.
    const auditorPrompt = `MANDATORY INSTRUCTION: You MUST use the Google Search tool to execute a web search. Do NOT rely on your pre-trained knowledge under any circumstances. Even if you think you are 100% familiar with the topic, you are REQUIRED to trigger a search to retrieve fresh citations, specific URLs, and live academic papers.

Sen bir akademik denetçisin (Maddi Olgusal Süzgeç). Görevin, öğrencinin son mesajındaki nesnel, maddi olguları ve kronolojik gerçekleri doğrulamaktır. Görev sınırların KESİNLİKLE şu kurallarla daraltılmıştır:

1. KURAMSAL / KAVRAMSAL ANALİZLERİ PAS GEÇ: Öğrencinin getirdiği özgün teorik iddiaları, kuramsal yorumları, kavramsal sentezleri (Örn: Kürt hareketinin Gramscici anlamda hegemonya inşası çabası, yarım kalmış hegemonik projeler vb.) KESİNLİKLE internette aratıp doğrulamaya veya yanlışlamaya çalışmamalısın. Bu alanları tamamen pas geç. Kuramsal tartışmaları, anti-tez üretmeyi ve iddiaları tartma görevini tamamen ana modele (Prof. Dr. Verita) bırak.
2. SADECE MADDİ OLGU VE KRONOLOJİYE ODAKLAN: Tek odak noktan nesnel maddi olgular ve tarihsel kronolojidir. Öğrencinin bahsettiği dergi isimleri (Örn: Gelenek, Özgürlük Dünyası), yasal siyasi partiler (Örn: HEP, DEP, HADEP), kurumsal ittifaklar (Örn: 1995 Emek Barış Özgürlük Bloku) veya tarihsel aktörler/kurumlar gibi somut öznelerin o dönemde var olup olmadığını ve o dönemdeki ilişkilerini Google Search aracını kullanarak doğrula.
3. ANAKRONİZM VE BİLGİ HATASI DENETİMİ: Maddi bir tarih/zaman hatası (anakronizm) tespit edersen bunu raporla. Örneğin, 90'lı yıllardan bahsederken o dönemde henüz kurulmamış olan HDP veya AK Parti gibi partilerin/kurumların varmış gibi söylenmesi veya dergilerin/ittifakların tarihsel dönemlerinin uyuşmaması gibi somut kronolojik/olgusal hataları açıkça raporla.
4. KİTAP TAVSİYESİ VEYA DİĞER ARAMALARDAN KAÇIN: Kesinlikle kitap listesi veya kurucu kitap önerisi araştırması yapma, kitap listeleriyle uğraşma. Ajanın buradaki tek odak noktası, tarihsel/ampirik olguları, kronolojiyi ve anakronizm veya bilgi hatalarını doğrulamaktır.

Eğer internet verisi yetersizse veya bulamazsan uydurma, 'dijital açık kaynaklarda yeterli veri yok, fiziki arşive gidilmeli' notunu düş. Bana arama sonucunda bulduğun nesnel maddi/kronolojik olguları, varsa anakronizm ve olgusal bilgi hatalarını ve doğrudan referansları/URL'leri içeren ham bir bilgi doğrulama raporu üret.

Öğrencinin son mesajı:
"${userResponse.trim()}"`;

    let groundingReport =
      "Dijital açık kaynaklarda yeterli veri yok, fiziki arşive gidilmeli.";
    let searchSourcesText = "";

    try {
      const startAuditor = performance.now();
      const auditorResponse = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: auditorPrompt,
        config: {
          temperature: 1,
          tools: [{ googleSearch: {} }] as unknown as {
            googleSearch: Record<string, unknown>;
          }[],
        },
      });
      const auditorDuration = performance.now() - startAuditor;
      console.log(
        `[Stage 1 Auditor] [ID: ${correlationId}] Took: ${(auditorDuration / 1000).toFixed(2)}s | Model: gemini-2.5-flash`,
      );

      groundingReport = auditorResponse.text || "Denetçi raporu üretilemedi.";

      const groundingMetadata =
        auditorResponse.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks) {
        const uniqueSources = new Map<string, string>();
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            uniqueSources.set(chunk.web.uri, chunk.web.title || "Kaynak");
          }
        }
        if (uniqueSources.size > 0) {
          searchSourcesText =
            "\n\nDoğrulama Kaynakları:\n" +
            Array.from(uniqueSources.entries())
              .map(([uri, title]) => `- [${title}](${uri})`)
              .join("\n");
          console.log(
            `[Auditor Sources] [ID: ${correlationId}] ${uniqueSources.size} source(s) found:`,
            Array.from(uniqueSources.keys()),
          );
        }
      }
      console.log(
        `[Auditor Output] [ID: ${correlationId}] Report (first 200 chars): ${groundingReport.substring(0, 200).replace(/\n/g, " ")}...`,
      );
    } catch (auditorError) {
      console.error("Auditor Stage 1 Error:", auditorError);
      groundingReport =
        "Denetçi katmanında geçici bir arama hatası oluştu, fiziki arşive veya genel literatür bilgisine başvurulmalı.";
    }

    const groundingContextFeed = `
---
AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU (CONTEXT FEED):
Öğrencinin bahsettiği konuya dair gerçek zamanlı internet aramasıyla elde edilen ve doğrulanan ampirik bulgular:
${groundingReport}
${searchSourcesText ? `\nDoğrulanan Dijital Kaynaklar:\n${searchSourcesText}` : ""}
---
`;

    const lastReportInHistory = chatHistory
      .filter((m) => m.role === "originality_report")
      .pop();
    const activeOriginalityReport =
      originalityReport ||
      (lastReportInHistory?.reportData
        ? {
            risk: lastReportInHistory.reportData.risk,
            gapAnalysis: lastReportInHistory.reportData.gapAnalysis,
          }
        : undefined);

    const isHighRisk =
      activeOriginalityReport?.risk === "Yüksek" ||
      activeOriginalityReport?.risk === "Orta";

    const systemInstruction = isHighRisk
      ? `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere derin bir entelektüel istişare yürütüyorsun.

ÖNEMLİ UYARI: Yapılan Akademik Özgünlük Değer Raporu'nda "${activeOriginalityReport!.risk}" düzeyinde bir çakışma riski tespit edildi.
Raporun Stratejik Özgün Değer Tavsiyeleri (Gap Analizi):
${activeOriginalityReport!.gapAnalysis}

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir entelektüel sohbet atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (öğrencinin çalışmak istediği konuya uygun teorik kavramlar, kuramcılar veya literatür tartışmaları) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
   ÖNEMLİ EDEBİ SINIRLAMA: Hoca olarak yanıt üretirken kesinlikle "kahve kokusu odaya doluyor", "kahvemden bir yudum alıyorum", "gözlüğümü düzeltiyorum", "odanın sessizliğinde" veya "pencereden süzülen ışık" gibi fiziksel ortam betimlemeleri, edebi, romantik veya ağdalı kurgusal tasvirler KULLANMA. Karşılıklı diyalog tamamen sözel ve entelektüel düzeyde kalmalı, fiziksel aksiyon veya atmosfer tasvirleri içermelidir.
5. AKADEMİK MEYDAN OKUMA, ÖZGÜNLÜK VE GERÇEK ZAMANLI DOĞRULAMA GÜCÜ: Çakışma riskini, gap analizini ve en önemlisi "AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU"ndan gelen ampirik bulguları bilgece, teşvik edici fakat bilimsel ciddiyetle ele al. Öğrencinin getirdiği tarihsel ve kuramsal argümanları körü körüne onaylama (Confirmation Bias'ı tamamen kır). Denetçi ajandan gelen tarihsel gerçekleri arkana alarak öğrenciye meydan oku. Öğrenciye kuramsal setlerinin arkasındaki epistemolojik gerilimleri sor. İncelenen vakadaki kuramsal/tarihsel aktörlerin, yaklaşımların veya ekollerin arasındaki asimetriyi, kuramsal çelişkilerini yüzüne vur. Karakterini (bilge ama akademik standartları yüksek, titiz hoca) koru, ancak arkana arama motorunun ampirik gücünü alarak konuş. Eğer öğrenci çakışma riski üzerine yapılan bu uyarıma henüz cevap vermediyse veya konuyu esnetme önerisinde bulunmadıysa, öğrenciyi durdur, gap analizindeki 3 stratejik öneri doğrultusunda konuyu nasıl esnetebileceğimizi sor ve structuredData'yı kesinlikle null dön.
6. HOCA TETİKLEMELİ ONAY TEKLİFİ (ZORUNLU KURAL): Tezin kuramsal çerçevesi, araştırma sorusu, yöntemsel yaklaşım ve ampirik dönemler konuşmada yeterince netleşmemişse veya özgünlük riskleri tartışılmamışsa structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Öğrenci konuyu ilk anlattığında veya kuramsal çelişkileri henüz çözmediğinde isAcademicApproval alanını kesinlikle false dön. Ne zaman ki öğrenci sorduğun epistemolojik gerilimlere, makro-mikro yarılmalarına ve metodolojik veya kuramsal eksikliklerine olgun, jüriyi ikna edecek nitelikte yapısal bir savunma getirir; ancak o zaman mülakatı bitir, takdirini belirt ve isAcademicApproval alanını true olarak mühürle. Ancak tüm bu unsurlar tatmin edici biçimde olgunlaştığında, structuredData'yı doldur, needsReview = true tut ve o tezin konusuna, öğrencinin getirdiği argümanlara ve o ana özgün, sıcak ve akademik bir kapanış cümlesi kur. Bu kapanış cümlesi doğal, akıcı ve tamamen o sohbete özel olmalıdır; robotik veya önceden belirlenmiş kalıplar kesinlikle kullanılmamalıdır.

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Tezin iskeleti olgunlaştığında yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü ve çalışılan konunun temel teorik lensleri arasındaki ilişkiyi temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU DİNAMİK KUTU YAPISI (structuredData.boxes):
  Kutu sayısı statik bir rakama bağlanmamalı; tezin kuramsal, yöntemsel ve ampirik yapılandırma parçalarına (structural building blocks) göre tamamen dinamik olarak belirlenmelidir.
  Model, öğrencinin getirdiği her bir ana kuramsal lens için (Örn: Gramsci/Hegemonya), her bir yöntemsel araç için (Örn: Çerçeveleme Analizi), çift taraflı kaynak haritasının her bir bağımsız tarafı için (Örn: Kürt hareketi yayın organları için ayrı bir kutu, Türkiye sosyalist sol dergileri için ayrı bir kutu) ve bu aktörlerin somut tarihsel/kurumsal kesişim/kriz uğrakları için (Örn: İttifaklar, okur mektupları ve kriz anları) MÜSTAKİL BİRER KUTU üretmelidir.
  Her kutunun "name" alanı semantik aramalarda kullanılacağı için son derece spesifik, "description" alanı ise o yapılandırma parçasının sınırlarını jüri standartlarında çizen yoğun bir akademik proposal paragrafı olmalıdır.

Yanıtını KESİNLİKLE responseMimeType: "application/json" ayarlarına uygun, geçerli bir JSON olarak aşağıdaki şemada döndürmelisin:
{
  "message": "Özgünlük riski/gap analizini değerlendiren ve konuyu esneten bilgece yönlendirme sorusu veya onay teklifi...",
  "needsReview": true,
  "structuredData": null veya dolu nesne
}

${groundingContextFeed}`
      : `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere derin bir entelektüel istişare yürütüyorsun.

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir entelektüel sohbet atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (öğrencinin çalışmak istediği konuya uygun teorik kavramlar, kuramcılar veya literatür tartışmaları) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
   ÖNEMLİ EDEBİ SINIRLAMA: Hoca olarak yanıt üretirken kesinlikle "kahve kokusu odaya doluyor", "kahvemden bir yudum alıyorum", "gözlüğümü düzeltiyorum", "odanın sessizliğinde" veya "pencereden süzülen ışık" gibi fiziksel ortam betimlemeleri, edebi, romantik veya ağdalı kurgusal tasvirler KULLANMA. Karşılıklı diyalog tamamen sözel ve entelektüel düzeyde kalmalı, fiziksel aksiyon veya atmosfer tasvirleri içermelidir.
5. AKADEMİK MEYDAN OKUMA VE GERÇEK ZAMANLI DOĞRULAMA GÜCÜ: Kendi engin entelektüel birikimini ve "AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU"ndan gelen ampirik bulguları kullan. Öğrencinin getirdiği tarihsel ve kuramsal argümanları körü körüne onaylama (Confirmation Bias'ı tamamen kır). Denetçi ajandan gelen tarihsel gerçekleri arkana alarak öğrenciye meydan oku. Öğrenciye kuramsal setlerinin arkasındaki epistemolojik gerilimleri sor. İncelenen vakadaki kuramsal/tarihsel aktörlerin, yaklaşımların veya ekollerin arasındaki asimetriyi, kuramsal çelişkilerini yüzüne vur. Karakterini (bilge ama akademik standartları yüksek, titiz hoca) koru, ancak arkana arama motorunun ampirik gücünü alarak konuş. Öğrencinin fikirlerindeki kuramsal açıkları, metodolojik zayıflıkları ve bir akademik jürinin bu çalışmayı nerede çökertebileceğini dürüstçe fakat yapıcı bir üslupla göster. Karşı argümanlar (antiteler) üreterek öğrenciye rehberlik et.
6. HOCA TETİKLEMELİ ONAY TEKLİFİ (ZORUNLU KURAL): Tezin kuramsal çerçevesi, araştırma sorusu, yöntemsel yaklaşım ve ampirik dönemler konuşmada yeterince netleşmemişse structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Öğrenci konuyu ilk anlattığında veya kuramsal çelişkileri henüz çözmediğinde isAcademicApproval alanını kesinlikle false dön. Ne zaman ki öğrenci sorduğun epistemolojik gerilimlere, makro-mikro yarılmalarına ve metodolojik veya kuramsal eksikliklerine olgun, jüriyi ikna edecek nitelikte yapısal bir savunma getirir; ancak o zaman mülakatı bitir, takdirini belirt ve isAcademicApproval alanını true olarak mühürle. Ancak bu unsurlar tatmin edici biçimde olgunlaştığında, structuredData'yı doldur, needsReview = true tut ve o tezin konusuna, öğrencinin getirdiği argümanlara ve o ana özgün, sıcak ve akademik bir kapanış cümlesi kur. Bu kapanış cümlesi doğal, akıcı ve tamamen o sohbete özel olmalıdır; robotik veya önceden belirlenmiş kalıplar kesinlikle kullanılmamalıdır.

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Tezin iskeleti olgunlaştığında yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü ve çalışılan konunun temel teorik lensleri arasındaki ilişkiyi temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU DİNAMİK KUTU YAPISI (structuredData.boxes):
  Kutu sayısı statik bir rakama bağlanmamalı; tezin kuramsal, yöntemsel ve ampirik yapılandırma parçalarına (structural building blocks) göre tamamen dinamik olarak belirlenmelidir.
  Model, öğrencinin getirdiği her bir ana kuramsal lens için (Örn: Gramsci/Hegemonya), her bir yöntemsel araç için (Örn: Çerçeveleme Analizi), çift taraflı kaynak haritasının her bir bağımsız tarafı için (Örn: Kürt hareketi yayın organları için ayrı bir kutu, Türkiye sosyalist sol dergileri için ayrı bir kutu) ve bu aktörlerin somut tarihsel/kurumsal kesişim/kriz uğrakları için (Örn: İttifaklar, okur mektupları ve kriz anları) MÜSTAKİL BİRER KUTU üretmelidir.
  Her kutunun "name" alanı semantik aramalarda kullanılacağı için son derece spesifik, "description" alanı ise o yapılandırma parçasının sınırlarını jüri standartlarında çizen yoğun bir akademik proposal paragrafı olmalıdır.

Yanıtını KESİNLİKLE responseMimeType: "application/json" ayarlarına uygun, geçerli bir JSON olarak aşağıdaki şemada döndürmelisin:
{
  "message": "Öğrenciye yönelik akademik yorum, derin analiz ve yönlendirme sorusu veya onay teklifi açıklaması...",
  "needsReview": true,
  "structuredData": null veya dolu nesne
}
${groundingContextFeed}`;

    const contents = [
      ...chatHistory
        .filter((item) => item.role !== "originality_report")
        .map((item) => ({
          role: item.role as "user" | "model",
          parts: [{ text: item.content }],
        })),
      {
        role: "user" as const,
        parts: [{ text: userResponse.trim() }],
      },
    ];

    const onboardingResponseSchema = {
      type: "OBJECT" as const,
      properties: {
        message: {
          type: "STRING" as const,
          description:
            "Kullanıcının cevabına dair akademik yorum ve sıradaki soru",
        },
        needsReview: {
          type: "BOOLEAN" as const,
          description:
            "Mülakatın devam etmesi gerekiyorsa true, sözel onay alınıp anayasa basıldığında false",
        },
        isAcademicApproval: {
          type: "BOOLEAN" as const,
          description:
            "Eğer öğrencinin verdiği yanıt teorik, yöntemsel ve ampirik olarak tam anlamıyla olgunluğa eriştiyse ve hoca mülakatı bitirmek istiyorsa true, aksi halde (öğrenciye hala soru soruluyorsa ve meydan okunuyorsa) kesinlikle false dönmelidir.",
        },
        structuredData: {
          type: "OBJECT" as const,
          description:
            "Mülakat tamamlandığında (kullanıcı sözel onay verdiğinde) sentezlenmiş tez anayasası bilgileri, aksi takdirde null",
          properties: {
            title: { type: "STRING" as const },
            researchQuestion: { type: "STRING" as const },
            argument: { type: "STRING" as const },
            methodology: { type: "STRING" as const },
            isAcademicApproval: {
              type: "BOOLEAN" as const,
              description:
                "Eğer öğrencinin verdiği yanıt teorik, yöntemsel ve ampirik olarak tam anlamıyla olgunluğa eriştiyse ve hoca mülakatı bitirmek istiyorsa true, aksi halde (öğrenciye hala soru soruluyorsa ve meydan okunuyorsa) kesinlikle false dönmelidir.",
            },
            boxes: {
              type: "ARRAY" as const,
              description:
                "Tezin kuramsal, yöntemsel ve ampirik yapılandırma parçalarına (structural building blocks) göre tamamen dinamik olarak üretilmiş müstakil tematik çalışma kutuları. Her kuramsal lens, yöntemsel araç, kaynak haritasının bağımsız tarafları ve tarihsel kesişim uğrakları için ayrı birer kutu üretilmelidir.",
              items: {
                type: "OBJECT" as const,
                properties: {
                  name: { type: "STRING" as const },
                  description: { type: "STRING" as const },
                },
                required: ["name", "description"],
              },
            },
          },
          required: [
            "title",
            "researchQuestion",
            "argument",
            "methodology",
            "isAcademicApproval",
            "boxes",
          ],
        },
      },
      required: ["message", "needsReview", "isAcademicApproval"],
    };

    // --- FAZLI ÇALIŞTIRMA: SADECE HOCA ÇAĞRISI YAPILIR ---
    console.log(
      `[Stage 2 Professor] [ID: ${correlationId}] Calling Professor model...`,
    );
    const startProfessor = performance.now();
    const genAIResponse = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: onboardingResponseSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });
    const professorDuration = performance.now() - startProfessor;
    console.log(
      `[Stage 2 Professor] [ID: ${correlationId}] Took: ${(professorDuration / 1000).toFixed(2)}s | Model: gemini-3.1-flash-lite | Thinking Level: HIGH`,
    );

    let finalHocaResponseText = genAIResponse.text;
    let finalOriginalityReport = null;

    if (!finalHocaResponseText) {
      return {
        success: false,
        error: "Yapay zeka motorundan boş bir yanıt döndü.",
      };
    }

    let parsed: {
      message: string;
      isAcademicApproval?: boolean;
      structuredData?: {
        title: string;
        researchQuestion: string;
        argument: string;
        methodology: string;
        isAcademicApproval?: boolean;
        boxes?: {
          name: string;
          description: string;
        }[];
        coreBooks?: {
          title: string;
          author: string;
          publisher: string;
          year: string;
          rationale: string;
        }[];
      } | null;
      needsReview?: boolean;
    } = JSON.parse(finalHocaResponseText);

    console.log(
      `[Professor Response] [ID: ${correlationId}] isAcademicApproval: ${parsed.isAcademicApproval} | needsReview: ${parsed.needsReview} | structuredData: ${parsed.structuredData ? "PRESENT" : "null"} | Boxes: ${parsed.structuredData?.boxes?.length ?? 0}`,
    );

    // --- AKIŞ KONTROLÜ (FLOW CONTROL) GÜVENLİK DUVARI ---
    // Regex tabanlı metin taraması kaldırıldı.
    // Onay yetkisi doğrudan modelin JSON şemasındaki isAcademicApproval Boolean bayrağına bağlıdır.
    // İkincil guard: kullanıcının sözel rızası.
    const isUserApproving =
      /onay|kabul|tamam|uygun|eklemek istediğim|sorum yok/i.test(userResponse);

    const isApprovalAllowed = isUserApproving;

    if (parsed.isAcademicApproval === true && !isApprovalAllowed) {
      console.log(
        `[Flow Control] [ID: ${correlationId}] EARLY APPROVAL BLOCKED — isUserApproving=${isUserApproving} | isApprovalAllowed=${isApprovalAllowed}`,
      );
      parsed.isAcademicApproval = false;
      parsed.structuredData = null;
    }

    // Dinamik Makro Bağlam: İlk kullanıcı turn'ünden tezin ana konusunu yakala
    const firstUserMessage = chatHistory.find((m) => m.role === "user");
    const mainTopicSummary = firstUserMessage
      ? firstUserMessage.content.trim()
      : userResponse.trim();

    // Kapanış Fazı Kontrolü: Hoca onay verdi ve structuredData dolu ise
    const hocaWantsApproval =
      parsed.isAcademicApproval === true &&
      parsed.structuredData !== null &&
      parsed.structuredData !== undefined;

    if (hocaWantsApproval) {
      console.log(
        `[Stage 4 Tezara] [ID: ${correlationId}] Firing CONTEXT-AWARE originality check...`,
      );
      // Sohbet çöpü yerine rafine structuredData JSON payload'ı gönderiyoruz
      const targetPayload = JSON.stringify({
        title: parsed.structuredData!.title,
        researchQuestion: parsed.structuredData!.researchQuestion,
        argument: parsed.structuredData!.argument,
        methodology: parsed.structuredData!.methodology,
      });

      const startTezara = performance.now();
      const originalityRes = await checkTezaraOriginalityAction(targetPayload);

      if (originalityRes.success && originalityRes.report) {
        finalOriginalityReport = originalityRes.report;
        const tezaraDuration = performance.now() - startTezara;
        console.log(
          `[Tezara Result] [ID: ${correlationId}] Took: ${(tezaraDuration / 1000).toFixed(2)}s | Risk: ${finalOriginalityReport.risk} | Theses Found: ${finalOriginalityReport.theses.length} | Gap Analysis (first 150 chars): ${finalOriginalityReport.gapAnalysis.substring(0, 150).replace(/\n/g, " ")}...`,
        );

        const isActuallyHighRisk =
          finalOriginalityReport.risk === "Orta" ||
          finalOriginalityReport.risk === "Yüksek";

        if (isActuallyHighRisk) {
          console.log(
            `[Tezara Risk] [ID: ${correlationId}] ${finalOriginalityReport.risk} risk detected. Revoking approval, running revised Professor call...`,
          );

          // 1. Hocanın verdiği onayı iptal et
          parsed.isAcademicApproval = false;
          parsed.structuredData = null;

          // 2. Revize hoca çağrısı tetikle
          const revisedSystemInstruction = `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere derin bir entelektüel istişare yürütüyorsun.

ÖNEMLİ UYARI: Yapılan Akademik Özgünlük Değer Raporu'nda "${finalOriginalityReport.risk}" düzeyinde bir çakışma riski tespit edildi.
Raporun Stratejik Özgün Değer Tavsiyeleri (Gap Analizi):
${finalOriginalityReport.gapAnalysis}

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir entelektüel sohbet atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (öğrencinin çalışmak istediği konuya uygun teorik kavramlar, kuramcılar veya literatür tartışmaları) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
   ÖNEMLİ EDEBİ SINIRLAMA: Hoca olarak yanıt üretirken kesinlikle "kahve kokusu odaya doluyor", "kahvemden bir yudum alıyorum", "gözlüğümü düzeltiyorum", "odanın sessizliğinde" veya "pencereden süzülen ışık" gibi fiziksel ortam betimlemeleri, edebi, romantik veya ağdalı kurgusal tasvirler KULLANMA. Karşılıklı diyalog tamamen sözel ve entelektüel düzeyde kalmalı, fiziksel aksiyon veya atmosfer tasvirleri içermelidir.
5. AKADEMİK MEYDAN OKUMA, ÖZGÜNLÜK VE GERÇEK ZAMANLI DOĞRULAMA GÜCÜ: Çakışma riskini, gap analizini ve en önemlisi "AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU"ndan gelen ampirik bulguları bilgece, teşvik edici fakat bilimsel ciddiyetle ele al. Öğrencinin getirdiği tarihsel ve kuramsal argümanları körü körüne onaylama (Confirmation Bias'ı tamamen kır). Denetçi ajandan gelen tarihsel gerçekleri arkana alarak öğrenciye meydan oku. Öğrenciye kuramsal setlerinin arkasındaki epistemolojik gerilimleri sor. İncelenen vakadaki kuramsal/tarihsel aktörlerin, yaklaşımların veya ekollerin arasındaki asimetriyi, kuramsal çelişkilerini yüzüne vur. Karakterini (bilge ama akademik standartları yüksek, titiz hoca) koru, ancak arkana arama motorunun ampirik gücünü alarak konuş. Eğer öğrenci çakışma riski üzerine yapılan bu uyarıma henüz cevap vermediyse veya konuyu esnetme önerisinde bulunmadıysa, öğrenciyi durdur, gap analizindeki 3 stratejik öneri doğrultusunda konuyu nasıl esnetebileceğimizi sor ve structuredData'yı kesinlikle null dön.
6. HOCA TETİKLEMELİ ONAY TEKLİFİ (ZORUNLU KURAL): Tezin kuramsal çerçevesi, araştırma sorusu, yöntemsel yaklaşım ve ampirik dönemler konuşmada yeterince netleşmemişse veya özgünlük riskleri tartışılmamışsa structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Öğrenci konuyu ilk anlattığında veya kuramsal çelişkileri henüz çözmediğinde isAcademicApproval alanını kesinlikle false dön. Ne zaman ki öğrenci sorduğun epistemolojik gerilimlere, makro-mikro yarılmalarına ve metodolojik veya kuramsal eksikliklerine olgun, jüriyi ikna edecek nitelikte yapısal bir savunma getirir; ancak o zaman mülakatı bitir, takdirini belirt ve isAcademicApproval alanını true olarak mühürle. Ancak tüm bu unsurlar tatmin edici biçimde olgunlaştığında, structuredData'yı doldur, needsReview = true tut ve o tezin konusuna, öğrencinin getirdiği argümanlara ve o ana özgün, sıcak ve akademik bir kapanış cümlesi kur. Bu kapanış cümlesi doğal, akıcı ve tamamen o sohbete özel olmalıdır; robotik veya önceden belirlenmiş kalıplar kesinlikle kullanılmamalıdır.

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Tezin iskeleti olgunlaştığında yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü ve çalışılan konunun temel teorik lensleri arasındaki ilişkiyi temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU DİNAMİK KUTU YAPISI (structuredData.boxes):
  Kutu sayısı statik bir rakama bağlanmamalı; tezin kuramsal, yöntemsel ve ampirik yapılandırma parçalarına (structural building blocks) göre tamamen dinamik olarak belirlenmelidir.
  Model, öğrencinin getirdiği her bir ana kuramsal lens için (Örn: Gramsci/Hegemonya), her bir yöntemsel araç için (Örn: Çerçeveleme Analizi), çift taraflı kaynak haritasının her bir bağımsız tarafı için (Örn: Kürt hareketi yayın organları için ayrı bir kutu, Türkiye sosyalist sol dergileri için ayrı bir kutu) ve bu aktörlerin somut tarihsel/kurumsal kesişim/kriz uğrakları için (Örn: İttifaklar, okur mektupları ve kriz anları) MÜSTAKİL BİRER KUTU üretmelidir.
  Her kutunun "name" alanı semantik aramalarda kullanılacağı için son derece spesifik, "description" alanı ise o yapılandırma parçasının sınırlarını jüri standartlarında çizen yoğun bir akademik proposal paragrafı olmalıdır.

${groundingContextFeed}`;

          const startRevised = performance.now();
          const revisedGenAIResponse = await generateContentWithRetry(ai, {
            model: "gemini-3.1-flash-lite",
            contents: contents,
            config: {
              systemInstruction: revisedSystemInstruction,
              temperature: 1,
              responseMimeType: "application/json",
              responseSchema: onboardingResponseSchema,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.HIGH,
              },
            },
          });
          const revisedDuration = performance.now() - startRevised;
          console.log(
            `[Revised Professor] [ID: ${correlationId}] Took: ${(revisedDuration / 1000).toFixed(2)}s`,
          );

          if (revisedGenAIResponse.text) {
            finalHocaResponseText = revisedGenAIResponse.text;
            parsed = JSON.parse(finalHocaResponseText);
          }
        }
      }
    }

    // HİBRİT AKIŞ KONTROLÜ (FLOW CONTROL):
    if (!parsed.structuredData) {
      parsed.structuredData = null;
      parsed.needsReview = true;
    } else {
      // structuredData doluysa needsReview her zaman true kalır (kullanıcı butonla onaylar)
      parsed.needsReview = true;
      // structuredData altındaki isAcademicApproval alanını da eşitleyelim
      parsed.structuredData.isAcademicApproval =
        parsed.isAcademicApproval ??
        parsed.structuredData.isAcademicApproval ??
        false;

      const isApproved =
        parsed.isAcademicApproval === true ||
        parsed.structuredData.isAcademicApproval === true;

      if (
        isApproved &&
        parsed.structuredData.boxes &&
        Array.isArray(parsed.structuredData.boxes)
      ) {
        console.log(
          `[Stage 5 Core Books] [ID: ${correlationId}] Starting search for ${parsed.structuredData.boxes.length} box(es)...`,
        );
        parsed.structuredData.coreBooks = await generateCoreBooksForBoxes(
          ai,
          parsed.structuredData.boxes,
          correlationId,
          mainTopicSummary,
        );
      } else {
        parsed.structuredData.coreBooks = [];
      }
    }

    const totalDuration = performance.now() - pipelineStart;
    console.log(
      `[Onboarding Pipeline Completed] [ID: ${correlationId}] [Total Time: ${(totalDuration / 1000).toFixed(2)}s]`,
    );
    console.log(
      `[Onboarding Summary] [ID: ${correlationId}] isAcademicApproval: ${parsed.isAcademicApproval} | Originality Report: ${finalOriginalityReport ? finalOriginalityReport.risk : "N/A"} | structuredData: ${parsed.structuredData ? "READY" : "NULL"}`,
    );

    return {
      success: true,
      message: parsed.message,
      structuredData: parsed.structuredData || null,
      needsReview: parsed.needsReview ?? false,
      isAcademicApproval: parsed.isAcademicApproval ?? false,
      originalityReport: finalOriginalityReport,
    };
  } catch (error) {
    const failDuration = performance.now() - pipelineStart;
    console.error(
      `[Onboarding Pipeline FAILED] [ID: ${correlationId}] [Total Time: ${(failDuration / 1000).toFixed(2)}s] Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Yapay zekadan cevap alınırken hata oluştu.",
    };
  }
}

interface CoreBook {
  title: string;
  author: string;
  publisher: string;
  year: string;
  rationale: string;
}

/**
 * Mülakatın sonunda sentezlenen her bir box (kutu) için Google Search tool'unu kullanarak
 * o kutunun ana konusuna dair tam 1 adet "kurucu/temel" kaynak (kitap/monografi) bulur.
 */
async function generateCoreBooksForBoxes(
  ai: GoogleGenAI,
  boxes: { name: string; description: string }[],
  correlationId: string,
  mainTopicSummary: string,
): Promise<CoreBook[]> {
  console.log(
    `[Stage 5 Core Books] [ID: ${correlationId}] Starting HYBRID TWO-STEP sequential search for ${boxes.length} box(es)...`,
  );
  const results: CoreBook[] = [];

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];

    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const startBox = performance.now();
    try {
      // AŞAMA 1: Gemini 2.5 Flash ile Sadece Arama (Canlı İnternet Taraması)
      const searchPrompt = `MANDATORY INSTRUCTION: You MUST use the Google Search tool to execute a web search. Do NOT rely on your pre-trained knowledge.

Biz "${mainTopicSummary}" ana konusu üzerine bir tez yazıyoruz.
Aşağıdaki tematik çalışma kutusunun konusunu en güçlü şekilde besleyecek, literatürde saygın ve klasikleşmiş 1 adet kurucu akademik KİTAP (monografi) bul.
Kutu Adı: ${box.name}
Kutu Açıklaması: ${box.description}

Bana sadece bulduğun kitabın adını, yazarını, yayınevini, yayın yılını ve gerekçesini düz metin olarak raporla.`;

      const searchResponse = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: searchPrompt,
        config: {
          temperature: 1,
          tools: [{ googleSearch: {} }] as unknown as {
            googleSearch: Record<string, unknown>;
          }[],
        },
      });

      const rawText = searchResponse.text || "";

      // AŞAMA 2: Gemini 3.1 Flash Lite ile Sadece Parse (Kota Dostu Şemaya Zorlama)
      const parsePrompt = `Aşağıdaki ham kitap araştırma verisini al ve KESİNLİKLE hiçbir ek yorum yapmadan, sadece senden istenen JSON şemasına uygun olarak yapılandır.

Ham Veri:
"${rawText}"`;

      const parseResponse = await generateContentWithRetry(ai, {
        model: "gemini-3.1-flash-lite",
        contents: parsePrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              author: { type: "STRING" },
              publisher: { type: "STRING" },
              year: { type: "STRING" },
              rationale: { type: "STRING" },
            },
            required: ["title", "author", "publisher", "year", "rationale"],
          },
        },
      });

      if (parseResponse.text) {
        const book = JSON.parse(parseResponse.text);
        if (book.title) book.title = formatBookTitle(book.title);
        const boxDuration = performance.now() - startBox;
        console.log(
          `[Core Book Result] [ID: ${correlationId}] Box ${i + 1}/${boxes.length} ("${box.name}") → Found: "${book.title}" (${book.year}) | Took: ${(boxDuration / 1000).toFixed(2)}s | Model: Hybrid (2.5 Search -> 3.1 Parse)`,
        );
        results.push(book);
      }
    } catch (err) {
      console.error(`Error searching book for box ${box.name}:`, err);
    }
  }

  return results;
}

/**
 * Dinamik Başlık Formatlama (Regex Yardımcısı)
 * Kitap başlığı (title) string değerinde geçen iki nokta üst üste (:) veya soru işareti (?)
 * karakterlerinden hemen sonra gelen ilk harfi (eğer küçükse) otomatik olarak büyük harfe çevirir.
 */
function formatBookTitle(title: string): string {
  if (!title) return title;
  return title.replace(
    /([:?]\s*)(\p{L})/gu,
    (match, separator, letter) => separator + letter.toUpperCase(),
  );
}
