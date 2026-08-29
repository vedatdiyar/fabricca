import { z } from "zod";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SYNTHESIS_PIPELINE } from "@/lib/pipeline-definitions";
import type { ThesisMatrix } from "@/lib/types";

export interface UserClarificationAnswer {
  question: string;
  answer: string;
}

export const synthesizedMatrixSchema = z.object({
  subjectProblem: z
    .string()
    .min(35)
    .describe(
      "Araştırma Problemi, Aktörler ve Odak: Çözülecek gerilimi, aktörleri, sınırları ve araştırma sorularını enstitü standartlarında açıklayan yoğun akademik paragraf",
    ),
  theoreticalFramework: z
    .string()
    .min(35)
    .describe(
      "Teorik ve Kavramsal Çerçeve: Temel alınan kuramsal merceği, analitik kavramları ve literatür zeminini açıklayan yoğun akademik paragraf",
    ),
  primaryMaterial: z
    .string()
    .min(20)
    .describe(
      "Veri Kaynağı / Birincil Malzeme: Kullanılacak arşiv belgelerini, saha örneklemini, veri setlerini veya birincil materyali tanımlayan somut paragraf",
    ),
  methodology: z
    .string()
    .min(35)
    .describe(
      "Metodoloji: Veri toplama, kodlama/ölçme, analiz adımlarını ve operasyonelleştirmeyi açıklayan yetkin akademik paragraf",
    ),
});

export const synthesizedMatrixJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    subjectProblem: {
      type: "string",
      description:
        "Araştırma Problemi, Aktörler ve Odak: Çözülecek gerilimi, aktörleri ve araştırma sorularını açıklayan yoğun akademik paragraf",
    },
    theoreticalFramework: {
      type: "string",
      description:
        "Teorik ve Kavramsal Çerçeve: Temel alınan kuramsal merceği ve analitik kavramları açıklayan yoğun akademik paragraf",
    },
    primaryMaterial: {
      type: "string",
      description:
        "Veri Kaynağı / Birincil Malzeme: Kullanılacak arşiv belgelerini, saha örneklemini veya veri setlerini tanımlayan paragraf",
    },
    methodology: {
      type: "string",
      description:
        "Metodoloji: Veri toplama ve analiz adımlarını açıklayan yetkin akademik paragraf",
    },
  },
  required: [
    "subjectProblem",
    "theoreticalFramework",
    "primaryMaterial",
    "methodology",
  ],
};

/**
 * Synthesizes the final 4-quadrant Thesis Matrix from the user's original proposal,
 * the search evidence dossier, and the user's answers to the clarification questions.
 *
 * @param originalProposal - The user's initial proposal or text.
 * @param evidenceSummary - The synthesized multi-angle search findings.
 * @param userAnswers - Array of question/answer pairs from the user.
 * @returns The final 4-quadrant ThesisMatrix.
 */
