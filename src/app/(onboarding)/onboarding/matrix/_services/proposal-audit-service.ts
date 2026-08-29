import { z } from "zod";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import type { Logger } from "@/lib/logger";
import { searchExa, type ExaSearchResult } from "@/core/services/exa";
import { searchTheses } from "@/core/services/thesis-search";
import { searchOpenAlex } from "@/app/(onboarding)/onboarding/literature-review/_services/openalex/openalex-search";
import type { ThesisDetails } from "@/lib/types";
import type { RawPaper } from "@/app/(onboarding)/onboarding/literature-review/_services/literature-review-papers";

/** Schema for multi-angle query decomposition */
export const queryDecompositionSchema = z.object({
  webQueries: z
    .array(z.string().min(3))
    .min(1)
    .max(2)
    .describe(
      "Güncel saha, mevzuat veya DergiPark aramaları için Exa sorguları",
    ),
  thesisQueries: z
    .array(z.string().min(3))
    .min(1)
    .max(2)
    .describe(
      "YÖK tez arşivindeki emsal çalışmalar ve metodolojik desenler için Qdrant sorguları",
    ),
  literatureQueries: z
    .array(z.string().min(3))
    .min(1)
    .max(2)
    .describe(
      "Uluslararası kuramsal tartışmalar ve öncü yazarlar için OpenAlex sorguları",
    ),
});

export type QueryDecomposition = z.infer<typeof queryDecompositionSchema>;

export const queryDecompositionJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    webQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Güncel saha, mevzuat veya DergiPark aramaları için Exa sorguları",
    },
    thesisQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖK tez arşivindeki emsal çalışmalar ve metodolojik desenler için Qdrant sorguları",
    },
    literatureQueries: {
      type: "array",
      items: { type: "string" },
      description:
        "Uluslararası kuramsal tartışmalar ve öncü yazarlar için OpenAlex sorguları",
    },
  },
  required: ["webQueries", "thesisQueries", "literatureQueries"],
};

/** Individual search chip visible in UI */
export interface SearchChip {
  id: string;
  query: string;
  channel: "web" | "thesis" | "literature";
  label: string;
  resultCount: number;
}

/** Clarification question for user */
export interface AuditQuestion {
  id: string;
  category:
    | "scope"
    | "focus"
    | "ambiguity"
    | "methodology"
    | "theoretical"
    | "empirical";
  categoryLabel: string;
  question: string;
  contextNote: string;
}

/** Full result of the proposal audit phase */
export interface ProposalAuditResult {
  searchChips: SearchChip[];
  evidenceSummary: string;
  strengths: string;
  diagnosticCritique: string;
  questions: AuditQuestion[];
}

const auditOutputSchema = z.object({
  strengths: z
    .string()
    .min(10)
    .describe(
      "Tez önerisinin güçlü, özgün ve isabetli taraflarını belirten 1-2 cümle",
    ),
  diagnosticCritique: z
    .string()
    .min(10)
    .describe(
      "Önerinin kuramsal veya yöntemsel çerçevesine dair nesnel ve yapıcı tespit",
    ),
  questions: z
    .array(
      z.object({
        id: z.string(),
        category: z.enum(["scope", "focus", "ambiguity", "methodology"]),
        categoryLabel: z.string(),
        question: z.string().min(15),
        contextNote: z.string(),
      }),
    )
    .max(2)
    .describe(
      "Yalnızca kapsam veya odak tercihi gerekiyorsa en fazla 2 soru; metin yeterince netse kesinlikle boş dizi []",
    ),
});

const auditOutputJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    strengths: { type: "string" },
    diagnosticCritique: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          category: {
            type: "string",
            enum: ["scope", "focus", "ambiguity", "methodology"],
          },
          categoryLabel: { type: "string" },
          question: { type: "string" },
          contextNote: { type: "string" },
        },
        required: [
          "id",
          "category",
          "categoryLabel",
          "question",
          "contextNote",
        ],
      },
    },
  },
  required: ["strengths", "diagnosticCritique", "questions"],
};

/**
 * Stage 1: Decomposes the user's raw proposal into multi-angle search queries.
 */
