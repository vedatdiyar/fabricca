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
    "Söylemsel Dönüşüm ve Hegemonik Kırılmalar: 1991-1999 Döneminde Kürt Siyasi Hareketi ile Türkiye Sosyalist Solu Arasındaki İlişkisel Dinamikler",
  researchQuestion:
    "1991-1999 yılları arasında Kürt siyasi hareketinin Marksist-Leninist bir söylem evreninden demokrasi ve insan hakları odaklı bir söylemsel çerçevenin inşasına evrilmesini tetikleyen yapısal faktörler nelerdir ve bu dönüşüm, Türkiye sosyalist solunun, Kürt hareketiyle kurduğu ilişkilenme biçimlerini tarihsel olarak nasıl yeniden şekillendirmiştir?",
  mainClaim:
    "Kürt siyasi hareketindeki Marksist-Leninist söylemden demokrasi ve insan hakları merkezli yeni bir siyasal dile geçiş, 1999 sonrası bir gelişme değil, 1991-1999 yılları arasındaki küresel ve ulusal koşulların şekillendirdiği yapısal bir kırılma sürecidir. Bu dönüşüm, hareketin salt bir stratejik tercihi olmanın ötesinde, Türkiye sosyalist solu ile olan tarihsel ilişkiyi hegemonya ve meşruiyet arayışı temelinde yeniden tanımlayan ve aktörlerin siyasal konumlanışlarını kökten değiştiren belirleyici bir faktördür.",
  theoreticalFramework:
    "Bu çalışma, teorik çerçevesini hegemonya kuramı ve sosyal hareket çalışmalarında temel bir analitik araç olan çerçeveleme kuramı (framing theory) üzerinden kurgulamaktadır. Söylemsel dönüşüm süreci; Soğuk Savaş sonrası değişen küresel konjonktür, Türkiye'deki hızlı kentleşme süreçleri ve yükselen demokratikleşme taleplerinin yarattığı siyasi iklimin bir sonucu olarak ele alınmaktadır. Bu bağlamda, hareketin siyasi dilindeki değişimler, hegemonya tesis etme ve meşruiyet alanını genişletme çabası olarak kavramsallaştırılmakta; böylece ideolojik metinlerin toplumsal gerçeklikleri yeniden kurma kapasitesi incelenmektedir. Benzer çalışmalardan farklı olarak Ernesto Laclau ve Chantal Mouffe kullanılmayacaktır.",
  methodology:
    "Araştırma, nitel tarihsel karşılaştırmalı söylem analizi yöntemiyle tasarlanmıştır. Birincil veri seti, HEP, DEP ve HADEP'in resmi programatik metinlerinden; sosyalist solun yanıtları ise Özgürlük Dünyası ve Gelenek dergilerindeki dönemsel tartışmalardan derlenmiştir. Analiz sürecinde, metinler arası söylemsel süreklilikleri ve kopuşları tespit etmek amacıyla çerçeveleme kodlama şeması uygulanacaktır. Elde edilen nitel veriler, Gramsci'ci hegemonya kavramsallaştırması ekseninde yorumlanarak, hareketin ideolojik dönüşümü ile sosyalist solun bu dönüşüme verdiği tepkiler arasında diyalektik bir ilişki kurulacaktır.",
  researchScope:
    "Araştırmanın kapsamı, Türkiye'de 1991-1999 yılları arasındaki iki ana dönemi (1991-1995 ve 1995-1999) içeren tarihsel periyodu içerir. İncelenen kaynaklar, Kürt siyasi hareketinin kurumsal parti belgeleri, süreli yayınlar ve ideolojik metinlerden teşekkül etmektedir. Çalışma, bu dönemde Kürt siyasi hareketinin söylemsel matrisindeki değişimleri, sosyalist solun kurumsal ve entelektüel refleksleriyle ilişkilendirerek, dönemsel krizlerin ve dönüşümlerin siyasal aktörlerin stratejik tercihleri ve ittifak süreçleri üzerindeki etkilerini bütünsel bir perspektifle analiz etmektedir.",
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const SYSTEM_INSTRUCTION = buildThesisBoxGenerationSystemInstruction();
const PROMPT = buildThesisBoxGenerationPrompt(THESIS_MATRIX);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(): Promise<{ boxes: Record<string, unknown>[] }> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 1.0,
      responseMimeType: "application/json",
      responseJsonSchema: thesisBoxGenerationSchema as unknown as Record<
        string,
        unknown
      >,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response");

  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }

  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.boxes)) {
    throw new Error("Invalid response structure: missing 'boxes' array");
  }

  return parsed as { boxes: Record<string, unknown>[] };
}

async function runTest(index: number): Promise<void> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    process.stdout.write(
      `Test #${index} | Attempt ${attempt}/${MAX_RETRIES} | Calling Gemini... `,
    );
    try {
      const data = await callGemini();
      const boxes = data.boxes;
      const types = boxes.map((b) => String(b.boxType || b.type || ""));

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

  console.error(
    `Test #${index} | ALL ${MAX_RETRIES} RETRIES EXHAUSTED | Last error: ${lastError}`,
  );
}

async function main(): Promise<void> {
  console.log(
    "BOX GENERATION TEST (v2 — Esnek Ontolojik Raf Mimarisi) — 5 Sequential Calls (3 Retries Each)\n",
  );

  for (let i = 1; i <= 5; i++) {
    console.log(`>>> Starting Test #${i}...`);
    await runTest(i);
  }

  console.log("Done.");
}

main().catch(console.error);
