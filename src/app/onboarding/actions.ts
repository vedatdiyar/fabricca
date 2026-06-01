"use server";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";
import { verifyBooksWithGemini } from "@/lib/verify-books";

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
  needsOriginalityCheck?: boolean;
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
            `[Auditor Sources] [ID: ${correlationId}] ${uniqueSources.size} source(s) found.`,
          );
        }
      }
      console.log(
        `[Auditor Output] [ID: ${correlationId}] Report (first 200 chars): ${groundingReport.substring(0, 200).replace(/\n/g, " ")}...`,
      );
    } catch (auditorError) {
      console.error("Auditor Stage 1 Error:", auditorError);
      return {
        success: false,
        error:
          "Akademik Denetçi Süzgeci sunucu yoğunluğu nedeniyle geçici olarak devre dışı kaldı. Lütfen az sonra tekrar deneyiniz.",
      };
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
- "Tez Başlığı" (structuredData.title): Kesinlikle ampirik veya teorik bir ön kabul (başarı/başarısızlık, çöküş, zafer gibi sonuca dayalı a priori sıfatlar) içermeyen nesnel bir başlık. Başlığın dil bilgisi yapısı ve kavramsal odağı, mülakatta öğrencinin benimsediği kuramsal paradigma ile dinamik olarak tam uyumlu olmalıdır:
  a) Eğer tezin kuramsal çerçevesi AKTÖR/EYLEM odaklıysa (stratejik hamleler, rıza üretimi, hegemonya inşası vb.); başlık aktif eylem dilini ve öznenin iradesini korumalıdır.
  b) Eğer tezin kuramsal çerçevesi YAPI/SÖYLEM veya ALIMLAMA odaklıysa (söylemsel kesişmeler, yapısal sınırlar, kurumsal eklemlenmeler, post-yapısal analiz vb.); başlık bu kuramsal lense sadık kalarak edilgen, yapısal veya ilişkisel kavramları başarıyla yansıtabilmelidir.
  Model, mülakat geçmişinden bu paradigma ayrımını dinamik olarak teşhis etmeli ve başlığın gramer yapısını (aktif/edilgen) bu doğrultuda sentezlemelidir.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik ve kronolojik ön kabulleri eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto. Araştırma sorusuna, çalışmanın ampirik bulgusu veya olası analitik sonucu olabilecek durumları (başarı, başarısızlık, etkililik düzeyi vb.) KESİNLİKLE baştan verilmiş birer varsayım/sıfat olarak soru köküne yerleştirmemeli; süreci ve nedensel mekanizmayı tarafsız, meraklı ve ucu açık bir dille sorgulamalıdır.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin veya kuramsal kavramların dönüşümünü ve çalışılan konunun temel teorik lensleri arasındaki ilişkiyi temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 200 kelimelik, öğrencinin tez önerisindeki ampirik kaynak matrisinin tamamını kapsayan zengin bir metodoloji metni. Eğer tezin yöntemsel kurgusu ilişkisel karşılaşma, karşılaştırma veya çoklu arşiv taramasına dayanıyorsa; metodoloji metni ve dynamic boxes alanları KESİNLİKLE bu çok boyutlu/çift taraflı kaynak yapısının her bir bileşenini bağımsız ve dengeli olarak içermeli, kaynak haritasındaki temel kurumsal/ampirik veri kaynaklarından hiçbirini dışarıda bırakmamalıdır.
