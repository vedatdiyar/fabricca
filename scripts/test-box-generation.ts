/**
 * Box-generation test script
 *
 * Runs 5 sequential box-generation API calls with 3 retries each.
 *
 * Usage: npx tsx scripts/test-box-generation.ts
 */
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "../src/lib/prompts/box-generation";

const MODEL = "gemini-3.1-flash-lite";
const MAX_RETRIES = 3;

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const SYSTEM_INSTRUCTION = buildThesisBoxGenerationSystemInstruction();
const PROMPT = buildThesisBoxGenerationPrompt(THESIS_MATRIX);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(): Promise<{ boxes: unknown[] }> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 1.0,
      responseMimeType: "application/json",
      responseJsonSchema: thesisBoxGenerationSchema as any,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response");

  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.boxes)) {
    throw new Error("Invalid response structure: missing 'boxes' array");
  }

  return parsed;
}

async function runTest(index: number): Promise<void> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    process.stdout.write(`Test #${index} | Attempt ${attempt}/${MAX_RETRIES} | Calling Gemini... `);
    try {
      const data = await callGemini();
      const boxes = data.boxes;
      const types = boxes.map((b: any) => b.boxType || b.type);

      process.stdout.write(`OK (${types.length} boxes)\n`);
      console.log(`${"=".repeat(72)}`);
      console.log(`Test #${index} | Attempt ${attempt}/${MAX_RETRIES}`);
      console.log(`Types: ${types.join(", ")}`);
      console.log(`Full JSON:`);
      console.log(JSON.stringify(data, null, 2));
      console.log(`${"=".repeat(72)}\n`);
      return;
    } catch (err) {
      lastError = String(err);
      process.stdout.write(`FAILED\n`);
      console.error(`Error: ${lastError}`);
      if (attempt < MAX_RETRIES) await sleep(2000 * attempt);
    }
  }

  console.error(`Test #${index} | ALL ${MAX_RETRIES} RETRIES EXHAUSTED | Last error: ${lastError}`);
}

async function main(): Promise<void> {
  console.log("BOX GENERATION TEST — 5 Sequential Calls (3 Retries Each)\n");

  for (let i = 1; i <= 5; i++) {
    console.log(`>>> Starting Test #${i}...`);
    await runTest(i);
  }

  console.log("Done.");
}

main().catch(console.error);
