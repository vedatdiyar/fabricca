import { z } from "zod";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { FLASH_38, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SYNTHESIS_PIPELINE } from "@/lib/pipeline-definitions";
import type { ThesisMatrix } from "@/lib/types";
import type { Logger } from "@/lib/logger";

export interface UserClarificationAnswer {
  question: string;
  answer: string;
}

export const synthesizedMatrixSchema = z.object({
  subjectProblem: z
    .string()
    .min(100)
    .describe(
      "Araştırma Problemi, Aktörler ve Odak: Literatürdeki temel boşluğu/gerilimi, temel araştırma sorusunu, alt soruları ve metindeki tüm hipotezleri (varsa H1, H2 vb.) eksiksiz içeren yoğun akademik paragraf.",
    ),
  theoreticalFramework: z
    .string()
    .min(100)
    .describe(
      "Kuramsal ve Kavramsal Çerçeve: Yalnızca araştırmacının benimsediği kuramsal omurgayı, düşünürleri ve analitik modelleri içeren; ikincil literatürden ve yöntem araçlarından arındırılmış kuramsal çerçeve paragrafı.",
    ),
  primaryMaterial: z
    .string()
    .min(100)
    .describe(
      "Birincil Malzeme / Veri Kümesi: Metinde tanımlanan tüm birincil belgeleri, arşivleri, veri kaynaklarını tek tek adları ve tarihleriyle somut olarak listeleyen, dönemsel/mekansal eşikleri açıklayan paragraf.",
    ),
  methodology: z
    .string()
    .min(100)
    .describe(
      "Metodoloji ve Araştırma Deseni: Yöntemsel yaklaşımı, veriyi analiz etmede kullanılan kavramsal/yöntemsel araçları, analitik soruları, analiz aşamalarını/momentlerini ve karşılaştırma desenini açıklayan metodoloji paragrafı.",
    ),
});

export const synthesizedMatrixJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    subjectProblem: {
      type: "string",
      description:
        "Araştırma Problemi, Aktörler ve Odak: Literatürdeki temel boşluğu/gerilimi, temel araştırma sorusunu, alt soruları ve metindeki tüm hipotezleri (varsa H1, H2 vb.) eksiksiz içeren yoğun akademik paragraf.",
    },
    theoreticalFramework: {
      type: "string",
      description:
        "Kuramsal ve Kavramsal Çerçeve: Yalnızca araştırmacının benimsediği kuramsal omurgayı, düşünürleri ve analitik modelleri içeren; ikincil literatürden ve yöntem araçlarından arındırılmış kuramsal çerçeve paragrafı.",
    },
    primaryMaterial: {
      type: "string",
      description:
        "Birincil Malzeme / Veri Kümesi: Metinde tanımlanan tüm birincil belgeleri, arşivleri, veri kaynaklarını tek tek adları ve tarihleriyle somut olarak listeleyen, dönemsel/mekansal eşikleri açıklayan paragraf.",
    },
    methodology: {
      type: "string",
      description:
        "Metodoloji ve Araştırma Deseni: Yöntemsel yaklaşımı, veriyi analiz etmede kullanılan kavramsal/yöntemsel araçları, analitik soruları, analiz aşamalarını/momentlerini ve karşılaştırma desenini açıklayan metodoloji paragrafı.",
    },
  },
  required: [
    "subjectProblem",
    "theoreticalFramework",
    "primaryMaterial",
    "methodology",
  ],
};

