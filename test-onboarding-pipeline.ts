import { loadEnvConfig } from "@next/env";
// Load environmental variables from .env.local
loadEnvConfig(process.cwd());

import {
  getProfessorOnboardingResponseAction,
  ChatMessage,
} from "./src/app/onboarding/actions";

async function main() {
  console.log("====================================================");
  console.log("FABRICCA - ONBOARDING MULTI-AGENT PIPELINE MOCK TEST");
  console.log("====================================================\n");

  // Simulating realistic student input
  const studentInput = `Tez konum 1991-1999 Kürt hareketi ve sosyalist solun kuramsal ve söylemsel karşılaşmaları üzerine. Bu dönemde Gelenek ve Özgürlük Dünyası dergilerinin pozisyonlarını incelemek istiyorum. Araştırma sorum: '1990'lardaki Kürt ulusal hareketi ile Türk sosyalist hareketi arasındaki söylemsel/ideolojik etkileşim ve çatışmalar, bu iki derginin yayınlarında kendini nasıl göstermiştir?' Gramsci'nin hegemonya teorisi ve Snow & Benford'un çerçeveleme kuramını (framing theory) birleştirerek söylem analizi yapmayı planlıyorum.`;

  console.log(`[Öğrenci Girdisi (Vedat)]:\n"${studentInput}"\n`);
  console.log("----------------------------------------------------");
  console.log(
    "Aşama 1 (Academic Auditor - Gemini 2.5 Flash + Google Search) ve",
  );
  console.log(
    "Aşama 2 (Advisor - Gemini 3.1 Flash-Lite / Prof. Dr. Verita) tetikleniyor...",
  );
  console.log(
    "Lütfen bekleyin (Dynamic Thinking ve arama zaman alabilir)...\n",
  );

  const startTime = Date.now();

  try {
    const chatHistory: ChatMessage[] = []; // Empty history for onboarding initial question
    const response = await getProfessorOnboardingResponseAction(
      chatHistory,
      studentInput,
      {
        risk: "Düşük",
        gapAnalysis:
          "Stratejik bir çakışma tespit edilmemiştir. Kitap ve doktora müfredat taraması önerilir.",
      },
    );

    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

    console.log("====================================================");
    console.log(`İŞLEM TAMAMLANDI (${elapsedSeconds} saniye sürdü)`);
    console.log("====================================================\n");

    console.log(`Success: ${response.success}`);
    if (response.error) {
      console.error(`Hata Mesajı: ${response.error}`);
      process.exit(1);
    }

    console.log("\n----------------------------------------------------");
    console.log("[Prof. Dr. Verita'nın Edebi Yanıtı]:");
    console.log("----------------------------------------------------");
    console.log(response.message || "Edebi yanıt yok.");
    console.log("----------------------------------------------------\n");

    console.log("Needs Review:", response.needsReview);
    console.log(
      "Structured Data (JSON Schema Uyumlu):",
      JSON.stringify(response.structuredData, null, 2),
    );

    console.log("\n====================================================");
    console.log("MOCK TEST BAŞARIYLA TAMAMLANDI!");
    console.log("====================================================");
  } catch (error) {
    console.error("Test execution failed with error:", error);
    process.exit(1);
  }
}

main();