async function decomposeProposalToQueries(
  proposalText: string,
  log: Logger,
): Promise<QueryDecomposition> {
  const systemInstruction = `<role>
Kıdemli Tez Danışmanı ve Araştırma Metodoloğu.
Göreviniz: Araştırmacının sunduğu tez önerisi metnini analiz edip, çalışmayı 3 farklı cepheden (Web, YÖK Tezleri, Uluslararası Literatür) denetleyecek toplam 4-5 adet odaklanmış akademik arama sorgusu türetmektir.
</role>

<instructions>
1. webQueries: Güncel saha verilerini, Türkiye bağlamını, sektörel raporları veya son mevzuat değişikliklerini hedefleyen 1 veya 2 doğal dil sorgusu (Türkçe).
2. thesisQueries: YÖK Ulusal Tez Merkezinde daha önce benzer konularda hangi yöntemlerin, örneklemlerin ve kavramların kullanıldığını tarayacak 1 veya 2 akademik tez sorgusu (Türkçe).
3. literatureQueries: Uluslararası literatürdeki kuramsal tartışmaları ve metodolojik modelleri tarayacak 1 veya 2 sorgu (İngilizce).
Tırnak işaretleri, bool operatörler veya aşırı genel kelimeler kullanmayın.
</instructions>`;

  return generateGeminiStructuredContent<QueryDecomposition>(
    FLASH_LITE_35,
    systemInstruction,
    `<context>\n${proposalText.slice(0, 8000)}\n</context>\nYukarıdaki tez önerisi için çok açılı arama sorgularını üret.`,
    queryDecompositionJsonSchema,
    log,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      zodSchema: queryDecompositionSchema,
      seed: GEMINI_SEED,
      payloadStage: "proposal_decomposition",
      quiet: true,
    },
  );
}

import { PipelineRun } from "@/lib/pipeline-logger";
import { PROPOSAL_AUDIT_PIPELINE } from "@/lib/pipeline-definitions";

/**
 * Runs multi-angle grounded search and produces a deep academic diagnostic audit with 2-3 targeted questions.
 *
 * @param proposalText - The raw thesis proposal or outline provided by the user.
 * @returns The complete audit result with chips, critique, and questions.
 */
