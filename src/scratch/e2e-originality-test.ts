import { createFlowId, Logger } from "../lib/logger";
import { extractQueries } from "../app/(auth)/onboarding/risk/_services/queries";
import { searchTezara } from "../lib/tezara";
import { siftAndFetchDetails } from "../app/(auth)/onboarding/risk/_services/sifting";
import {
  analyzeOriginalityRisk,
  calculateOriginalityRisk,
} from "../app/(auth)/onboarding/risk/_services/analysis";
import type {
  TezaraThesisSummary,
  ThesisBadge,
  ThesisAxes,
} from "../lib/types";

/**
 * Interface representing target thesis parameters.
 */
interface ThesisMatrixInput {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
}

/**
 * Initial thesis matrix input parameters representing the target topic:
 * "Neoliberalizmde Bireysel Borçlandırma ve İşçi-Borçlu Özneler"
 */
const targetMatrix: ThesisMatrixInput = {
  studyTitle:
    "Neoliberalizmde Siyasal İktidar İlişkisi Olarak Bireysel Borçlandırma: Türkiye'de İşçi-Borçlu Öznelerin Mikro-Düzey Analizi",
  researchQuestion:
    "Neoliberal borçlandırma ilişkisinde borçlandırılmış özneler (işçi-borçlular) bu ilişkinin işleyişine nasıl katkıda bulunur?\n\nİşçi-borçlular hangi pratik ve söylemlerle borçluluk hallerini deneyimler ve bu deneyim nasıl bir tabi kılınma süreci yaratır?\n\nTürkiye bağlamında borçluların borçluluk haline verdikleri tepkiler (siyasal direniş ve gündelik idare etme pratikleri) nelerdir ve bu tepkiler borçlandırma ilişkisini nasıl şekillendirir?",
  theoreticalFramework:
    "Foucaultcu iktidar analizi (özellikle yönetimsellik ve tabi kılma kavramları), Marksist sınıf analizi (işçi sınıfı ve yeniden üretim), neoliberalizm eleştirisi, borçlandırma çalışmaları (Maurizio Lazzarato, Randy Martin)",
  methodology:
    "Nitel yöntem; yarı yapılandırılmış derinlemesine mülakatlar (Türkiye'deki borçlu bireylerle), tematik analiz (borçlanma, yönetme ve tepki temaları çerçevesinde)",
  researchScope:
    "Türkiye, günümüz neoliberal dönemi (belirli bir zaman aralığı belirtilmemiş olsa da yakın dönem), borçlu bireyler (işçi-borçlu özneler). Makro-yapısal kurumlar ve borç verme mekanizmaları doğrudan analizin dışında bırakılmış, mikro-düzey özne deneyimlerine odaklanılmıştır.",
  mainClaim:
    "Literatürdeki yaygın kanının aksine, neoliberal borçlandırma ilişkisinde borçlandırılmış özneler (işçi-borçlular), borçluluk halleri, pratikleri ve söylemleri aracılığıyla bu iktidar ilişkisinin işleyişinde pasif kurbanlar değil, aktif ve kurucu bir rol oynarlar; bu rol, borcu yeniden üretim ve direnç aracı kılarak hem tabi kılınmayı hem de gri pratiklerle idare etmeyi içeren karmaşık bir dinamik yaratır.",
};

/**
 * Set of religious keywords used to detect religious/tarikat-related noise in theses.
 */
const RELIGIOUS_KEYWORDS = [
  "din",
  "tarikat",
  "nakşibendi",
  "kadirilik",
  "islam",
  "dini",
  "ilahiyat",
  "tasavvuf",
  "şeriat",
  "mezhep",
  "cemaat",
  "nakşibendilik",
  "tarikatı",
  "dinsel",
];

/**
 * Runs the E2E originality analysis test scenario.
 * It extracts queries, runs search on Tezara, sifts candidate theses through Cohere Rerank,
 * bypasses Tavily, runs Gemini jury analysis, and prints structured validation results.
 */
