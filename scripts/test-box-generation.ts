/**
 * Box-generation test script
 *
 * Runs 10 box-generation API calls in two batches of 5 parallel requests.
 * Each call uses the same thesis matrix input and validates against the JSON schema.
 *
 * Usage: npx tsx scripts/test-box-generation.ts
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts/box-generation";
import { BoxGenerationResponseSchema } from "@/lib/types";

const MODEL = "gemini-3.1-flash-lite";

const THESIS_MATRIX = {
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

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_INSTRUCTION = buildThesisBoxGenerationSystemInstruction();
const PROMPT = buildThesisBoxGenerationPrompt(THESIS_MATRIX);

interface TestResult {
  index: number;
  batch: number;
  success: boolean;
  boxCount: number;
  boxTypes: string[];
  durationMs: number;
  rawJson: unknown;
  error?: string;
}

async function runSingleTest(
  index: number,
  batch: number,
): Promise<TestResult> {
  const startTime = performance.now();
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 1.0,
        responseMimeType: "application/json",
        responseJsonSchema: thesisBoxGenerationSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Boş yanıt");

    let cleanedText = text.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```$/, "")
        .trim();
    }

    const parsed = JSON.parse(cleanedText);
    const validation = BoxGenerationResponseSchema.safeParse(parsed);

    if (!validation.success) {
      return {
        index,
        batch,
        success: false,
        boxCount: 0,
        boxTypes: [],
        durationMs: Math.round(performance.now() - startTime),
        rawJson: parsed,
        error: `Zod doğrulama hatası: ${validation.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      };
    }

    const boxes = validation.data.boxes;
    const durationMs = Math.round(performance.now() - startTime);
    return {
      index,
      batch,
      success: true,
      boxCount: boxes.length,
      boxTypes: boxes.map((b) => b.boxType),
      durationMs,
      rawJson: parsed,
    };
  } catch (err) {
    return {
      index,
      batch,
      success: false,
      boxCount: 0,
      boxTypes: [],
      durationMs: Math.round(performance.now() - startTime),
      rawJson: null,
      error: String(err),
    };
  }
}

async function runBatch(
  batchNumber: number,
  size: number,
): Promise<TestResult[]> {
  const tasks: Promise<TestResult>[] = [];
  for (let i = 0; i < size; i++) {
    const globalIndex = (batchNumber - 1) * size + i + 1;
    tasks.push(runSingleTest(globalIndex, batchNumber));
  }
  return Promise.all(tasks);
}

function printSeparator(title: string): void {
  const line = "=".repeat(80);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}\n`);
}

function printResults(results: TestResult[]): void {
  for (const r of results) {
    const sep = "-".repeat(72);
    const status = r.success ? "✓ BAŞARILI" : "✗ BAŞARISIZ";
    console.log(`Test #${r.index} (Batch ${r.batch}) — ${status}`);
    console.log(`  Süre: ${r.durationMs}ms`);
    if (r.success) {
      console.log(`  Kutu sayısı: ${r.boxCount}`);
      console.log(`  Kutu tipleri: ${r.boxTypes.join(", ")}`);
    } else {
      console.log(`  Hata: ${r.error}`);
    }
    console.log(`  Ham JSON:`);
    console.log(JSON.stringify(r.rawJson, null, 2));
    console.log(sep);
  }
}

function printSummary(allResults: TestResult[]): void {
  const successful = allResults.filter((r) => r.success);
  const failed = allResults.filter((r) => !r.success);
  const avgDuration =
    Math.round(
      successful.reduce((sum, r) => sum + r.durationMs, 0) / successful.length,
    ) || 0;
  const avgBoxCount =
    Math.round(
      (successful.reduce((sum, r) => sum + r.boxCount, 0) / successful.length) *
        100,
    ) / 100 || 0;

  printSeparator("ÖZET");
  console.log(`Toplam test: ${allResults.length}`);
  console.log(`Başarılı:     ${successful.length}`);
  console.log(`Başarısız:    ${failed.length}`);
  console.log(`Ort. süre:    ${avgDuration}ms`);
  console.log(`Ort. kutu:    ${avgBoxCount}`);

  if (successful.length > 0) {
    console.log(`\nKutu tipi dağılımı (tüm başarılı testler):`);
    const typeCounts: Record<string, number> = {};
    for (const r of successful) {
      for (const t of r.boxTypes) {
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
    }
    for (const [type, count] of Object.entries(typeCounts).sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${type}: ${count}`);
    }

    console.log(`\nKutu sayısı dağılımı:`);
    const boxCountDist: Record<string, number> = {};
    for (const r of successful) {
      const key = String(r.boxCount);
      boxCountDist[key] = (boxCountDist[key] || 0) + 1;
    }
    for (const [count, freq] of Object.entries(boxCountDist).sort(
      (a, b) => Number(a[0]) - Number(b[0]),
    )) {
      console.log(`  ${count} kutu: ${freq} test`);
    }
  }

  if (failed.length > 0) {
    console.log(`\nBaşarısız test detayı:`);
    for (const r of failed) {
      console.log(`  Test #${r.index}: ${r.error}`);
    }
  }
}

async function main(): Promise<void> {
  const startTime = performance.now();

  printSeparator("BOX GENERATION TEST — BATCH 1/2 (5 PARALEL)");
  console.log("5 paralel istek gönderiliyor...\n");
  const batch1 = await runBatch(1, 5);
  printResults(batch1);

  printSeparator("BOX GENERATION TEST — BATCH 2/2 (5 PARALEL)");
  console.log("5 paralel istek gönderiliyor...\n");
  const batch2 = await runBatch(2, 5);
  printResults(batch2);

  const totalDuration = Math.round(performance.now() - startTime);
  printSummary([...batch1, ...batch2]);
  console.log(`\nToplam test süresi: ${totalDuration}ms`);
}

main().catch(console.error);
