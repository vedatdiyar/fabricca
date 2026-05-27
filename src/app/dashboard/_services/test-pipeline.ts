import * as fs from "fs";
import * as path from "path";

// Load .env.local manually for isolated script runs
try {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const index = trimmed.indexOf("=");
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
} catch (e) {
  console.warn("Failed to load .env.local:", e);
}

import { GeminiService } from "./gemini.service";
import { SemanticScholarService } from "./semanticscholar.service";
import { OpenAlexService } from "./openalex.service";
import { CandidatePaper } from "./types";

// 1. Örnek Tez Anayasası Tanımlaması
const thesisCore = {
  title:
    "Türkiye'de 2001 Sonrası Finansallaşma Sürecinde Varlık Yönetim Şirketleri",
  researchQuestion:
    "Türkiye'de 2001 krizi sonrası finansal yeniden yapılandırma sürecinde ortaya çıkan Varlık Yönetim Şirketleri (VYŞ), bankacılık sektöründeki donuk alacakların tasfiyesinde nasıl bir rol oynamıştır ve bu süreç Gramsci'nin pasif devrim kavramı ve hegemonik eklemlenme krizleri çerçevesinde nasıl kuramsallaştırılabilir?",
  argument:
    "Varlık Yönetim Şirketleri, sadece teknik bir borç tasfiye mekanizması değil, 2001 sonrası Türkiye'de finans kapital egemenliğinin tabana yayılması ve borç ilişkilerinin hukuki/baskıcı yollarla yeniden üretilmesini sağlayan hegemonik birer aygıttır. Bu şirketler, donuk alacakları finansallaştırarak borçluları finansal sisteme zorla eklemler ve böylece krizlerin toplumsal maliyetini bireyselleştirerek hegemonik rıza üretimini ve pasif devrim sürecini tamamlar.",
  methodology:
    "Çalışmada, 2001-2024 yılları arasında Türkiye'deki Varlık Yönetim Şirketlerinin donuk alacak portföy büyüklükleri ve BDDK verileri niceliksel olarak incelenecektir. Bu nicel veriler, borç tasfiye süreçlerinin söylemsel ve hukuki boyutunu açığa çıkarmak amacıyla, borç yapılandırma sözleşmeleri ve VYŞ temsilcilerinin söylemleri üzerinde Gramsciyen eleştirel söylem analizi ve nitel hegemonik eklemlenme analizine tabi tutulacaktır.",
};

// 2. Örnek Tematik Çalışma Kutusu
const boxes = [
  {
    id: 1,
    name: "Hegemonya ve Söylem Teorisi",
    description:
      "Gramsci ve Laclau-Mouffe hegemonya teorisinin Türkiye'deki finansallaşma sürecinin eklemlenme krizlerini açıklamada kullanımı.",
  },
];