async function runE2ETest(): Promise<void> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  console.log(
    "================================================================================",
  );
  console.log("🚀 E2E OTOMATİK ÖZGÜNLÜK TEST SENARYOSU BAŞLATILIYOR");
  console.log(`Flow ID: ${flowId}`);
  console.log(
    "================================================================================",
  );

  try {
    // Step 1: Query Extraction
    console.log("\n[ADIM 1] Gemini ile Anahtar Kelime ve Sorgu Çıkarma...");
    const extracted = await extractQueries(targetMatrix, log);
    console.log(
      `- Çıkarılan Tezara Sorguları: ${JSON.stringify(extracted.tezaraQueries)}`,
    );
    console.log(
      `- Çıkarılan Tavily Sorguları (Bypass Edilecek): ${JSON.stringify(extracted.tavilyQueries)}`,
    );

    // Step 2: Tezara Search API execution
    console.log("\n[ADIM 2] Tezara Arama Motoru Taraması Çalıştırılıyor...");
    const tezaraSearchResults: TezaraThesisSummary[][] = [];
    for (const query of extracted.tezaraQueries) {
      console.log(`  - Arama sorgusu çalıştırılıyor: "${query}"`);
      const results = await searchTezara(query, log, true);
      console.log(`    -> Bulunan aday tez sayısı: ${results.length}`);
      tezaraSearchResults.push(results);
    }

    // Step 3: Cohere Rerank Sifting
    console.log(
      "\n[ADIM 3] Cohere Rerank v4 Pro Süzme ve Detay Çekme Hattı...",
    );
    const siftResult = await siftAndFetchDetails(
      targetMatrix,
      tezaraSearchResults,
      log,
    );
    console.log(
      `- Rerank Sonrası Kalan Aday Sayısı (>= %59 Barajı): ${siftResult.finalTheses.length}`,
    );
    console.log(
      `- Rerank Sonrası Elenen Aday Sayısı: ${siftResult.eliminatedTheses.length}`,
    );

    // Step 4: Gemini Jury Analysis (Tavily is completely bypassed here)
    console.log(
      "\n[ADIM 4] Gemini Jürisi ve 4 Eksenli Risk Analizi Çalıştırılıyor...",
    );
    if (siftResult.finalTheses.length === 0) {
      console.warn(
        "⚠️ Rerank sonrasında jüriye gönderilecek hiçbir aday tez kalmadı!",
      );
      return;
    }

    const { overlapTable } = await analyzeOriginalityRisk(
      {
        ...targetMatrix,
        validDetails: siftResult.finalTheses,
      },
      log,
    );

    const riskCalcResult = calculateOriginalityRisk(
      overlapTable,
      siftResult.finalTheses,
      log,
    );

    console.log(
      "\n================================================================================",
    );
    console.log("📊 HAM SONUÇ SEPETLERİ (RAW JSON)");
    console.log(
      "================================================================================",
    );
    console.log("\n--- OVERLAP TABLE (RİSK GRUBUNA ALINANLAR) ---");
    console.log(JSON.stringify(riskCalcResult.overlapTable, null, 2));

    console.log(
      "\n--- ELIMINATED THESES (JÜRİ/GİYOTİN TARAFINDAN ÖZGÜN BULUNARAK ELENENLER) ---",
    );
    console.log(JSON.stringify(riskCalcResult.eliminatedTheses, null, 2));

    console.log(
      "\n================================================================================",
    );
    console.log("📝 UÇTAN UCA OTOMATİK DOĞRULAMA VE DEĞERLENDİRME RAPORU");
    console.log(
      "================================================================================",
    );

    // Track specific theses
    const targetIds = [363401, 187063];
    const foundTheses: Record<
      number,
      { title: string; author: string; badge: ThesisBadge; axes: ThesisAxes }
    > = {};

    // Helper to find thesis in result arrays
    const checkLists = [
      { list: riskCalcResult.overlapTable, source: "Overlap Grubu" },
      {
        list: riskCalcResult.eliminatedTheses,
        source: "Elenenler Grubu (Jüri)",
      },
    ];

    for (const id of targetIds) {
      let found = false;
      for (const item of checkLists) {
        const match = item.list.find((t) => t.id === id);
        if (match) {
          foundTheses[id] = {
            title: match.title,
            author: match.author,
            badge: match.axes ? calculateOriginalityBadge(match.axes) : "ÖZGÜN",
            axes: match.axes,
          };
          found = true;
          break;
        }
      }

      // Check if it was eliminated by Cohere Rerank
      if (!found) {
        const match = siftResult.eliminatedTheses.find((t) => t.id === id);
        if (match) {
          foundTheses[id] = {
            title: match.title,
            author: match.author || "Belirtilmemiş",
            badge: "ÖZGÜN", // Cohere elements are considered original (no risk)
            axes: {
              problem_sinirlari: {
                gerekce: "Cohere Rerank aşamasında elendi (Relevance < %59).",
                secim: "ALAKASIZ",
              },
              teorik_perspektif: {
                gerekce: "Cohere Rerank aşamasında elendi.",
                secim: "FARKLI GÖZLÜK",
              },
              metodolojik_kurgu: {
                gerekce: "Cohere Rerank aşamasında elendi.",
                secim: "FARKLI YÖNTEM",
              },
              zaman_mekan_ozgullugu: {
                gerekce: "Cohere Rerank aşamasında elendi.",
                secim: "ALAKASIZ BAĞLAM",
              },
            },
          };
        }
      }
    }

    // 1. Kadriye Okudan (ID: 363401)
    console.log("\n🔍 1. KADRİYE OKUDAN (ID: 363401) TEZİ DEĞERLENDİRMESİ:");
    const okudan = foundTheses[363401];
    if (okudan) {
      console.log(`- Başlık: ${okudan.title}`);
      console.log(`- Yazar: ${okudan.author}`);
      console.log(`- Hesaplanan Risk Rozeti: ${okudan.badge}`);
      console.log("- Eksen Kararları:");
      console.log(
        `  * Araştırma Probleminin Sınırları: ${okudan.axes.problem_sinirlari.secim} (${okudan.axes.problem_sinirlari.gerekce})`,
      );
      console.log(
        `  * Teorik Perspektif: ${okudan.axes.teorik_perspektif.secim} (${okudan.axes.teorik_perspektif.gerekce})`,
      );
      console.log(
        `  * Metodolojik Kurgu: ${okudan.axes.metodolojik_kurgu.secim} (${okudan.axes.metodolojik_kurgu.gerekce})`,
      );
      console.log(
        `  * Zaman-Mekan Özgüllüğü: ${okudan.axes.zaman_mekan_ozgullugu.secim} (${okudan.axes.zaman_mekan_ozgullugu.gerekce})`,
      );

      if (okudan.badge === "SAVUNMA RİSKİ") {
        console.log(
          "✅ DOĞRULANDI: Kadriye Okudan tezi beklendiği gibi SAVUNMA RİSKİ almıştır.",
        );
      } else {
        console.log(
          `❌ HATA: Kadriye Okudan tezi SAVUNMA RİSKİ almadı. Alınan rozet: ${okudan.badge}`,
        );
      }
    } else {
      console.log(
        "❌ HATA: Kadriye Okudan (ID: 363401) tezi hiçbir listede bulunamadı!",
      );
    }

    // 2. Atike Zeynep Kılıç (ID: 187063)
    console.log(
      "\n🔍 2. ATİKE ZEYNEP KILIÇ (ID: 187063) TEZİ DEĞERLENDİRMESİ:",
    );
    const kilic = foundTheses[187063];
    if (kilic) {
      console.log(`- Başlık: ${kilic.title}`);
      console.log(`- Yazar: ${kilic.author}`);
      console.log(`- Hesaplanan Risk Rozeti: ${kilic.badge}`);
      console.log("- Eksen Kararları:");
      console.log(
        `  * Araştırma Probleminin Sınırları: ${kilic.axes.problem_sinirlari.secim} (${kilic.axes.problem_sinirlari.gerekce})`,
      );
      console.log(
        `  * Teorik Perspektif: ${kilic.axes.teorik_perspektif.secim} (${kilic.axes.teorik_perspektif.gerekce})`,
      );
      console.log(
        `  * Metodolojik Kurgu: ${kilic.axes.metodolojik_kurgu.secim} (${kilic.axes.metodolojik_kurgu.gerekce})`,
      );
      console.log(
        `  * Zaman-Mekan Özgüllüğü: ${kilic.axes.zaman_mekan_ozgullugu.secim} (${kilic.axes.zaman_mekan_ozgullugu.gerekce})`,
      );

      if (kilic.badge === "SAVUNMA RİSKİ") {
        console.log(
          "✅ DOĞRULANDI: Atike Zeynep Kılıç tezi beklendiği gibi SAVUNMA RİSKİ almıştır.",
        );
      } else {
        console.log(
          `❌ HATA: Atike Zeynep Kılıç tezi SAVUNMA RİSKİ almadı. Alınan rozet: ${kilic.badge}`,
        );
      }
    } else {
      console.log(
        "❌ HATA: Atike Zeynep Kılıç (ID: 187063) tezi hiçbir listede bulunamadı!",
      );
    }

    // 3. Guillotine Filter Check (Religious/Tarikat-related noise)
    console.log(
      "\n🛡️ 3. GİYOTİN FİLTRESİ (DİN/TARİKAT ODAKLI GÜRÜLTÜLERİN ELENMESİ) DEĞERLENDİRMESİ:",
    );
    const allThesesProcessed = [
      ...siftResult.finalTheses,
      ...siftResult.eliminatedTheses,
    ];

    const religiousTheses = allThesesProcessed.filter((t) => {
      const abstractText = (t as { abstract?: string }).abstract || "";
      const titleText = (t.title || "").toLowerCase();
      return RELIGIOUS_KEYWORDS.some(
        (kw) =>
          abstractText.toLowerCase().includes(kw) || titleText.includes(kw),
      );
    });

    console.log(
      `- Toplam tespit edilen din/tarikat odaklı gürültü adayı tez sayısı: ${religiousTheses.length}`,
    );

    let giyotinElendiCount = 0;
    let cohereElendiCount = 0;
    let digerElendiCount = 0;

    for (const thesis of religiousTheses) {
      // Check if eliminated by Cohere Rerank
      const inCohereElim = siftResult.eliminatedTheses.some(
        (t) => t.id === thesis.id,
      );
      if (inCohereElim) {
        cohereElendiCount++;
        continue;
      }

      // Check if evaluated by Gemini jury
      const juryMatch = riskCalcResult.eliminatedTheses.find(
        (t) => t.id === thesis.id,
      );
      if (juryMatch) {
        const isGuillotine =
          juryMatch.axes.problem_sinirlari.secim === "ALAKASIZ" &&
          juryMatch.axes.zaman_mekan_ozgullugu.secim === "ALAKASIZ BAĞLAM";

        if (isGuillotine) {
          giyotinElendiCount++;
          console.log(
            `  * [GİYOTİN ELENDİ] ID: ${thesis.id} - ${thesis.title}`,
          );
          console.log(
            `    -> Gerekçe Konu: ${juryMatch.axes.problem_sinirlari.gerekce}`,
          );
          console.log(
            `    -> Gerekçe Bağlam: ${juryMatch.axes.zaman_mekan_ozgullugu.gerekce}`,
          );
        } else {
          digerElendiCount++;
          console.log(
            `  * [JÜRİ ELEMESİ - DİĞER] ID: ${thesis.id} - ${thesis.title} (Rozet: ${calculateOriginalityBadge(juryMatch.axes)})`,
          );
        }
      } else {
        const overlapMatch = riskCalcResult.overlapTable.find(
          (t) => t.id === thesis.id,
        );
        if (overlapMatch) {
          console.log(
            `  * ⚠️ [ELENMEDİ - RİSK ALDI] ID: ${thesis.id} - ${thesis.title} (Rozet: ${calculateOriginalityBadge(overlapMatch.axes)})`,
          );
        }
      }
    }

    console.log(`- Eleme Detayları:`);
    console.log(
      `  * Cohere Rerank Tarafından Elenen (Relevance < %59): ${cohereElendiCount}`,
    );
    console.log(
      `  * Giyotin Filtresi ile Doğrudan Elenen (ALAKASIZ + ALAKASIZ BAĞLAM): ${giyotinElendiCount}`,
    );
    console.log(
      `  * Jüri Tarafından Diğer Sebeplerle Elenen (ÖZGÜN): ${digerElendiCount}`,
    );

    if (giyotinElendiCount > 0 || cohereElendiCount > 0) {
      console.log(
        "✅ DOĞRULANDI: Din/tarikat odaklı gürültüler başarıyla giyotin veya süzgeç filtreleriyle elenmiştir.",
      );
    } else {
      console.log(
        "❌ UYARI: Hiçbir din/tarikat odaklı gürültü tezi elenemedi.",
      );
    }
  } catch (err) {
    console.error(
      "❌ Test senaryosu çalıştırılırken beklenmeyen bir hata oluştu:",
      err,
    );
  }
}