export const universalDecompositionSystemInstruction = `<role>
Sen, tüm sosyal ve beşeri bilimler alanlarında (Siyaset Bilimi, Sosyoloji, Tarih, Uluslararası İlişkiler, Hukuk, Antropoloji, İletişim, Felsefe vb.) uzmanlaşmış kıdemli bir araştırma metodoloğu ve tez danışmanısın.
Görevin, araştırmacının sunduğu ham tez önerisi metnini analiz ederek, tezin tüm kuramsal, ampirik ve yöntemsel unsurlarını eksiksiz ve enstitü standartlarında 4 temel araştırma kadranına (Problem, Kuramsal Çerçeve, Birincil Malzeme, Metodoloji) ayrıştırmaktır.
</role>

<instructions>
Aşağıdaki 4 kurala KESİNLİKLE ve TAVİZSİZ uymalısın:

1. [subjectProblem - Araştırma Problemi ve Odak]:
- Araştırmacının literatürde tespit ettiği temel boşluğu, yapay yarılmayı, teorik/ampirik gerilimi veya problemi net biçimde ifade et.
- Tezin temel araştırma sorusunu, varsa alt araştırma sorularını belirt.
- Metinde yer alan ana hipotezi ve varsa numaralandırılmış tüm alt hipotezleri (H1, H2, H3 vb.) ya da tezin temel iddialarını atlamadan, eksiksiz aktar.
- Tezi genel ve yüzeysel bir konu betimlemesine indirgeme; çözülmek istenen araştırma sorunsalını ve iddiayı koru.

2. [theoreticalFramework - Kuramsal ve Kavramsal Çerçeve]:
- YALNIZCA araştırmacının kendi tezinin teorik omurgası olarak benimsediği kuramları, düşünürleri, kuramsal modelleri ve analitik kavramları yaz.
- Sınır Kuralı 1 (Yöntem Ayrımı): Yöntemsel analiz araçlarını, veri çözümleme tekniklerini veya kuramın metne/veriye uygulanmasını sağlayan metodolojik köprüleri buraya yazma; bunları Metodoloji kadranına aktar.
- Sınır Kuralı 2 (Literatür Ayrımı): İkincil literatür özetinde geçen, araştırmacının eleştirdiği veya arka plan olarak andığı ikincil yazarları ve karşılaştırmalı bağlam örneklerini kuramsal omurgaya dahil etme. Yalnızca tezin benimsediği kuramsal merceğe odaklan.

3. [primaryMaterial - Birincil Malzeme / Veri Kümesi]:
- Metinde tezin ampirik tabanı olarak belirtilen TÜM birincil kaynakları, arşiv belgelerini, metin kümesini, saha örneklemini veya veri setlerini tek tek, adları, tarihleri ve aktörleriyle/türleriyle somut olarak listele.
- KESİNLİKLE YASAK: Somut birincil kaynakları "çeşitli belgeler, örgütsel metinler, raporlar ve yayınlar" gibi genel ve soyut kategori adlarıyla özetleyip kaynakların kendisini yutma. Metinde tanımlı her bir belgeyi/veri kaynağını açıkça belirt.
- Varsa araştırmanın dönemsel, coğrafi veya kurumsal sınırlarını/eşiklerini ve bu sınırların metinde sunulan gerekçelerini aktar.

4. [methodology - Metodoloji ve Araştırma Deseni]:
- Tezin benimsediği yöntemsel yaklaşımı (niteliksel, niceliksel veya karma desen) ve kuramsal kavramları veriye uygulayan yöntemsel araçları/düşünürleri belirt.
- Veriye veya metinlere yöneltilen analitik soruları, inceleme şemasını, kodlama veya analiz parametrelerini açıkça yaz.
- Varsa araştırmanın dönemsel/tarihsel momentlerini, analiz aşamalarını veya kaynak/aktör grupları arasındaki karşılaştırmalı deseni dahil et.

# Dil, Üslup ve Kalite Standartları:
- Duru, doğal, yetkin ve yaşayan bir akademik Türkçe kullan.
- Uydurma, yapay veya bozuk terimler kesinlikle kullanma.
- Yüzeysel ve içi boş dolgu cümlelerinden kaçın; metinde araştırmacının bizzat inşa ettiği somut verilere, kavramlara, sorulara ve hipotezlere sadık kal.
</instructions>`;

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
- Ağdalı, yapay, çeviri kokan akademik jargondan kesinlikle kaçının.
- Her bir kadran doğrudan, yoğun, berrak ve yaşayan bir Türkçe ile yazılmalıdır.
- Araştırmacının cevaplarında belirttiği özel tercihler doğrudan ilgili kadranlara işlenmelidir.
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
${originalProposal}
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
        FLASH_38,
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
  const prompt = `<proposal>\n${proposalText}\n</proposal>\nYukarıdaki tez önerisi metninin tamamını yönergeler doğrultusunda analiz ederek 4 kadranlı akademik tez matrisini üret.`;

  return generateGeminiStructuredContent<ThesisMatrix>(
    FLASH_38,
    universalDecompositionSystemInstruction,
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

