/**
 * Box Üretimi Test Scripti
 *
 * Bu script, verilen bir tez matrisi girdisini kullanarak
 * Gemini API üzerinden konu kutuları (boxes) üretimini test eder.
 *
 * Kullanım:
 *   npx tsx test-box-generation.ts
 *
 * Gereksinimler:
 *   - .env.local dosyasında GEMINI_API_KEY tanımlı olmalıdır
 */

import { GoogleGenAI } from "@google/genai";
import type { JsonSchema } from "./src/lib/gemini";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "./src/lib/prompts/box-generation";
import type { GeminiThesisBox } from "./src/lib/types";

// ============================================================================
// GİRDI VERILERI
// ============================================================================
const thesisInput = {
  studyTitle:
    "Söylem, Çerçeve ve Hegemonya: 1991–1999 Yılları Arasında Kürt Siyasi Hareketinin Söylem Dönüşümü ve Türkiye Sosyalist Soluyla İlişkisi",
  researchQuestion:
    "Ana araştırma sorusu: 1991–1999 yılları arasında Kürt siyasi hareketi Marksist-Leninist söylemden demokrasi, insan hakları ve demokratik siyaset söylemine nasıl bir geçiş gerçekleştirmiştir; bu dönüşümü hangi yapısal koşullar şekillendirmiştir; ve Türkiye sosyalist solu bu dönüşüme nasıl yanıt vermiştir? Alt sorular: (i) Sovyetler Birliği'nin dağılması ve zorunlu kentleşme süreci söylemsel dönüşümü nasıl etkilemiştir? (ii) Kürt hareketinin yeni söylemsel çerçevesi hangi kavramlar ve siyasi talepler etrafında kurulmuştur? (iii) Türkiye sosyalist solunun farklı düşünsel çizgileri bu dönüşümü ne ölçüde benimsemiş, eleştirmiş veya reddetmiştir? (iv) Bu ilişkinin dönem içindeki dönüşüm dinamikleri nelerdir?",
  mainClaim:
    "Tezin temel iddiası, Kürt siyasi hareketinin ideolojik ve söylemsel dönüşümünün yalnızca 1999 sonrasında ortaya çıkmadığı; bu dönüşümün temellerinin 1991–1999 döneminde, küresel sosyalist dönüşüm ve Türkiye'deki toplumsal yeniden yapılanma koşulları altında inşa edildiğidir. Bu süreçte hareket, Marksist-Leninist çerçeveden demokrasi, insan hakları ve siyasal katılım merkezli yeni bir söylemsel çerçeveye yönelmiş; bu dönüşüm Türkiye sosyalist soluyla kurduğu ilişkiyi de yeniden yapılandırmıştır.",
  theoreticalFramework:
    "Birincil kuramsal çerçeve: Çerçeveleme Teorisi (Frame Analysis) — özellikle Snow ve Benford'un diagnostik, prognostik ve motivasyonel çerçeveler yaklaşımı. İkincil kuramsal çerçeve: Gramsci'nin hegemonya kavramı (hegemonik inşa, rıza üretimi, söylemsel meşruiyet). Kuramsal konumlanma: Sosyal hareketler literatürü + söylem ve hegemonya çalışmaları. Çalışma bilinçli olarak post-Marksist söylem teorisi yerine çerçeveleme yaklaşımını tercih etmektedir.",
  methodology:
    "Nitel araştırma tasarımına dayalı tarihsel karşılaştırmalı söylem analizi uygulanacaktır. Analiz, çerçeveleme teorisinden türetilmiş kodlama şemasıyla yürütülecek; kavramsal değişimler, çerçeve kaymaları ve aktörler arası söylemsel etkileşim izlenecektir. Türkiye sosyalist solunun yanıtları Gramscici hegemonya perspektifiyle yorumlanacaktır. Çalışma çift taraflı karşılaştırmalı okuma ve dönemsel izleme mantığıyla ilerlemektedir.",
  dataStrategy:
    "Birincil kaynaklar: (i) Kürt siyasi hareketi: Özgür Gündem ve devamı yayınlar; HEP, DEP, HADEP parti programları, kongre belgeleri ve savunma metinleri. (ii) Türkiye sosyalist solu: Özgürlük Dünyası ve Gelenek dergileri. İkincil kaynaklar: Kürt hareketi, sosyal hareketler ve Türkiye solu literatürü; mevcut akademik çalışmalar ve tarihsel analizler. Veri stratejisi: Çift taraflı arşiv taraması ve karşılıklı söylem eşleştirmesi.",
  historicalLimits:
    "1991–1999. Başlangıç noktası Sovyetler Birliği'nin çözülmesi ve yeni küresel söylemsel bağlamın oluşması; bitiş noktası Abdullah Öcalan'ın tutuklanması ve sonrasında görünür hale gelen ideolojik dönüşümün eşiğidir. Analitik olarak dönem 1991–1995 ve 1995–1999 olmak üzere iki alt evreye ayrılacaktır.",
  spatialLimits:
    "Türkiye. Odak alan Türkiye'de faaliyet gösteren Kürt siyasi hareketi ile Türkiye sosyalist soludur. Çalışma özellikle ulusal düzeyde yayımlanan parti belgeleri, basın organları ve düşünsel üretim alanına odaklanmaktadır; belirli bir şehir ya da yerel vaka analizi yürütülmeyecektir.",
  analyticalFocus:
    "Birincil aktörler: Kürt siyasi hareketi (PKK ile ilişkili söylemsel alan; HEP–DEP–HADEP çizgisi) ve Türkiye sosyalist solu (özellikle Özgürlük Dünyası ve Gelenek çevresi). İncelenen birimler: Parti programları, gazete yazıları, ideolojik metinler, siyasal açıklamalar ve söylemsel çerçeveler. Analitik odak: Söylem dönüşümü, çerçeve değişimi, meşruiyet üretimi, koalisyon dili ve hegemonik ilişki kurma girişimleri.",
};