async function runTestPipeline() {
  console.log(
    "================================================================================",
  );
  console.log(
    "🚀 FABRICCA LİTERATÜR TARAMA PİPELİNE İZOLE TEST RUNNER BAŞLATILDI",
  );
  console.log(
    "================================================================================",
  );
  console.log(`Tez Başlığı: ${thesisCore.title}`);
  console.log(`Çalışma Kutusu: ${boxes[0].name}`);
  console.log(
    "--------------------------------------------------------------------------------",
  );

  const startTime = Date.now();
  const performanceLogs: Record<string, number> = {};

  // ADIM 1: GeminiService.extractAcademicQueriesPerBox ile Sorguların Çıkarılması
  console.log("\n[ADIM 1] Akademik Arama Terimleri Çıkarılıyor (Gemini)...");
  const step1Start = Date.now();

  const extractedQueries = await GeminiService.extractAcademicQueriesPerBox(
    thesisCore.title,
    thesisCore.researchQuestion,
    thesisCore.argument,
    thesisCore.methodology,
    boxes,
  );

  const step1Duration = Date.now() - step1Start;
  performanceLogs["Step 1: Extract Queries (Gemini)"] = step1Duration;

  console.log(">>> Gemini Tarafından Üretilen Arama Terimleri:");
  console.log(JSON.stringify(extractedQueries, null, 2));

  if (!extractedQueries || extractedQueries.length === 0) {
    throw new Error("Sorgu çıkarma başarısız oldu.");
  }

  const englishQueries = extractedQueries[0].englishQueries;
  const turkishQueries = extractedQueries[0].turkishQueries;
  console.log(
    `\nBulunan İngilizce Arama Sorguları: [${englishQueries.join(" | ")}]`,
  );
  console.log(
    `Bulunan Türkçe Arama Sorguları: [${turkishQueries.join(" | ")}]`,
  );

  // ADIM 2: Semantic Scholar ve OpenAlex API Çağrıları
  console.log("\n[ADIM 2] API'lerden Canlı Makale Taraması Başlatılıyor...");

  // A. Semantic Scholar
  console.log("\n  -> A. Semantic Scholar Taraması Tetikleniyor...");
  const s2Start = Date.now();
  const s2Papers = await SemanticScholarService.fetchSemanticScholarPapers(
    englishQueries,
    5,
    "citationCount",
  );
  const s2Duration = Date.now() - s2Start;
  performanceLogs["Step 2.A: Semantic Scholar Fetch"] = s2Duration;
  console.log(`  [Semantic Scholar] ${s2Papers.length} adet makale döndü.`);

  // B. OpenAlex
  console.log("\n  -> B. OpenAlex (TR ve EN) Taraması Tetikleniyor...");
  const oaStart = Date.now();
  const openAlexPapers: CandidatePaper[] = [];

  for (const query of englishQueries) {
    console.log(`     - Sorgu: "${query}" (EN Kanalı)...`);
    const enRes = await OpenAlexService.fetchOpenAlexPapers(query, "en", 5);
    console.log(`     - Sonuç: ${enRes.length} makale.`);
    openAlexPapers.push(...enRes);
    await new Promise((r) => setTimeout(r, 1200));
  }

  for (const query of turkishQueries) {
    console.log(`     - Sorgu: "${query}" (TR Kanalı)...`);
    const trRes = await OpenAlexService.fetchOpenAlexPapers(query, "tr", 5);
    console.log(`     - Sonuç: ${trRes.length} makale.`);
    openAlexPapers.push(...trRes);
    await new Promise((r) => setTimeout(r, 1200));
  }
  const oaDuration = Date.now() - oaStart;
  performanceLogs["Step 2.B: OpenAlex Fetch"] = oaDuration;
  console.log(
    `  [OpenAlex] Toplam ${openAlexPapers.length} adet makale toplandı (tekilleştirme öncesi).`,
  );

  // ADIM 3: Havuz Birleştirme, İstatistikler ve Tekilleştirme (Deduplication)
  console.log(
    "\n[ADIM 3] Havuz Birleştiriliyor ve Tekilleştirme Uygulanıyor...",
  );
  const step3Start = Date.now();

  const combinedPapers = [...s2Papers, ...openAlexPapers];
  const s2RawCount = s2Papers.length;
  const oaRawCount = openAlexPapers.length;
  const totalRawCount = combinedPapers.length;

  // Özetleri (abstract) çözülen makale adedi
  const resolvedAbstractCount = combinedPapers.filter(
    (p) => p.abstract && p.abstract.trim().length > 0,
  ).length;

  // Tekilleştirme işlemi (paperId ve normalize edilmiş başlık üzerinden)
  const uniquePapersMap = new Map<string, CandidatePaper>();
  for (const paper of combinedPapers) {
    const key = (paper.paperId || paper.title).toLowerCase().trim();
    if (uniquePapersMap.has(key)) {
      const existing = uniquePapersMap.get(key)!;
      // Eğer mevcut olanın abstract'ı boş ama gelenin dolu ise güncelle
      if (
        (!existing.abstract || existing.abstract.trim().length === 0) &&
        paper.abstract &&
        paper.abstract.trim().length > 0
      ) {
        uniquePapersMap.set(key, paper);
      }
    } else {
      uniquePapersMap.set(key, paper);
    }
  }

  const uniquePapers = Array.from(uniquePapersMap.values());
  const finalPoolSize = uniquePapers.length;
  const step3Duration = Date.now() - step3Start;
  performanceLogs["Step 3: Deduplication & Pool Assembly"] = step3Duration;

  console.log(">>> Havuz İstatistikleri:");
  console.log(`    - Semantic Scholar Ham Sayı: ${s2RawCount}`);
  console.log(`    - OpenAlex Ham Sayı        : ${oaRawCount}`);
  console.log(`    - Toplam Ham Sayı          : ${totalRawCount}`);
  console.log(
    `    - Özeti Çözülen Makaleler  : ${resolvedAbstractCount} / ${totalRawCount}`,
  );
  console.log(`    - Tekilleştirme Sonrası    : ${finalPoolSize}`);

  // ADIM 4: GeminiService.runAcademicJury ile Akademik Jüri Değerlendirmesi
  console.log(
    "\n[ADIM 4] Akademik Jüri (Gemini 3.1 Flash Lite) Değerlendirmesi Yapılıyor...",
  );
  const step4Start = Date.now();

  const juryRecommendations = await GeminiService.runAcademicJury(
    thesisCore.title,
    thesisCore.researchQuestion,
    thesisCore.argument,
    thesisCore.methodology,
    uniquePapers,
    false, // isNewDiscovery = false (En iyi 6 makaleyi seçmesini istiyoruz)
  );

  const step4Duration = Date.now() - step4Start;
  performanceLogs["Step 4: Academic Jury (Gemini)"] = step4Duration;

  const totalDuration = Date.now() - startTime;
  performanceLogs["Total Execution Time"] = totalDuration;

  console.log("\n>>> Jüri Tarafından Seçilen En İyi 6 Makale ve Gerekçeleri:");
  console.log(JSON.stringify(juryRecommendations, null, 2));

  // RAPOR OLUŞTURMA: PIPELINE_TEST_REPORT.md dosyasının hazırlanması
  console.log("\n[RAPOR] PIPELINE_TEST_REPORT.md dosyası oluşturuluyor...");

  let reportMarkdown = `# 📊 FABRICCA LİTERATÜR TARAMA PİPELİNE TEST RAPORU\n\n`;
  reportMarkdown += `*Bu rapor, iki kanallı (Semantic Scholar + OpenAlex) literatür tarama ve Gemini Akademik Jüri pipeline'ının veritabanına dokunmadan izole bir şekilde çalıştırılması sonucu otomatik olarak üretilmiştir.*\n\n`;

  reportMarkdown += `## 🕒 Rapor Bilgileri\n`;
  reportMarkdown += `- **Çalıştırılma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n`;
  reportMarkdown += `- **Toplam Çalışma Süresi:** ${(totalDuration / 1000).toFixed(2)} saniye\n\n`;

  reportMarkdown += `## 🎯 Test Edilen Tez Anayasası ve Kutu\n`;
  reportMarkdown += `> ### 📘 Tez Anayasası\n`;
  reportMarkdown += `> - **Başlık:** ${thesisCore.title}\n`;
  reportMarkdown += `> - **Araştırma Sorusu:** ${thesisCore.researchQuestion}\n`;
  reportMarkdown += `> - **Ana Argüman:** ${thesisCore.argument}\n`;
  reportMarkdown += `> - **Metodoloji:** ${thesisCore.methodology}\n\n`;

  reportMarkdown += `> ### 📦 Tematik Çalışma Kutusu\n`;
  reportMarkdown += `> - **Kutu Adı:** ${boxes[0].name}\n`;
  reportMarkdown += `> - **Açıklama:** ${boxes[0].description}\n\n`;

  reportMarkdown += `## ⏱️ Performans ve Süre Analizi\n`;
  reportMarkdown += `| Adım | İşlem Açıklaması | Süre (ms) | Süre (sn) |\n`;
  reportMarkdown += `|---|---|---|---|\n`;
  for (const [step, ms] of Object.entries(performanceLogs)) {
    reportMarkdown += `| ${step} | ${step.includes("Total") ? "**Genel Toplam**" : "Boru hattı bileşeni"} | ${ms} ms | ${(ms / 1000).toFixed(2)} sn |\n`;
  }
  reportMarkdown += `\n`;

  reportMarkdown += `## 🔍 Adım 1: Gemini Sorgu Çıkarma Sonuçları (Academic Queries)\n`;
  reportMarkdown += `Gemini 3.1 Flash Lite modelinin tez anayasası ve çalışma kutusu bağlamında ürettiği İngilizce arama terimleri:\n\n`;
  reportMarkdown += `\`\`\`json\n${JSON.stringify(extractedQueries, null, 2)}\n\`\`\`\n\n`;

  reportMarkdown += `## 📊 Adım 3: Arama Havuzu ve Tekilleştirme İstatistikleri\n`;
  reportMarkdown += `| Parametre | Değer |\n`;
  reportMarkdown += `|---|---|\n`;
  reportMarkdown += `| Semantic Scholar Ham Sonuç Sayısı | ${s2RawCount} |\n`;
  reportMarkdown += `| OpenAlex Ham Sonuç Sayısı | ${oaRawCount} |\n`;
  reportMarkdown += `| **Birleşik Toplam Ham Sayı** | **${totalRawCount}** |\n`;
  reportMarkdown += `| Özeti Çözülmüş Makale Sayısı | ${resolvedAbstractCount} / ${totalRawCount} |\n`;
  reportMarkdown += `| **Tekilleştirme Sonrası Nihai Havuz Boyutu** | **${finalPoolSize}** |\n`;
  reportMarkdown += `\n`;

  reportMarkdown += `## 🎓 Adım 4: Akademik Jüri Seçimleri (Gemini 3.1 Flash Lite)\n`;
  reportMarkdown += `Jürinin ${finalPoolSize} adet aday makale arasından seçtiği **en iyi 6 makale** ve tezinize entegrasyon gerekçeleri:\n\n`;

  juryRecommendations.forEach((rec, idx) => {
    reportMarkdown += `### ${idx + 1}. ${rec.title}\n`;
    reportMarkdown += `- **Yazarlar:** ${rec.authors}\n`;
    reportMarkdown += `- **Yıl:** ${rec.year}\n`;
    reportMarkdown += `- **Kaynak / Kaynakça Platformu:** \`${rec.source || "Bilinmiyor"}\` | **Dil:** \`${rec.lang || "Bilinmiyor"}\`\n`;
    reportMarkdown += `- **Atıf Sayısı:** ${rec.citationCount !== undefined ? rec.citationCount : 0}\n`;
    reportMarkdown += `- **Bağlantı (URL):** [Makaleye Git](${rec.url || "#"})\n`;
    reportMarkdown += `- **💡 Jüri Entegrasyon Gerekçesi (Türkçe):**\n  > *${rec.relevance}*\n\n`;
    reportMarkdown += `---\n\n`;
  });

  reportMarkdown += `## 📂 Arama Havuzundaki Tüm Aday Makaleler (Ham Liste - Tekilleştirilmiş)\n`;
  reportMarkdown += `<details>\n<summary>Tekilleştirilmiş ${finalPoolSize} makalenin tam listesini görmek için tıklayın</summary>\n\n`;
  reportMarkdown += `\`\`\`json\n${JSON.stringify(uniquePapers, null, 2)}\n\`\`\`\n`;
  reportMarkdown += `</details>\n\n`;

  reportMarkdown += `## 🛠️ Jüri Çıktısı (Ham JSON)\n`;
  reportMarkdown += `\`\`\`json\n${JSON.stringify(juryRecommendations, null, 2)}\n\`\`\`\n`;

  const reportPath = path.join(process.cwd(), "PIPELINE_TEST_REPORT.md");
  fs.writeFileSync(reportPath, reportMarkdown, "utf8");
  console.log(
    `\n🎉 PIPELINE_TEST_REPORT.md başarıyla kaydedildi: ${reportPath}`,
  );
  console.log(
    "================================================================================",
  );
}

runTestPipeline().catch((err) => {
  console.error("\n❌ Test Pipeline yürütülürken hata oluştu:", err);
  process.exit(1);
});