export async function synthesizeFinalMatrix(
  originalProposal: string,
  evidenceSummary: string,
  userAnswers: UserClarificationAnswer[],
): Promise<ThesisMatrix> {
  const systemInstruction = `<role>
Tez danışmanlığı ve araştırma tasarımı konusunda uzman, deneyimli bir akademisyensiniz.
Göreviniz:
1. Araştırmacının sunduğu orijinal tez önerisini,
2. Web ve YÖK tez taramasından elde edilen güncel kanıtları,
3. Ve en önemlisi araştırmacının netleştirme sorularına verdiği somut cevapları BİRLEŞTİRMEKTİR.
Tüm çelişkileri giderilmiş, soruları çözülmüş, yöntemsel ve kuramsal zemini sağlam 4 kadranlı yüksek standartta bir Tez Matrisi (Thesis Matrix) sentezleyeceksiniz.
</role>

<instructions>
# Dil ve Üslup Kuralları (ZORUNLU)
- Kesinlikle doğal, duru, yaşayan ve akıcı bir Türkçe kullanın.
- Ağdalı, yapay, çeviri kokan akademik jargondan ve plaza/beyaz yaka dilinden kesinlikle kaçının.
- 'Korpus', 'nötralize etmek', 'operasyonelleştirmek', 'rezonans', 'aksiyom', 'konsolidasyon' gibi yapay veya yabancı kelimeleri KESİNLİKLE KULLANMAYIN:
  * 'Korpus' yerine: 'metinler', 'yazılı kaynaklar', 'arşiv', 'belge grubu' veya 'veri kümesi'.
  * 'Nötralize etmek' yerine: 'etkisini gidermek', 'dengelemek', 'kontrol altına almak' veya 'aşmak'.
  * 'Operasyonelleştirmek' yerine: 'somutlaştırmak', 'uygulamaya dökmek' veya 'ölçülebilir kılmak'.
- Her bir kadran doğrudan, yoğun, berrak ve yaşayan bir Türkçe ile yazılmalıdır.
- Araştırmacının cevaplarında belirttiği özel tercihler (örneklem sayısı, aktör seçimi, kuramsal öncelik vb.) doğrudan ilgili kadranlara işlenmelidir.
- Genelgeçer, içi boş dolgu ifadeler kullanmayın. Somut olgu ve kavramları adlandırın.
</instructions>`;

  const run = PipelineRun.create(MATRIX_SYNTHESIS_PIPELINE);

  const answersFormatted = await run.execute(
    "analysis",
    async () => {
      if (userAnswers.length === 0) {
        return "Araştırmacı doğrudan öneri taslağıyla devam etmeyi tercih etti.";
      }
      return userAnswers
        .map(
          (a, idx) =>
            `Soru ${idx + 1}: ${a.question}\nAraştırmacının Cevabı: ${a.answer}`,
        )
        .join("\n\n");
    },
    { description: "User Clarification Answers" },
  );

  const prompt = `<original_proposal>
${originalProposal.slice(0, 10000)}
</original_proposal>

<search_evidence>
${evidenceSummary.slice(0, 4000)}
</search_evidence>

<user_answers>
${answersFormatted}
</user_answers>

Yukarıdaki üç kaynağı harmanlayarak, araştırmacının kararlarını ve literatür kanıtlarını tam yansıtan 4 kadranlı nihai Tez Matrisini üret.`;

  const result = await run.execute(
    "synthesis",
    () =>
      generateGeminiStructuredContent<ThesisMatrix>(
        FLASH_LITE_35,
        systemInstruction,
        prompt,
        synthesizedMatrixJsonSchema,
        run.logger,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          zodSchema: synthesizedMatrixSchema,
          seed: GEMINI_SEED,
          payloadStage: "matrix_synthesis",
          quiet: true,
        },
      ),
    { description: "Matrix Synthesis" },
  );

  run.finish();

  return result;
}

import type { Logger } from "@/lib/logger";

/**
 * Decomposes and synthesizes an initial 4-quadrant Thesis Matrix directly from a raw proposal text.
 * Used for headless matrix creation to immediately seed multi-channel academic searches.
 *
 * @param proposalText - The user's raw proposal or draft text.
 * @param log - Optional structured logger.
 * @returns The initial 4-quadrant ThesisMatrix.
 */
export async function synthesizeInitialMatrixFromProposal(
  proposalText: string,
  log?: Logger,
): Promise<ThesisMatrix> {
  const systemInstruction = `<role>
Kıdemli Tez Danışmanı ve Araştırma Metodoloğu.
Göreviniz: Araştırmacının sunduğu ham tez önerisi veya taslak metnini analiz ederek 4 temel araştırma kadranına (Problem, Kuramsal Çerçeve, Veri/Malzeme, Metodoloji) ayrıştırmaktır.
</role>

<instructions>
1. subjectProblem: Araştırma Problemi, Aktörler ve Odak (yoğun akademik paragraf).
2. theoreticalFramework: Teorik ve Kavramsal Çerçeve (dayandığı kuramlar ve kavramlar).
3. primaryMaterial: Veri Kaynağı / Birincil Malzeme (arşiv, saha, metin külliyatı).
4. methodology: Metodoloji ve Yöntem (veri toplama ve analiz yaklaşımı).
Metinde açıkça belirtilmeyen kısımlar varsa, konunun doğasına uygun enstitü standartlarında akademik bir öneri çerçevesi inşa edin.
</instructions>`;

  const prompt = `<proposal>\n${proposalText.slice(0, 10000)}\n</proposal>\nYukarıdaki tez taslağından 4 kadranlı akademik tez matrisini üret.`;

  return generateGeminiStructuredContent<ThesisMatrix>(
    FLASH_LITE_35,
    systemInstruction,
    prompt,
    synthesizedMatrixJsonSchema,
    log,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      zodSchema: synthesizedMatrixSchema,
      seed: GEMINI_SEED,
      payloadStage: "initial_matrix_synthesis",
      quiet: true,
    },
  );
}