// ============================================================================
// BASIT LOGGER (production logger'a bağımlılık olmadan)
// ============================================================================
const testLogger = {
  info: (msg: string, data?: Record<string, unknown>) =>
    console.log(`[INFO] ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  warn: (msg: string, data?: Record<string, unknown>) =>
    console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  error: (msg: string, data?: Record<string, unknown>) =>
    console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  saveDebugPayload: () => undefined,
};

// ============================================================================
// GEMINI ÇAĞRISI (generateStructuredContent'ın bağımsız kopyası)
// ============================================================================
let aiInstance: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not defined in .env.local",
      );
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function generateStructuredContent<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string,
  schema: JsonSchema,
): Promise<T> {
  const response = await getAi().models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      temperature: 1.0,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini yanıtı boş döndü.");
  }

  // Temizle: markdown code block varsa kaldır
  let cleanedText = text.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }

  return JSON.parse(cleanedText) as T;
}

// ============================================================================
// TEK TEST ÇALIŞTIRMA FONKSİYONU
// ============================================================================
const TOTAL_RUNS = 10;

async function runSingleTest(runNumber: number): Promise<void> {
  console.log("\n" + "#".repeat(80));
  console.log(`# TEST ${runNumber} / ${TOTAL_RUNS}`);
  console.log("#".repeat(80));

  const systemInstruction = buildThesisBoxGenerationSystemInstruction();
  const userPrompt = buildThesisBoxGenerationPrompt(thesisInput);

  console.log(
    `  Sistem talimatı: ${systemInstruction.length} karakter`,
  );
  console.log(`  Kullanıcı promptu: ${userPrompt.length} karakter`);
  console.log(`  Model: gemini-3.1-flash-lite`);

  const startTime = performance.now();

  const result = await generateStructuredContent<{
    boxes: GeminiThesisBox[];
  }>(
    "gemini-3.1-flash-lite",
    systemInstruction,
    userPrompt,
    thesisBoxGenerationSchema as JsonSchema,
  );

  const duration = ((performance.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ BAŞARILI! (${duration}s)\n`);

  const boxes = result.boxes || [];
  console.log(`📦 Üretilen kutu sayısı: ${boxes.length}\n`);

  boxes.forEach((box, i) => {
    console.log("─".repeat(70));
    console.log(`  KUTU ${i + 1}: ${box.title}`);
    console.log(`  Tip: ${(box as GeminiThesisBox & { boxType?: string }).boxType ?? "belirtilmemiş"}`);
    console.log(`  Açıklama: ${box.description}`);
    console.log(
      `  Kavramlar: ${(box.concepts ?? []).join(", ")}`,
    );
    console.log(`  Semantic Search Block: ${box.semanticSearchBlock ? box.semanticSearchBlock.slice(0, 120) + "..." : "YOK"}`);
    if (box.foundationalQueries && box.foundationalQueries.length > 0) {
      console.log(`  Kurucu Eserler:`);
      box.foundationalQueries.forEach((fq) => {
        console.log(`    • ${fq.author} (${fq.publicationYear}) — ${fq.title}`);
      });
    }
  });

  console.log("\n" + "=".repeat(80));
  console.log("📄 HAM JSON ÇIKTISI:");
  console.log("=".repeat(80));
  console.log(JSON.stringify(result, null, 2));
  console.log("=".repeat(80));

  // Doğrulama
  console.log("\n🔍 DOĞRULAMA:");
  const errors: string[] = [];

  if (boxes.length === 0) {
    errors.push("❌ Hiç kutu üretilmedi!");
  } else {
    boxes.forEach((box, i) => {
      if (!box.title) errors.push(`❌ Kutu ${i + 1}: title eksik`);
      if (!box.description) errors.push(`❌ Kutu ${i + 1}: description eksik`);
      if (!box.semanticSearchBlock)
        errors.push(`❌ Kutu ${i + 1}: semanticSearchBlock eksik`);
      if (
        !box.foundationalQueries ||
        box.foundationalQueries.length === 0
      ) {
        errors.push(`❌ Kutu ${i + 1}: foundationalQueries eksik`);
      } else {
        box.foundationalQueries.forEach((fq, j) => {
          if (!fq.author) errors.push(`❌ Kutu ${i + 1}: FQ ${j + 1} author eksik`);
          if (!fq.title) errors.push(`❌ Kutu ${i + 1}: FQ ${j + 1} title eksik`);
          if (!fq.publicationYear)
            errors.push(`❌ Kutu ${i + 1}: FQ ${j + 1} publicationYear eksik`);
        });
      }
      if (!box.concepts || box.concepts.length === 0)
        errors.push(`❌ Kutu ${i + 1}: concepts eksik`);
    });
  }

  if (errors.length === 0) {
    console.log("✅ Tüm kontroller geçti!");
  } else {
    errors.forEach((e) => console.log(e));
  }

  // İstatistik topla
  results.push({ run: runNumber, boxCount: boxes.length, duration: parseFloat(duration), errors: errors.length });
}

// ============================================================================
// ANA TEST FONKSİYONU
// ============================================================================
const results: { run: number; boxCount: number; duration: number; errors: number }[] = [];

async function main() {
  console.log("=".repeat(80));
  console.log(`BOX ÜRETİM TESTİ — ${TOTAL_RUNS} TEKRAR`);
  console.log("=".repeat(80));
  console.log("\n📋 Girdi Tez Matrisi:");
  console.log(`  Başlık: ${thesisInput.studyTitle.slice(0, 80)}...`);
  console.log(`  Sorgu: ${thesisInput.researchQuestion.slice(0, 80)}...`);
  console.log(`  İddia: ${thesisInput.mainClaim.slice(0, 80)}...`);
  console.log(`  Metodoloji: ${thesisInput.methodology.slice(0, 80)}...`);
  console.log(
    `  Kuramsal Çerçeve: ${thesisInput.theoreticalFramework.slice(0, 80)}...`,
  );
  console.log(
    `  Tarihsel Sınırlar: ${thesisInput.historicalLimits.slice(0, 80)}...`,
  );
  console.log(
    `  Mekansal Sınırlar: ${thesisInput.spatialLimits.slice(0, 80)}...`,
  );

  const tasks = Array.from({ length: TOTAL_RUNS }, (_, i) => i + 1);
  const parallelResults = await Promise.allSettled(
    tasks.map((i) => runSingleTest(i)),
  );

  for (let i = 0; i < parallelResults.length; i++) {
    const r = parallelResults[i];
    const runNum = i + 1;
    if (r.status === "rejected") {
      const err = r.reason;
      console.log(`\n❌ TEST ${runNum} BAŞARISIZ!`);
      console.log(
        `Hata: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof Error && err.stack) {
        console.log(`Stack: ${err.stack}`);
      }
      results.push({ run: runNum, boxCount: 0, duration: 0, errors: 999 });
    }
  }

  // Özet tablosu
  console.log("\n" + "=".repeat(80));
  console.log("📊 ÖZET TABLOSU");
  console.log("=".repeat(80));
  console.log(`  ${"Run".padStart(4)} | ${"Kutu".padStart(4)} | ${"Süre".padStart(7)} | ${"Hata".padStart(5)}`);
  console.log("  " + "─".repeat(30));
  for (const r of results) {
    console.log(`  ${String(r.run).padStart(4)} | ${String(r.boxCount).padStart(4)} | ${r.duration.toFixed(1).padStart(7)}s | ${String(r.errors).padStart(5)}`);
  }
  console.log("  " + "─".repeat(30));
  const avgBox = results.reduce((s, r) => s + r.boxCount, 0) / results.length;
  const avgDur = results.reduce((s, r) => s + r.duration, 0) / results.length;
  console.log(`  Ort. kutu: ${avgBox.toFixed(1)} | Ort. süre: ${avgDur.toFixed(1)}s`);
  console.log("=".repeat(80));
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
