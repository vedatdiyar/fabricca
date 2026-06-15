import { readFileSync } from "fs";
import { resolve } from "path";
const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  process.env[key] = val;
}

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const testMatrix = {
  studyTitle:
    "Kürt Siyasal Hareketi'nin Söylemsel Dönüşümü: 1991-1999 Yılları Arasında Çerçeveleme ve Hegemonik Mücadele",
  researchQuestion:
    "1991-1999 yılları arasında Kürt siyasal hareketi, meşruiyet zeminini genişletmek ve ulusal/uluslararası kamuoyunda kabul görmek için hangi çerçeveleme stratejilerini kullanmış ve bu stratejiler Gramsci'nin hegemonya kavramı bağlamında nasıl analiz edilebilir?",
  mainClaim:
    "Kürt siyasal hareketi, 1991-1999 yılları arasında silahlı mücadele söyleminden 'demokratik çözüm' ve 'siyasal tanınma' söylemine doğru stratejik bir çerçeveleme dönüşümü geçirmiş; bu dönüşüm Gramsci'nin hegemonya mücadelesi kavramı çerçevesinde okunabilir.",
  methodology:
    "Niteliksel söylem analizi (Fairclough'un Eleştirel Söylem Analizi yaklaşımı) ve çerçeveleme analizi (Snow ve Benford'un çerçeveleme teorisi) kullanılarak dönemin siyasi parti belgeleri, parti liderlerinin söylemleri, bildiriler ve röportajların incelenmesi.",
  theoreticalFramework:
    "Çerçeveleme Teorisi (David A. Snow, Robert D. Benford), Hegemonya ve Sivil Toplum (Antonio Gramsci), Siyasal Fırsat Yapıları (Tarrow, Tilly)",
  historicalSpatialLimits:
    "Türkiye, 1991-1999 yılları arası (Saddam sonrası Kuzey Irak'ın oluşumu, Helsinki Zirvesi sonrası AB adaylık süreci, DEP/YDK/HADEP çizgisi)",
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callWithRetry(prompt: string, attempt = 1): Promise<any> {
  try {
    return await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
        temperature: 1.0,
        responseMimeType: "application/json",
        responseJsonSchema: thesisBoxGenerationSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
  } catch (err: any) {
    if (err.status === 503 && attempt < 4) {
      const jitter = Math.floor(Math.random() * 2000);
      await sleep(3000 * attempt + jitter);
      return callWithRetry(prompt, attempt + 1);
    }
    throw err;
  }
}

function printBoxes(boxes: any[], runNum: number) {
  console.log(`========== TEST ${runNum} ==========`);
  for (const b of boxes) {
    const theorists = (b.theorists || []).length > 0
      ? (b.theorists as string[]).join(", ")
      : "(yok)";
    const concepts = b.concepts || [];
    console.log(`[${b.category}] ${b.title}`);
    console.log(`  Teorisyenler: ${theorists}`);
    console.log(`  Kavramlar (${concepts.length}): ${concepts.join(", ")}`);
    console.log();
  }
}

async function main() {
  for (let i = 0; i < 5; i++) {
    const prompt = buildThesisBoxGenerationPrompt(testMatrix);
    const response = await callWithRetry(prompt);
    const json = JSON.parse(response.text!);
    const boxes = json.boxes || [];
    printBoxes(boxes, i + 1);
  }
}

main().catch(console.error);