export async function auditThesisProposal(
  proposalText: string,
): Promise<ProposalAuditResult> {
  const run = PipelineRun.create(PROPOSAL_AUDIT_PIPELINE);

  // Step 1: Decompose queries
  const queries = await run.execute(
    "decompose",
    () => decomposeProposalToQueries(proposalText, run.logger),
    { description: "Gemini Flash" },
  );

  // Step 2: Run all searches in parallel via Promise.all
  const [webResultsArray, thesisResultsArray, litResultsArray] =
    await run.execute("discovery", async () => {
      const [web, theses, lit] = await Promise.all([
        (async () => {
          const t0 = performance.now();
          const res = await Promise.all(
            queries.webQueries.map((q) =>
              searchExa(q, { numResults: 3 }).catch(
                () => [] as ExaSearchResult[],
              ),
            ),
          );
          run.subStep(
            `Exa (x${queries.webQueries.length})`,
            performance.now() - t0,
          );
          return res;
        })(),
        (async () => {
          const t0 = performance.now();
          const res = await Promise.all(
            queries.thesisQueries.map((q) =>
              searchTheses(q, run.logger, {
                limit: 3,
                rankingScoreThreshold: 0.55,
                silent: true,
              }).catch(() => [] as ThesisDetails[]),
            ),
          );
          run.subStep(
            `Vector Search (x${queries.thesisQueries.length})`,
            performance.now() - t0,
          );
          return res;
        })(),
        (async () => {
          const t0 = performance.now();
          const res = await Promise.all(
            queries.literatureQueries.map((q) =>
              searchOpenAlex(q, 3).catch(() => [] as RawPaper[]),
            ),
          );
          run.subStep(
            `OpenAlex (x${queries.literatureQueries.length})`,
            performance.now() - t0,
          );
          return res;
        })(),
      ]);
      return [web, theses, lit];
    });

  // Build UI Search Chips
  const searchChips: SearchChip[] = [];

  queries.webQueries.forEach((q, idx) => {
    const count = webResultsArray[idx]?.length ?? 0;
    searchChips.push({
      id: `web-${idx}`,
      query: q,
      channel: "web",
      label: "Web & Rapor",
      resultCount: count,
    });
  });

  queries.thesisQueries.forEach((q, idx) => {
    const count = thesisResultsArray[idx]?.length ?? 0;
    searchChips.push({
      id: `thesis-${idx}`,
      query: q,
      channel: "thesis",
      label: "YÖK Tez Arşivi",
      resultCount: count,
    });
  });

  queries.literatureQueries.forEach((q, idx) => {
    const count = litResultsArray[idx]?.length ?? 0;
    searchChips.push({
      id: `lit-${idx}`,
      query: q,
      channel: "literature",
      label: "Uluslararası Literatür",
      resultCount: count,
    });
  });

  // Synthesize evidence context text for Gemini 3.7
  const evidenceLines: string[] = [];

  webResultsArray.forEach((results, qIdx) => {
    evidenceLines.push(
      `[Web Arama ${qIdx + 1}: "${queries.webQueries[qIdx]}"]`,
    );
    results.forEach((r) => {
      evidenceLines.push(
        `- ${r.title} (${r.url}): ${(r.highlights ?? []).slice(0, 2).join(" ")}`,
      );
    });
  });

  thesisResultsArray.forEach((results, qIdx) => {
    evidenceLines.push(
      `[YÖK Tez Araması ${qIdx + 1}: "${queries.thesisQueries[qIdx]}"]`,
    );
    results.forEach((t) => {
      evidenceLines.push(
        `- Başlık: ${t.title} | Üniversite: ${t.university ?? "Belirtilmemiş"} (${t.year ?? "Yıl Yok"}) | Özet: ${(t.abstract ?? "").slice(0, 250)}...`,
      );
    });
  });

  litResultsArray.forEach((results, qIdx) => {
    evidenceLines.push(
      `[Uluslararası Literatür ${qIdx + 1}: "${queries.literatureQueries[qIdx]}"]`,
    );
    results.forEach((p) => {
      evidenceLines.push(
        `- Başlık: ${p.title ?? "İsimsiz"} | Atıf: ${p.citedByCount ?? 0} | Yazarlar: ${(p.authors ?? []).slice(0, 3).join(", ")}`,
      );
    });
  });

  const evidenceSummary = evidenceLines.join("\n");

  // Step 3: Run academic diagnostic audit using Gemini 3.5 Flash Lite
  const auditSystemInstruction = `<role>
Tez danışmanlığı ve araştırma tasarımı konusunda uzman, deneyimli bir akademisyensiniz.
Kullanıcı size bir tez önerisi / taslak metin sunmuştur. Ayrıca arama ajanlarımız bu öneriyle ilgili web'den, 366.000 YÖK tez arşivinden ve uluslararası literatürden kanıtlar derlemiştir.

Göreviniz:
1. Araştırmacının önerisini kanıtlarla karşılaştırmak.
2. Önerinin güçlü, özgün ve isabetli gördüğün yönünü nesnel olarak belirtmek.
3. Varsa temel araştırma çerçevesindeki kapsam veya kuram dengesini yapıcı şekilde teşhis etmek.
4. YALNIZCA GEREKİYORSA araştırmacıya en fazla 2 (gerekmiyorsa 0) adet netleştirme sorusu yöneltmektir.
</role>

<instructions>
# Temel İlke ve Soru Sorma Disiplini (KRİTİK)
- Araştırmacı henüz YOLUN BAŞINDADIR (öneri/taslak aşaması). Henüz literatür taraması, arşiv çalışması veya veri toplama süreci YAPILMAMIŞTIR.
- Bu nedenle araştırmacıdan henüz okumadığı literatürün, açmadığı arşivin, toplamadığı verinin veya henüz tasarlamadığı analiz adımlarının hesabını sormak KESİNLİKLE YASAKTIR.

# Kesinlikle Yasak Olan Soru Tipleri:
1. Erken Aşama Yöntem/Kodlama Sorguları: "Hangi kodlama stratejisini izleyeceksiniz?", "Metinleri nasıl kategorize edeceksiniz?", "Analiz şablonunuz nedir?" gibi henüz veriyi görmeden bilinemeyecek sorular ASLA SORULMAYACAKTIR.
2. Değişken/Nedensellik Kontrolü Hesapları: "X dışsal etkisini nasıl kontrol edeceksiniz?", "Y etkenini analizinizde nasıl izole edeceksiniz?" gibi tezin araştırma sorusu olan hususlar önkoşul gibi ASLA SORULMAYACAKTIR.
3. Didaktik Vaaz ve Uyarılar: "Şunu unutmamalısınız", "Şuna dikkat etmeniz gerekir" gibi didaktik, yukarıdan bakan jüri nasihatleri veya uyarıları KESİNLİKLE VERİLMEYECEKTİR.
4. Sırf soru sormuş olmak için soru üretmek KESİNLİKLE YASAKTIR.

# İzin Verilen Yegane Soru Tipleri (Pratik Kapsam ve Odak Tercihi):
- Yalnızca araştırmacının literatür taramasına başlarken işini kolaylaştıracak PRATİK KAPSAM ve ODAK tercihleri sorulabilir:
  * Zaman/dönem aralığı çok genişse: Literatür taramasına başlarken odaklanmak istediği özel bir alt dönem/kırılma olup olmadığı.
  * Karşılaştırılan aktör, kurum veya vaka sayısı çok fazlaysa: Öncelik vermek istediği birincil bir odak olup olmadığı.
  * Metinde araştırmanın anlaşılmasını engelleyen bariz bir mantık çelişkisi veya kavramsal kapalılık varsa bunun netleştirilmesi.
- EĞER METİN ZATEN TUTARLI, ODAKLI VE NETSE HİÇBİR SORU SORMAYIN (questions dizisi kesinlikle boş [] olmalıdır).

# Dil ve Üslup Kuralları (ZORUNLU)
- Kesinlikle doğal, duru, yaşayan ve akıcı bir Türkçe kullanın.
- Ağdalı, yapay, çeviri kokan akademik jargondan ve plaza/beyaz yaka dilinden kesinlikle kaçının.
- 'Korpus', 'nötralize etmek', 'operasyonelleştirmek', 'rezonans', 'aksiyom', 'konsolidasyon', 'interdiscursivity' gibi yapay veya yabancı kelimeleri KESİNLİKLE KULLANMAYIN:
  * 'Korpus' yerine: 'metinler', 'yazılı kaynaklar', 'arşiv', 'belge grubu' veya 'veri kümesi'.
  * 'Nötralize etmek' yerine: 'etkisini gidermek', 'dengelemek', 'kontrol altına almak' veya 'aşmak'.
  * 'Operasyonelleştirmek' yerine: 'somutlaştırmak', 'uygulamaya dökmek' veya 'ölçülebilir kılmak'.
- contextNote alanı didaktik bir uyarı veya nasihat içermemelidir; yalnızca sorunun pratik gerekçesini belirten tek bir nesnel cümle olmalıdır.
- Üslup; saygılı, yapıcı, araştırmacının omuzundaki yükü hafifleten, berrak bir yol arkadaşı gibi olmalıdır.
</instructions>`;

  const auditPrompt = `<proposal>
${proposalText.slice(0, 10000)}
</proposal>

<search_evidence>
${evidenceSummary}
</search_evidence>

Yukarıdaki tez önerisini ve taranan kanıtları inceleyerek güçlü yönleri ve teşhisi belirle; yalnızca gerekliyse (kapsam/odak daraltması gerekiyorsa) en fazla 2 netleştirme sorusu üret, metin yeterince netse questions dizisini boş [] bırak.`;

  // Step 3: Run academic diagnostic audit using Gemini 3.5 Flash Lite
  const auditResponse = await run.execute(
    "critique",
    () =>
      generateGeminiStructuredContent<z.infer<typeof auditOutputSchema>>(
        FLASH_LITE_35,
        auditSystemInstruction,
        auditPrompt,
        auditOutputJsonSchema,
        run.logger,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          zodSchema: auditOutputSchema,
          seed: GEMINI_SEED,
          payloadStage: "proposal_audit_critique",
          quiet: true,
        },
      ),
    { description: "Gemini Flash" },
  );

  run.finish();

  return {
    searchChips,
    evidenceSummary,
    strengths: auditResponse.strengths,
    diagnosticCritique: auditResponse.diagnosticCritique,
    questions: auditResponse.questions,
  };
}