- ZORUNLU DİNAMİK KUTU YAPISI (structuredData.boxes):
  Kutu sayısı statik bir rakama bağlanmamalı; tezin kuramsal, yöntemsel ve ampirik yapılandırma parçalarına (structural building blocks) göre tamamen dinamik olarak belirlenmelidir.
  Model, öğrencinin getirdiği her bir ana kuramsal lens, her bir yöntemsel araç, ilişkisel/karşılaştırmalı kaynak haritasının her bir bağımsız tarafı ve bu aktörlerin/yapıların somut tarihsel/kurumsal kesişim/kriz uğrakları için KESİNLİKLE MÜSTAKİL BİRER KUTU üretmelidir. Model, bu birimler arasında KESİNLİKLE keyfi bir 'birincil/ikincil' ast-üst hiyerarşisi kurgulamamalıdır; öğrenci aksi bir asimetri tanımlamadığı sürece eşdeğer önemde kutulandırılmalıdır.
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
- "Tez Başlığı" (structuredData.title): Kesinlikle ampirik veya teorik bir ön kabul (başarı/başarısızlık, çöküş, zafer gibi sonuca dayalı a priori sıfatlar) içermeyen nesnel bir başlık. Başlığın dil bilgisi yapısı ve kavramsal odağı, mülakatta öğrencinin benimsediği kuramsal paradigma ile dinamik olarak tam uyumlu olmalıdır:
  a) Eğer tezin kuramsal çerçevesi AKTÖR/EYLEM odaklıysa (stratejik hamleler, rıza üretimi, hegemonya inşası vb.); başlık aktif eylem dilini ve öznenin iradesini korumalıdır.
  b) Eğer tezin kuramsal çerçevesi YAPI/SÖYLEM veya ALIMLAMA odaklıysa (söylemsel kesişmeler, yapısal sınırlar, kurumsal eklemlenmeler, post-yapısal analiz vb.); başlık bu kuramsal lense sadık kalarak edilgen, yapısal veya ilişkisel kavramları başarıyla yansıtabilmelidir.
  Model, mülakat geçmişinden bu paradigma ayrımını dinamik olarak teşhis etmeli ve başlığın gramer yapısını (aktif/edilgen) bu doğrultuda sentezlemelidir.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik ve kronolojik ön kabulleri eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto. Araştırma sorusuna, çalışmanın ampirik bulgusu veya olası analitik sonucu olabilecek durumları (başarı, başarısızlık, etkililik düzeyi vb.) KESİNLİKLE baştan verilmiş birer varsayım/sıfat olarak soru köküne yerleştirmemeli; süreci ve nedensel mekanizmayı tarafsız, meraklı ve ucu açık bir dille sorgulamalıdır.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin veya kuramsal kavramların dönüşümünü ve çalışılan konunun temel teorik lensleri arasındaki ilişkiyi temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 200 kelimelik, öğrencinin tez önerisindeki ampirik kaynak matrisinin tamamını kapsayan zengin bir metodoloji metni. Eğer tezin yöntemsel kurgusu ilişkisel karşılaşma, karşılaştırma veya çoklu arşiv taramasına dayanıyorsa; metodoloji metni ve dynamic boxes alanları KESİNLİKLE bu çok boyutlu/çift taraflı kaynak yapısının her bir bileşenini bağımsız ve dengeli olarak içermeli, kaynak haritasındaki temel kurumsal/ampirik veri kaynaklarından hiçbirini dışarıda bırakmamalıdır.