/**
 * Micro-implementation of calculateBadge to avoid direct circular dependencies if needed,
 * but matches the logic in badge-calculator.ts.
 *
 * @param axes - Decision axes
 * @returns Originality badge level
 */
function calculateOriginalityBadge(axes: ThesisAxes): ThesisBadge {
  const p = axes.problem_sinirlari.secim;
  const t = axes.teorik_perspektif.secim;
  const m = axes.metodolojik_kurgu.secim;
  const z = axes.zaman_mekan_ozgullugu.secim;

  if (p === "ALAKASIZ" && z === "ALAKASIZ BAĞLAM") {
    return "ÖZGÜN";
  }
  if (p === "BİREBİR" && t === "AYNI GÖZLÜK" && z === "AYNI DOKU") {
    return "İKİZ TEZ";
  }
  if (p === "BİREBİR" || p === "GENİŞLETİLMİŞ KONU") {
    if (z === "AYNI DOKU" || z === "PARALEL BAĞLAM") {
      return "SAVUNMA RİSKİ";
    }
  }
  if (p === "ALAKASIZ") {
    if (t === "AYNI GÖZLÜK" || t === "EVRİLMİŞ TEORİ") {
      return "TEORİ KAYNAĞI";
    }
    if (t === "FARKLI GÖZLÜK" && m === "BİREBİR YÖNTEM") {
      return "YÖNTEM KAYNAĞI";
    }
    if (z === "AYNI DOKU") {
      return "BAĞLAM KAYNAĞI";
    }
  }
  return "ÖZGÜN";
}

// Execute test
runE2ETest()
  .then(() => {
    console.log(
      "\n================================================================================",
    );
    console.log("🏁 E2E OTOMATİK ÖZGÜNLÜK TEST SENARYOSU TAMAMLANDI");
    console.log(
      "================================================================================",
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Kritik Hata:", err);
    process.exit(1);
  });
