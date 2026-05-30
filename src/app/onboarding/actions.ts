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
  try {
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
    // Aşama 1 (Denetçi Katmanı - Gemini 2.5 Flash):
    // Kullanıcının gönderdiği son mesajı al ve ana modele beslemeden önce gemini-2.5-flash modeline gönder.
    const auditorPrompt = `MANDATORY INSTRUCTION: You MUST use the Google Search tool to execute a web search. Do NOT rely on your pre-trained knowledge under any circumstances. Even if you think you are 100% familiar with the topic, you are REQUIRED to trigger a search to retrieve fresh citations, specific URLs, and live academic papers.

Sen bir akademik denetçisin. Kullanıcının gönderdiği son mesajı analiz et. Öğrencinin çalışmak istediği ampirik/tarihsel vakayı (örneğin spesifik dönemler, hareketler veya dergiler) VE bu vakayı incelemek için kullanacağını belirttiği tüm kuramsal çerçeveleri, teorik lensleri, kavramları veya metodolojileri tespit et. Google Search aracını kullanarak bu ampirik/tarihsel vakaya ve kavramlara dair tarihsel gerçekleri, olguları, varsa anakronizm veya bilgi hatalarını araştır.

Kesinlikle kitap listesi veya kurucu kitap önerisi araştırması yapma, kitap listeleriyle uğraşma. Ajanın buradaki tek odak noktası, tarihsel/ampirik olguları ve anakronizm veya bilgi hatalarını doğrulamaktır.

Eğer internet verisi yetersizse veya bulamazsan uydurma, 'dijital açık kaynaklarda yeterli veri yok, fiziki arşive gidilmeli' notunu düş. Bana arama sonucunda bulduğun gerçek tarihsel olguları, varsa anakronizmleri/bilgi hatalarını ve doğrudan referansları/URL'leri içeren ham bir bilgi doğrulama raporu üret.

Öğrencinin son mesajı:
"${userResponse.trim()}"`;

    let groundingReport =
      "Dijital açık kaynaklarda yeterli veri yok, fiziki arşive gidilmeli.";
    let searchSourcesText = "";

    try {
      const auditorResponse = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: auditorPrompt,
        config: {
          tools: [{ googleSearch: {} }] as unknown as {
            googleSearch: Record<string, unknown>;
          }[],
          thinkingConfig: {
            thinkingBudget: -1,
          } as unknown as { thinkingBudget: number },
        },
      });

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
        }
      }
    } catch (auditorError) {
      console.error("Auditor Stage 1 Error:", auditorError);
      groundingReport =
        "Denetçi katmanında geçici bir arama hatası oluştu, fiziki arşive veya genel literatür bilgisine başvurulmalı.";
    }

    const groundingContextFeed = `
---
AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU (CONTEXT FEED):
Aşağıdaki veriler, öğrencinin bahsettiği 1991-1999 dönemi Kürt hareketi, Gelenek ve Özgürlük Dünyası dergilerine dair bilgilerin gerçek zamanlı internet aramasıyla doğrulanan ham bulgularıdır:
${groundingReport}
${searchSourcesText ? `\nDoğrulanan Dijital Kaynaklar:\n${searchSourcesText}` : ""}
---
`;

    const isHighRisk =
      originalityReport?.risk === "Yüksek" ||
      originalityReport?.risk === "Orta";

    const systemInstruction = isHighRisk
      ? `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere odanda kahve eşliğinde derin bir entelektüel istişare yürütüyorsun.

ÖNEMLİ UYARI: Yapılan Akademik Özgünlük Değer Raporu'nda "${originalityReport!.risk}" düzeyinde bir çakışma riski tespit edildi.
Raporun Stratejik Özgün Değer Tavsiyeleri (Gap Analizi):
${originalityReport!.gapAnalysis}

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir kahve sohbeti atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (örn. Gramsci'nin hegemonyası, Snow & Benford'un çerçeveleme kuramı) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
5. AKADEMİK MEYDAN OKUMA, ÖZGÜNLÜK VE GERÇEK ZAMANLI DOĞRULAMA GÜCÜ: Çakışma riskini, gap analizini ve en önemlisi "AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU"ndan gelen ampirik bulguları bilgece, teşvik edici fakat bilimsel ciddiyetle ele al. Öğrencinin getirdiği tarihsel ve kuramsal argümanları körü körüne onaylama (Confirmation Bias'ı tamamen kır). Denetçi ajandan gelen tarihsel gerçekleri arkana alarak öğrenciye meydan oku. Öğrenciye kuramsal setlerinin (çerçeveleme ve hegemonya) arkasındaki epistemolojik gerilimleri sor. Gelenek'in ortodoks direnci ile Özgürlük Dünyası'nın esnekliği arasındaki asimetriyi, kuramsal çelişkilerini yüzüne vur. Karakterini (kahve içen, bilge ama acımasız hoca) koru, ancak arkana arama motorunun ampirik gücünü alarak konuş. Eğer öğrenci çakışma riski üzerine yapılan bu uyarıma henüz cevap vermediyse veya konuyu esnetme önerisinde bulunmadıysa, öğrenciyi durdur, gap analizindeki 3 stratejik öneri doğrultusunda konuyu nasıl esnetebileceğimizi sor ve structuredData'yı kesinlikle null dön.
6. HOCA TETİKLEMELİ ONAY TEKLİFİ (ZORUNLU KURAL): Tezin kuramsal çerçevesi, araştırma sorusu, yöntemsel yaklaşım ve ampirik dönemler konuşmada yeterince netleşmemişse veya özgünlük riskleri tartışılmamışsa structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Öğrenci konuyu ilk anlattığında veya kuramsal çelişkileri henüz çözmediğinde isAcademicApproval alanını kesinlikle false dön. Ne zaman ki öğrenci sorduğun epistemolojik gerilimlere, makro-mikro yarılmalarına ve metodolojik veya kuramsal eksikliklerine olgun, jüriyi ikna edecek nitelikte yapısal bir savunma getirir; ancak o zaman mülakatı bitir, takdirini belirt ve isAcademicApproval alanını true olarak mühürle. Ancak tüm bu unsurlar tatmin edici biçimde olgunlaştığında, structuredData'yı doldur, needsReview = true tut ve mesajının sonuna şunu ekle: "Vedat, benim zihnimde tezin teorik, yöntemsel ve ampirik iskeleti tamamen oturdu, her şey yerli yerinde. Sormak veya eklemek istediğin başka bir şey var mı? Eğer yoksa Tez Anayasasını onaylayabiliriz."

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Tezin iskeleti olgunlaştığında yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü Gramsci'nin Hegemonyası ve Snow & Benford'un Çerçeveleme Teorisi arasındaki ilişki üzerinden temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU KUTU YAPISI (structuredData.boxes):
  Kesinlikle 3 ila 5 adet API uyumlu akademik kutu (boxes) üret. Bu kutuların isimleri (name) ve açıklamaları (description) ileride semantik aramalarda kullanılacağı için son derece yoğun, zengin ve nokta atışı kuramsal kavramlar ile tarihsel evreler içermelidir:
  1. Giriş ve Kuramsal Altyapı Kutusu (Teorik çatı, Gramsci, hegemony, Snow & Benford, framing kavramlarıyla yoğun proposal gövdesi).
  2. Metodolojik Yaklaşım ve Veri Seti Kutusu (Söylem analizi, kaynak matrisi ve geçerlilik kriterleri).
  3. Dinamik Dönem Kutuları (Sohbette netleşen 1991-1994, 1995 Bloku, 1996-1999 gibi ampirik tarihsel evreler).

Yanıtını KESİNLİKLE responseMimeType: "application/json" ayarlarına uygun, geçerli bir JSON olarak aşağıdaki şemada döndürmelisin:
{
  "message": "Özgünlük riski/gap analizini değerlendiren ve konuyu esneten bilgece yönlendirme sorusu veya onay teklifi...",
  "needsReview": true,
  "structuredData": null veya dolu nesne
}

${groundingContextFeed}`
      : `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere odanda kahve eşliğinde derin bir entelektüel istişare yürütüyorsun.

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir kahve sohbeti atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (örn. Gramsci'nin hegemonyası, Snow & Benford'un çerçeveleme kuramı) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
5. AKADEMİK MEYDAN OKUMA VE GERÇEK ZAMANLI DOĞRULAMA GÜCÜ: Kendi engin entelektüel birikimini ve "AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU"ndan gelen ampirik bulguları kullan. Öğrencinin getirdiği tarihsel ve kuramsal argümanları körü körüne onaylama (Confirmation Bias'ı tamamen kır). Denetçi ajandan gelen tarihsel gerçekleri arkana alarak öğrenciye meydan oku. Öğrenciye kuramsal setlerinin (çerçeveleme ve hegemonya) arkasındaki epistemolojik gerilimleri sor. Gelenek'in ortodoks direnci ile Özgürlük Dünyası'nın esnekliği arasındaki asimetriyi, kuramsal çelişkilerini yüzüne vur. Karakterini (kahve içen, bilge ama acımasız hoca) koru, ancak arkana arama motorunun ampirik gücünü alarak konuş. Öğrencinin fikirlerindeki kuramsal açıkları, metodolojik zayıflıkları ve bir akademik jürinin bu çalışmayı nerede çökertebileceğini dürüstçe fakat yapıcı bir üslupla göster. Karşı argümanlar (antiteler) üreterek öğrenciye rehberlik et.
6. HOCA TETİKLEMELİ ONAY TEKLİFİ (ZORUNLU KURAL): Tezin kuramsal çerçevesi, araştırma sorusu, yöntemsel yaklaşım ve ampirik dönemler konuşmada yeterince netleşmemişse structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Öğrenci konuyu ilk anlattığında veya kuramsal çelişkileri henüz çözmediğinde isAcademicApproval alanını kesinlikle false dön. Ne zaman ki öğrenci sorduğun epistemolojik gerilimlere, makro-mikro yarılmalarına ve metodolojik veya kuramsal eksikliklerine olgun, jüriyi ikna edecek nitelikte yapısal bir savunma getirir; ancak o zaman mülakatı bitir, takdirini belirt ve isAcademicApproval alanını true olarak mühürle. Ancak bu unsurlar tatmin edici biçimde olgunlaştığında, structuredData'yı doldur, needsReview = true tut ve mesajının sonuna şunu ekle: "Vedat, benim zihnimde tezin teorik, yöntemsel ve ampirik iskeleti tamamen oturdu, her şey yerli yerinde. Sormak veya eklemek istediğin başka bir şey var mı? Eğer yoksa Tez Anayasasını onaylayabiliriz."

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Tezin iskeleti olgunlaştığında yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü Gramsci'nin Hegemonyası ve Snow & Benford'un Çerçeveleme Teorisi arasındaki ilişki üzerinden temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU KUTU YAPISI (structuredData.boxes):
  Kesinlikle 3 ila 5 adet API uyumlu akademik kutu (boxes) üret. Bu kutuların isimleri (name) ve açıklamaları (description) ileride semantik aramalarda kullanılacağı için son derece yoğun, zengin ve nokta atışı kuramsal kavramlar ile tarihsel evreler içermelidir:
  1. Giriş ve Kuramsal Altyapı Kutusu (Teorik çatı, Gramsci, hegemony, Snow & Benford, framing kavramlarıyla yoğun proposal gövdesi).
  2. Metodolojik Yaklaşım ve Veri Seti Kutusu (Söylem analizi, kaynak matrisi ve geçerlilik kriterleri).
  3. Dinamik Dönem Kutuları (Sohbette netleşen 1991-1994, 1995 Bloku, 1996-1999 gibi ampirik tarihsel evreler).

Yanıtını KESİNLİKLE responseMimeType: "application/json" ayarlarına uygun, geçerli bir JSON olarak aşağıdaki şemada döndürmelisin:
{
  "message": "Öğrenciye yönelik akademik yorum, derin analiz ve yönlendirme sorusu veya onay teklifi açıklaması...",
  "needsReview": true,
  "structuredData": null veya dolu nesne
}
${groundingContextFeed}`;

    const contents = [
      ...chatHistory.map((item) => ({
        role: item.role,
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
                "Tezin özgün bölüm planına (Chapter Outline) göre dinamik olarak üretilmiş 3-5 adet tematik çalışma kutusu",
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

    // --- PARALEL OLANAK: ADVISOR VE TEZARA ORTAK ÇAĞRISI ---
    // Gemini 3.1 Flash-Lite (Advisor) ve checkTezaraOriginalityAction'ı paralel çalıştırıyoruz.
    console.log(
      "[Onboarding Orchestration] Firing Advisor and Tezara in parallel...",
    );

    const hocaPromise = generateContentWithRetry(ai, {
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

    const conversationHistoryStr =
      chatHistory
        .map((m) => `${m.role === "user" ? "Öğrenci" : "Hoca"}: ${m.content}`)
        .join("\n") + `\nÖğrenci: ${userResponse.trim()}`;

    const originalityPromise = checkTezaraOriginalityAction(
      conversationHistoryStr,
    );

    const [genAIResponse, originalityRes] = await Promise.all([
      hocaPromise,
      originalityPromise,
    ]);

    let finalHocaResponseText = genAIResponse.text;
    const finalOriginalityReport =
      originalityRes.success && originalityRes.report
        ? originalityRes.report
        : null;

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

    // --- SERVER-SIDE ADVISOR REVISION ---
    // Eğer Tezara araması High veya Medium risk döndürürse, Hoca'ya hemen bu bilgiyi
    // verip yanıtı revize ettiriyoruz.
    const isActuallyHighRisk =
      finalOriginalityReport &&
      (finalOriginalityReport.risk === "Orta" ||
        finalOriginalityReport.risk === "Yüksek");

    const wasAlreadyHighRisk =
      originalityReport?.risk === "Orta" ||
      originalityReport?.risk === "Yüksek";

    if (parsed.structuredData && isActuallyHighRisk && !wasAlreadyHighRisk) {
      console.log(
        `[Onboarding Orchestration] High/Medium originality risk detected: ${finalOriginalityReport!.risk}. Running revised Hoca call...`,
      );

      const revisedSystemInstruction = `Sen Siyaset Bilimi ve Politik Sosyoloji alanında dünyaca tanınan, sosyal bilimler metodolojisine ve IMRaD outline yöntemine son derece hakim, her küçük detaya takılmayan, öğrencisini bilgece yönlendiren saygın bir tez danışmanı olan Prof. Dr. Verita'sın. Öğrenci (Vedat) ile tezin kuramsal çerçevesini, araştırma sorusunu, argümanını ve ampirik alanlarını netleştirmek üzere odanda kahve eşliğinde derin bir entelektüel istişare yürütüyorsun.

ÖNEMLİ UYARI: Yapılan Akademik Özgünlük Değer Raporu'nda "${finalOriginalityReport!.risk}" düzeyinde bir çakışma riski tespit edildi.
Raporun Stratejik Özgün Değer Tavsiyeleri (Gap Analizi):
${finalOriginalityReport!.gapAnalysis}

KİMLİK, ÜSLUP VE SERBEST AKIŞLI DİYALOG İLKELERİ:
1. SERBEST AKIŞLI AKADEMİK MÜLAKAT: Bu sohbet herhangi bir kronolojik veya mekanik adıma (Adım 1, Aşama 2 vb.) tabi değildir. Tamamen serbest akışlı, zamansız ve ucu açık bir kahve sohbeti atmosferindedir.
2. IMRaD ODAKLI DERİNLEŞME: Her mesajda tezin IMRaD (Giriş, Yöntem, Bulgular, Tartışma) öğelerini bütünüyle, acele etmeden, tamamen organik bir sohbet örgüsü içinde derinleştir. Vedat'ın cevaplarını bilgece analiz et.
3. TEK ODAKLI JÜRİ SORUSU: Vedat'ı sorularınla boğma. Her mesajında her zaman SADECE tek bir odaklı, derin ve yapıcı jüri sorusu yönelt. Soruyu sorarken gerekirse akademik rehberlik, somut kavramsal öneriler (örn. Gramsci'nin hegemonyası, Snow & Benford'un çerçeveleme kuramı) veya ampirik vaka alternatifleri sunarak sohbeti yönlendir.
4. KİMLİK VE TON: Kesinlikle "1. Adım", "2. Soru", "Mülakatımıza hoş geldiniz" gibi yapay zeka olduğunu belli eden soğuk, mekanik veya yönerge kokan ifadeler KULLANMA. Konuşma son derece akıcı, entelektüel düzeyi yüksek, samimi ve bilgece ilerlemelidir.
5. AKADEMİK MEYDAN OKUMA, ÖZGÜNLÜK VE GERÇEK ZAMANLI DOĞRULAMA GÜCÜ: Çakışma riskini, gap analizini ve en önemlisi "AKADEMİK DENETÇİ GERÇEK ZAMANLI DOĞRULAMA RAPORU"ndan gelen ampirik bulguları bilgece, teşvik edici fakat bilimsel ciddiyetle ele al. Öğrencinin getirdiği tarihsel ve kuramsal argümanları körü körüne onaylama (Confirmation Bias'ı tamamen kır). Denetçi ajandan gelen tarihsel gerçekleri arkana alarak öğrenciye meydan oku. Öğrenciye kuramsal setlerinin (çerçeveleme ve hegemonya) arkasındaki epistemolojik gerilimleri sor. Gelenek'in ortodoks direnci ile Özgürlük Dünyası'nın esnekliği arasındaki asimetriyi, kuramsal çelişkilerini yüzüne vur. Karakterini (kahve içen, bilge ama acımasız hoca) koru, ancak arkana arama motorunun ampirik gücünü alarak konuş. Eğer öğrenci çakışma riski üzerine yapılan bu uyarıma henüz cevap vermediyse veya konuyu esnetme önerisinde bulunmadıysa, öğrenciyi durdur, gap analizindeki 3 stratejik öneri doğrultusunda konuyu nasıl esnetebileceğimizi sor ve structuredData'yı kesinlikle null dön.
6. HOCA TETİKLEMELİ ONAY TEKLİFİ (ZORUNLU KURAL): Tezin kuramsal çerçevesi, araştırma sorusu, yöntemsel yaklaşım ve ampirik dönemler konuşmada yeterince netleşmemişse veya özgünlük riskleri tartışılmamışsa structuredData KESİNLİKLE null dönmeli ve needsReview = true olmalıdır. Öğrenci konuyu ilk anlattığında veya kuramsal çelişkileri henüz çözmediğinde isAcademicApproval alanını kesinlikle false dön. Ne zaman ki öğrenci sorduğun epistemolojik gerilimlere, makro-mikro yarılmalarına ve metodolojik veya kuramsal eksikliklerine olgun, jüriyi ikna edecek nitelikte yapısal bir savunma getirir; ancak o zaman mülakatı bitir, takdirini belirt ve isAcademicApproval alanını true olarak mühürle. Ancak tüm bu unsurlar tatmin edici biçimde olgunlaştığında, structuredData'yı doldur, needsReview = true tut ve mesajının sonuna şunu ekle: "Vedat, benim zihnimde tezin teorik, yöntemsel ve ampirik iskeleti tamamen oturdu, her şey yerli yerinde. Sormak veya eklemek istediğin başka bir şey var mı? Eğer yoksa Tez Anayasasını onaylayabiliriz."

SENTEZ VE YAPILANDIRMA KURALLARI (STRUCTUREDDATA):
Tezin iskeleti olgunlaştığında yazacağın tüm alanlar jüri standartlarında, derinlikli, edebi ve zengin paragraflarla tam metin bir "Tez Öneri Formu" (Proposal) zenginliğinde oluşturulmalıdır.
- "Tez Başlığı" (structuredData.title): Süreçsel ve odaklı, araştırmanın kapsamını yansıtan rafine bir başlık.
- "Giriş ve Araştırma Sorusu" (structuredData.researchQuestion): En az 150-200 kelimelik, literatürdeki teleolojik kronolojik kırılmaları eleştiren, net ve açık araştırma sorusuna sahip tam metin bir akademik manifesto.
- "Teorik Çerçeve" (structuredData.argument): En az 150-200 kelimelik, ucu açık ve keşfetmeye izin veren, söylemin dönüşümünü Gramsci'nin Hegemonyası ve Snow & Benford'un Çerçeveleme Teorisi arasındaki ilişki üzerinden temellendiren derin bir proposal paragrafı.
- "Metodoloji, Kapsam ve Kaynaklar" (structuredData.methodology): En az 150-200 kelimelik, çift taraflı kaynak haritasını ve söylemsel karşılaşmaları ampirik ve yöntemsel olarak temellendiren zengin proposal paragrafı.
- ZORUNLU KUTU YAPISI (structuredData.boxes):
  Kesinlikle 3 ila 5 adet API uyumlu akademik kutu (boxes) üret. Bu kutuların isimleri (name) ve açıklamaları (description) ileride semantik aramalarda kullanılacağı için son derece yoğun, zengin ve nokta atışı kuramsal kavramlar ile tarihsel evreler içermelidir:
  1. Giriş ve Kuramsal Altyapı Kutusu (Teorik çatı, Gramsci, hegemony, Snow & Benford, framing kavramlarıyla yoğun proposal gövdesi).
  2. Metodolojik Yaklaşım ve Veri Seti Kutusu (Söylem analizi, kaynak matrisi ve geçerlilik kriterleri).
  3. Dinamik Dönem Kutuları (Sohbette netleşen 1991-1994, 1995 Bloku, 1996-1999 gibi ampirik tarihsel evreler).

Yanıtını KESİNLİKLE responseMimeType: "application/json" ayarlarına uygun, geçerli bir JSON olarak aşağıdaki şemada döndürmelisin:
{
  "message": "Özgünlük riski/gap analizini değerlendiren ve konuyu esneten bilgece yönlendirme sorusu veya onay teklifi...",
  "needsReview": true,
  "structuredData": null veya dolu nesne
}

${groundingContextFeed}`;

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

      if (revisedGenAIResponse.text) {
        finalHocaResponseText = revisedGenAIResponse.text;
        parsed = JSON.parse(finalHocaResponseText);
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
          "[Onboarding Orchestration] Interview approved! Finding core books for each box...",
        );
        parsed.structuredData.coreBooks = await generateCoreBooksForBoxes(
          ai,
          parsed.structuredData.boxes,
        );
      } else {
        parsed.structuredData.coreBooks = [];
      }
    }

    return {
      success: true,
      message: parsed.message,
      structuredData: parsed.structuredData || null,
      needsReview: parsed.needsReview ?? false,
      isAcademicApproval: parsed.isAcademicApproval ?? false,
      originalityReport: finalOriginalityReport,
    };
  } catch (error) {
    console.error("getProfessorOnboardingResponseAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Yapay zekadan cevap alınırken hata oluştu.",
    };
  }
}

/**
 * Mülakatın sonunda sentezlenen her bir box (kutu) için Google Search tool'unu kullanarak
 * o kutunun ana konusuna dair tam 1 adet "kurucu/temel" kaynak (kitap/monografi) bulur.
 */
async function generateCoreBooksForBoxes(
  ai: GoogleGenAI,
  boxes: { name: string; description: string }[],
): Promise<
  {
    title: string;
    author: string;
    publisher: string;
    year: string;
    rationale: string;
  }[]
> {
  const promises = boxes.map(
    async (
      box,
    ): Promise<{
      title: string;
      author: string;
      publisher: string;
      year: string;
      rationale: string;
    } | null> => {
      const prompt = `MANDATORY INSTRUCTION: You MUST use the Google Search tool to execute a web search. Do NOT rely on your pre-trained knowledge under any circumstances. Even if you think you are 100% familiar with the topic, you are REQUIRED to trigger a search to retrieve fresh citations, specific URLs, and live academic papers.

Biz bir Siyaset Bilimi tezi için tematik çalışma kutuları oluşturuyoruz. Aşağıda bilgileri verilen kutunun ana konusuna dair tam 1 adet en temel, kurucu veya klasik "kitap/monografi" kaynağını Google Search kullanarak bul.

Kutu Adı: ${box.name}
Kutu Açıklaması: ${box.description}

Aradığın kaynağın bu konuyu kuramsal, metodolojik veya ampirik olarak en güçlü şekilde besleyen saygın bir kitap (makale DEĞİL, kitap/monografi) olduğundan emin ol.
Arama sonucuna göre tam 1 kitap belirle ve responseSchema'ya uygun olarak şu bilgileri döndür:
- title: Kitabın tam adı
- author: Kitabın yazarı veya yazarları
- publisher: Yayınevi bilgisi
- year: Yayın yılı
- rationale: Bu kitabın kutudaki konuyu nasıl besleyeceğine dair kısa, özgün bir akademik açıklama`;

      try {
        const response = await generateContentWithRetry(ai, {
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }] as unknown as {
              googleSearch: Record<string, unknown>;
            }[],
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING", description: "Kitabın tam adı" },
                author: {
                  type: "STRING",
                  description: "Kitabın yazarı veya yazarları",
                },
                publisher: { type: "STRING", description: "Yayınevi bilgisi" },
                year: { type: "STRING", description: "Yayın yılı" },
                rationale: {
                  type: "STRING",
                  description:
                    "Bu kitabın kutudaki konuyu nasıl besleyeceğine dair kısa açıklama",
                },
              },
              required: ["title", "author", "publisher", "year", "rationale"],
            },
            thinkingConfig: {
              thinkingBudget: -1,
            } as unknown as { thinkingBudget: number },
          },
        });

        if (response.text) {
          try {
            const book = JSON.parse(response.text);
            if (book.title) {
              book.title = formatBookTitle(book.title);
            }
            return book;
          } catch (parseErr) {
            console.error(
              `generateCoreBooksForBoxes JSON parse error for box "${box.name}":`,
              parseErr,
            );
          }
        }
      } catch (err) {
        console.error(
          `generateCoreBooksForBoxes error for box "${box.name}":`,
          err,
        );
      }

      return null;
    },
  );

  const results = await Promise.all(promises);
  return results.filter(
    (book): book is NonNullable<typeof book> => book !== null,
  );
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