- ZORUNLU DİNAMİK KUTU YAPISI (structuredData.boxes):
  Kutu sayısı statik bir rakama bağlanmamalı; tezin kuramsal, yöntemsel ve ampirik yapılandırma parçalarına (structural building blocks) göre tamamen dinamik olarak belirlenmelidir.
  Model, öğrencinin getirdiği her bir ana kuramsal lens, her bir yöntemsel araç, ilişkisel/karşılaştırmalı kaynak haritasının her bir bağımsız tarafı ve bu aktörlerin/yapıların somut tarihsel/kurumsal kesişim/kriz uğrakları için KESİNLİKLE MÜSTAKİL BİRER KUTU üretmelidir. Model, bu birimler arasında KESİNLİKLE keyfi bir 'birincil/ikincil' ast-üst hiyerarşisi kurgulamamalıdır; öğrenci aksi bir asimetri tanımlamadığı sürece eşdeğer önemde kutulandırılmalıdır.
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

    const finalHocaResponseText = genAIResponse.text;
    const _finalOriginalityReport = null;

    if (!finalHocaResponseText) {
      return {
        success: false,
        error: "Yapay zeka motorundan boş bir yanıt döndü.",
      };
    }

    const parsed: {
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
      /onay|kabul|tamam|uygun|sorum yok|evet|devam|harika|yeterli|yeterince|mukemmel|m.kemmel|dogru|do.ru|kesinlikle|ilerleyelim|ilerle|olabilir|baslayalim|ba.layal.m|baslayabiliriz|kaydedelim|kaydet|eksiksiz|anlatt.m|anlat.m do.ru/i.test(
        userResponse,
      );

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
    const _mainTopicSummary = firstUserMessage
      ? firstUserMessage.content.trim()
      : userResponse.trim();

    // Kapanış Fazı Kontrolü: Hoca onay verdi ve structuredData dolu ise
    const hocaWantsApproval =
      parsed.isAcademicApproval === true &&
      parsed.structuredData !== null &&
      parsed.structuredData !== undefined;

    if (hocaWantsApproval && parsed.structuredData) {
      console.log(
        `[Onboarding Action] [ID: ${correlationId}] Professor proposed approval. Running UNIFIED ONE-STEP PIPELINE (Tezara + Books)...`,
      );

      // 1. Run checkTezaraOriginalityAction
      const targetPayload = JSON.stringify({
        title: parsed.structuredData.title,
        researchQuestion: parsed.structuredData.researchQuestion,
        argument: parsed.structuredData.argument,
        methodology: parsed.structuredData.methodology,
      });

      const startTezara = performance.now();
      const originalityRes = await checkTezaraOriginalityAction(targetPayload);
      const tezaraDuration = performance.now() - startTezara;

      if (!originalityRes.success || !originalityRes.report) {
        console.error(
          `[Unified Pipeline] Tezara originality check failed:`,
          originalityRes.error,
        );
        throw new Error(
          originalityRes.error || "Özgünlük kontrolü sırasında hata oluştu.",
        );
      }

      const report = originalityRes.report;
      console.log(
        `[Unified Pipeline] Tezara Result: Took: ${(tezaraDuration / 1000).toFixed(2)}s | Risk: ${report.risk}`,
      );

      const isActuallyHighRisk =
        report.risk === "Orta" || report.risk === "Yüksek";

      if (isActuallyHighRisk) {
        console.log(
          `[Unified Pipeline] High/Medium risk detected. Overriding approval and warning student.`,
        );

        // Block approval:
        parsed.isAcademicApproval = false;

        // Perform second model call internally to generate the Professor's response
        // feeding the warning context.
        const secondTurnSystemInstruction = `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın.
Öğrenciyle tezi onaylama aşamasına gelmiştiniz ancak arka planda ulusal tez arşivlerimizi (Tezara/YÖK Tez) tarattık ve ciddi bir çakışma riski tespit edildi.
Tespit Edilen Risk Seviyesi: ${report.risk}

Görev sınırların ve üslup kuralların:
1. Öğrenciyi (Vedat) bu çakışma riski hakkında dürüstçe, yapıcı ve teşvik edici bir tonda uyar.
2. KESİN YASAK - TEZ İSMİ VE YAZAR YASAĞI: Konuşmanda KESİNLİKLE hiçbir tezin ismini (başlığını), yazar adını/soyadını, danışman ismini veya veri tabanı ID numarasını geçirme. Öğrenciye çakışan çalışmaları isimsiz olarak, sadece ele aldıkları kuramsal çerçeveler, ampirik alanlar ve inceledikleri tarihsel dönemler üzerinden açıklayarak değerlendir.
3. Tezin özgün değerini kurtarmak için öğrencinin konuyu nasıl esnetmesi/değiştirmesi gerektiğine dair gap analizinden gelen stratejik önerileri bilgece anlat ve öğrenciye bu konuda tek bir meydan okuyucu/yönlendirici soru sor.
4. Kesinlikle "kahve kokusu", "pencere ışığı" vb. fiziksel veya edebi betimlemeler KULLANMA. Karakterini (titiz ve akademik standartları yüksek hoca) koru.`;

        const secondTurnPrompt = `Öğrencinin Tez Başlığı: "${parsed.structuredData?.title || ""}"
Özgünlük Analizi Raporu (Tezara):
Risk: ${report.risk}
Gerekçe: ${report.reasoning}
Gap Analizi ve Öneriler: ${report.gapAnalysis}
Çakışan Tezler: ${JSON.stringify(report.theses)}

Lütfen bu bilgilere göre öğrenciyi uyaracak ve konuyu esnetmesini sağlayacak bilgece bir mesaj üret.`;

        const startWarningGen = performance.now();
        const secondTurnResponse = await generateContentWithRetry(ai, {
          model: "gemini-3.1-flash-lite",
          contents: secondTurnPrompt,
          config: {
            systemInstruction: secondTurnSystemInstruction,
            temperature: 0.8,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MEDIUM,
            },
          },
        });
        console.log(
          `[Unified Pipeline] Warning generation took: ${((performance.now() - startWarningGen) / 1000).toFixed(2)}s`,
        );

        return {
          success: true,
          message:
            secondTurnResponse.text ||
            "Ulusal tez veri tabanında benzer çalışmalar tespit edildi. Tezinizi esnetmek için yeni bir yön belirlemeliyiz.",
          structuredData: null,
          needsReview: true,
          isAcademicApproval: false,
          needsOriginalityCheck: false,
          originalityReport: report,
        };
      }

      // Case B: Risk is Low ("Düşük")
      console.log(
        `[Unified Pipeline] Low risk detected. Generating books and final closing speech.`,
      );

      const coreBooks =
        parsed.structuredData.boxes &&
        Array.isArray(parsed.structuredData.boxes)
          ? await generateCoreBooksForBoxes(
              ai,
              parsed.structuredData.boxes,
              correlationId,
              _mainTopicSummary,
            )
          : [];

      parsed.structuredData.coreBooks = coreBooks;
      parsed.structuredData.isAcademicApproval = true;

      // Second model call to generate context-aware closing speech
      const secondTurnSystemInstruction = `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın.
Öğrencinin tez kurgusunu onayladın ve arka planda ulusal tez arşivlerimizi (Tezara/YÖK Tez) tarattık. Sonuçlar son derece sevindirici: Çakışma riski DÜŞÜK çıktı.
Öğrenciye (Vedat) tez kurgusunun son derece özgün olduğunu, doğrudan bir çakışma riski olmadığını belirt. Gap analizindeki tavsiyeleri (Örn: Gramscici hegemonya ve çerçeveleme teorisini giriş bölümünde derinleştirmesi, ampirik kaynakları doğru yapılandırması vb.) içeren bilgece, teşvik edici, sıcak ve tamamen bu konuya özel bir akademik kapanış ve tebrik konuşması yap. Bu konuşma son derece akıcı, entelektüel düzeyi yüksek ve samimi olmalıdır.
ÖNEMLİ EDEBİ SINIRLAMA: Kesinlikle kahve kokusu, gözlük düzeltme, pencere ışığı gibi fiziksel ortam betimlemeleri veya edebi kurgusal tasvirler kullanma!`;

      const secondTurnPrompt = `Öğrencinin Tez Başlığı: "${parsed.structuredData.title}"
Araştırma Sorusu: "${parsed.structuredData.researchQuestion}"
Argümanı: "${parsed.structuredData.argument}"

Özgünlük Değerlendirmesi (Tezara):
Risk: ${report.risk}
Gerekçe: ${report.reasoning}
Tavsiyeler (Gap Analizi): ${report.gapAnalysis}

Lütfen bu verilere dayanarak öğrenciye hitaben sıcak ve akademik bir tebrik/kapanış konuşması üret.`;

      const startClosingSpeechGen = performance.now();
      const secondTurnResponse = await generateContentWithRetry(ai, {
        model: "gemini-3.1-flash-lite",
        contents: secondTurnPrompt,
        config: {
          systemInstruction: secondTurnSystemInstruction,
          temperature: 0.7,
        },
      });
      console.log(
        `[Unified Pipeline] Closing speech generation took: ${((performance.now() - startClosingSpeechGen) / 1000).toFixed(2)}s`,
      );

      const finalSpeech = secondTurnResponse.text || parsed.message;

      const totalDuration = performance.now() - pipelineStart;
      console.log(
        `[Onboarding Pipeline Completed] [ID: ${correlationId}] [Total Time: ${(totalDuration / 1000).toFixed(2)}s] (Unified Low-Risk Approval)`,
      );

      return {
        success: true,
        message: finalSpeech,
        structuredData: parsed.structuredData,
        needsReview: true,
        isAcademicApproval: true,
        needsOriginalityCheck: false,
        originalityReport: report,
      };
    }

    // Normal conversation turn
    const totalDuration = performance.now() - pipelineStart;
    console.log(
      `[Onboarding Pipeline Completed] [ID: ${correlationId}] [Total Time: ${(totalDuration / 1000).toFixed(2)}s] (Normal Turn)`,
    );

    return {
      success: true,
      message: parsed.message,
      structuredData: null,
      needsReview: parsed.needsReview ?? false,
      isAcademicApproval: false,
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
 * Mülakatın sonunda sentezlenen her bir box (kutu) için iki aşamalı olarak
 * "kurucu/temel" kaynak (kitap/monografi) bulur ve doğrular.
 * 1. Aşama (Üretim): gemini-3.1-flash-lite ile arama aracı kapalı, her kutu için max 1 kitap önerisi
 * 2. Aşama (Doğrulama): gemini-2.5-flash-lite + Google Search ile web'de kesin doğrulama, metadata düzeltme
 */
async function generateCoreBooksForBoxes(
  ai: GoogleGenAI,
  boxes: { name: string; description: string }[],
  correlationId: string,
  mainTopicSummary: string,
): Promise<CoreBook[]> {
  console.log(
    `[Stage 5 Core Books] [ID: ${correlationId}] Starting 2-STAGE generation+verification for ${boxes.length} box(es)...`,
  );
  if (boxes.length === 0) return [];

  const startBox = performance.now();
  const proposedBooksPool: CoreBook[] = [];

  try {
    // 1. AŞAMA (ÜRETİM): Her bir tematik kutu (box) için gemini-3.1-flash-lite modeline (arama aracı kapalı) tek tek başvurarak
    // akademik hafızasındaki en fazla 1 adet kurucu kitabı ve gerekçesini (rationale) bul. Bulamazsa zorlama.
    for (const box of boxes) {
      console.log(
        `[Stage 5 Core Books] [ID: ${correlationId}] [Phase 1 - Generation] Fetching up to 1 core book for box: "${box.name}"...`,
      );

      const generatePrompt = `Biz "${mainTopicSummary}" ana konusu üzerine bir siyaset bilimi tezi yazıyoruz.
Aşağıda detayları verilen tematik çalışma kutusu (box) için kendi akademik hafızanı kullanarak (kesinlikle Google Search yapmadan/arama aracı kapalı olarak) bu kutu özelinde literatürde en temel, klasikleşmiş, saygın ve kurucu nitelikte olan en fazla 1 adet kaynak kitabı (monografi) öner.

Kutu Bilgileri:
Kutu Adı: ${box.name}
Kutu Açıklaması: ${box.description}

Her bir kitap için şu bilgileri eksiksiz sağla:
- Kitap Adı (title)
- Yazar(lar)ı (author)
- Yayınevi (publisher) (örneğin saygın bir akademik yayınevi veya klasik yayınevi)
- Yayın Yılı (year)
- Kutuyla olan ilişkisi / gerekçesi (rationale) (en az 2-3 cümlelik akademik açıklama)

ÖNEMLİ: Bu kutu için temel bir kaynak bulamıyorsan kesinlikle zorlama ve hiç kitap önerme. Kaliteli bir eser yoksa boş dizi döndürmekten çekinme.

Yanıtını KESİNLİKLE başka hiçbir açıklama yapmadan, doğrudan istenen JSON şemasına uygun bir dizi (array) olarak döndür.`;

      try {
        const generateResponse = await generateContentWithRetry(ai, {
          model: "gemini-3.1-flash-lite",
          contents: generatePrompt,
          config: {
            temperature: 1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
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
          },
        });

        if (generateResponse.text) {
          const books: CoreBook[] = JSON.parse(generateResponse.text);
          proposedBooksPool.push(...books);
          console.log(
            `[Stage 5 Core Books] [ID: ${correlationId}] [Phase 1 - Generation] Found ${books.length} book(s) for box: "${box.name}"`,
          );
        }
      } catch (boxError) {
        console.error(
          `[Stage 5 Core Books] [ID: ${correlationId}] Error generating books for box "${box.name}":`,
          boxError,
        );
        // Bireysel kutu hatalarında genel akışı kesmemek adına devam ediyoruz.
      }
    }

    console.log(
      `[Stage 5 Core Books] [ID: ${correlationId}] [Phase 1 Completed] Generated ${proposedBooksPool.length} books in total.`,
    );

    if (proposedBooksPool.length === 0) {
      console.log(
        `[Stage 5 Core Books] [ID: ${correlationId}] Proposed books pool is empty. Skipping verification.`,
      );
      return [];
    }

    // 2. AŞAMA (GEMINI DOĞRULAMA): Her aday eseri Gemini 2.5 Flash Lite + Google Search ile
    // web'de araştırır, metadata düzeltmelerini yapar, uydurmaları eler.
    try {
      const startVerification = performance.now();
      console.log(
        `[Stage 5 Core Books] [ID: ${correlationId}] [Phase 2 - Gemini Verification] Verifying ${proposedBooksPool.length} book(s) with Gemini 2.5 Flash Lite + Google Search...`,
      );

      const verificationResults = await verifyBooksWithGemini(
        ai,
        proposedBooksPool,
      );

      const verificationDuration = performance.now() - startVerification;
      const verifiedCount = verificationResults.filter(
        (r) => r.status !== "HALLUCINATION",
      ).length;
      const hallucinationCount = verificationResults.filter(
        (r) => r.status === "HALLUCINATION",
      ).length;

      console.log(
        `[Stage 5 Core Books] [ID: ${correlationId}] [Phase 2 Completed] Gemini verification took ${(verificationDuration / 1000).toFixed(2)}s. ` +
          `Results: ${verifiedCount} verified/corrected, ${hallucinationCount} hallucinations filtered.`,
      );
      console.log(
        `[Stage 5 Core Books] [ID: ${correlationId}] Gemini Doğrulama Detayları:\n`,
        JSON.stringify(
          verificationResults.map((r) => ({
            title: r.originalTitle,
            status: r.status,
            correctedPublisher: r.correctedPublisher,
            correctedYear: r.correctedYear,
            notes: r.notes,
          })),
          null,
          2,
        ),
      );

      // HALLUCINATION olanları ele, kalanları CoreBook formatına çevir
      const verifiedBooks = verificationResults
        .filter((r) => r.status !== "HALLUCINATION")
        .map((r) => ({
          title: r.correctedTitle || r.originalTitle,
          author: r.correctedAuthor || r.originalAuthor,
          publisher: r.correctedPublisher || r.originalPublisher,
          year: r.correctedYear || r.originalYear,
          rationale: r.rationale,
        }));

      if (verifiedBooks.length === 0) {
        console.log(
          `[Stage 5 Core Books] [ID: ${correlationId}] No verified books remain after Gemini check. Returning empty array.`,
        );
        return [];
      }

      const formattedBooks = verifiedBooks.map((book) => {
        if (book.title) {
          book.title = formatBookTitle(book.title);
        }
        return book;
      });

      const boxDuration = performance.now() - startBox;
      console.log(
        `[Core Books Result] [ID: ${correlationId}] Gemini Verification Completed. ` +
          `Kept ${formattedBooks.length}/${proposedBooksPool.length} books in ${(boxDuration / 1000).toFixed(2)}s.`,
      );
      console.log(
        `[Core Books Result] [ID: ${correlationId}] Final Doğrulanmış Eserler:\n`,
        JSON.stringify(formattedBooks, null, 2),
      );
      return formattedBooks;
    } catch (chainError) {
      console.error(
        `[Stage 5 Core Books] [ID: ${correlationId}] Gemini Verification failed. Safe fallback: empty array returned. Error:`,
        chainError,
      );
      return [];
    }
  } catch (err) {
    console.error(
      `Error generating/searching books: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // General safe fallback - return empty array on failure for academic rigor
  return [];
}

export interface OriginalityAndBooksResponse {
  success: boolean;
  riskDetected: boolean;
  message?: string;
  structuredData?: OnboardingResponse["structuredData"];
  originalityReport?: OnboardingResponse["originalityReport"];
  error?: string;
}

/**
 * Server Action for Step 2 of Onboarding: Check Tezara Originality and generate Core Books
 */
export async function runOriginalityAndBooksPipelineAction(
  chatHistory: ChatMessage[],
  userResponse: string,
  structuredData: NonNullable<OnboardingResponse["structuredData"]>,
): Promise<OriginalityAndBooksResponse> {
  const correlationId = `ob-ob-${Date.now()}`;
  console.log(`[Originality Pipeline Started] [ID: ${correlationId}]`);
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        riskDetected: false,
        error: "Gemini API anahtarı bulunamadı.",
      };
    }
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    console.log(
      `[Stage 4 Tezara] [ID: ${correlationId}] Firing CONTEXT-AWARE originality check...`,
    );
    const targetPayload = JSON.stringify({
      title: structuredData.title,
      researchQuestion: structuredData.researchQuestion,
      argument: structuredData.argument,
      methodology: structuredData.methodology,
    });

    const startTezara = performance.now();
    const originalityRes = await checkTezaraOriginalityAction(targetPayload);

    if (!originalityRes.success || !originalityRes.report) {
      throw new Error(
        originalityRes.error || "Özgünlük kontrolü başarısız oldu.",
      );
    }

    const finalOriginalityReport = originalityRes.report;
    const tezaraDuration = performance.now() - startTezara;
    console.log(
      `[Tezara Result] [ID: ${correlationId}] Took: ${(tezaraDuration / 1000).toFixed(2)}s | Risk: ${finalOriginalityReport.risk}`,
    );

    const isActuallyHighRisk =
      finalOriginalityReport.risk === "Orta" ||
      finalOriginalityReport.risk === "Yüksek";

    if (isActuallyHighRisk) {
      console.log(
        `[Tezara Risk] [ID: ${correlationId}] ${finalOriginalityReport.risk} risk detected. Returning early, skipping book search.`,
      );
      return {
        success: true,
        riskDetected: true,
        originalityReport: finalOriginalityReport,
      };
    }

    // No risk detected - Proceed to search books in batch
    const firstUserMessage = chatHistory.find((m) => m.role === "user");
    const mainTopicSummary = firstUserMessage
      ? firstUserMessage.content.trim()
      : userResponse.trim();

    const coreBooks =
      structuredData.boxes && Array.isArray(structuredData.boxes)
        ? await generateCoreBooksForBoxes(
            ai,
            structuredData.boxes,
            correlationId,
            mainTopicSummary,
          )
        : [];

    const finalStructuredData = {
      ...structuredData,
      isAcademicApproval: true,
      coreBooks,
    };

    return {
      success: true,
      riskDetected: false,
      structuredData: finalStructuredData,
      originalityReport: finalOriginalityReport,
    };
  } catch (error) {
    console.error("runOriginalityAndBooksPipelineAction failed:", error);
    return {
      success: false,
      riskDetected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
