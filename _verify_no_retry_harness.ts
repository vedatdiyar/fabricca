import fs from "fs";
import path from "path";
import { parse as dotenvParse } from "dotenv";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import { getGeminiKeyPool, getProjectIndex } from "@/services/ai/gemini-key-pool";
import {
  createConcurrencyLimiter,
  type ConcurrencyLimiter,
} from "@/lib/rate-limiter";
import { Logger, createFlowId } from "@/lib/logger";
import { buildPerThesisEvaluationPromptPayload } from "@/features/positioning/prompts/per-thesis-evaluation.prompt";
import { perThesisEvaluationJsonSchema } from "@/features/positioning/per-thesis-evaluation";
import type { PositioningMatrixInput } from "@/features/positioning/validation";
import type { SiftedThesis } from "@/features/positioning/sifting";

const RAW_DIR =
  "/private/var/folders/1t/zvkspc6x0fb44kwlhmbn_32c0000gn/T/opencode";

for (const [key, value] of Object.entries(
  dotenvParse(fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8")),
)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

process.env.NODE_ENV = "production";

const captured = new Array<Record<string, unknown>>();

function captureAllConsole() {
  for (const method of ["log", "info", "warn", "error"] as const) {
    const original = console[method].bind(console);
    (console as unknown as Record<string, unknown>)[method] = (
      ...args: unknown[]
    ) => {
      for (const arg of args) {
        if (typeof arg === "string" && arg.startsWith("{")) {
          try {
            const parsed = JSON.parse(arg);
            if (parsed && typeof parsed === "object" && "event" in parsed) {
              captured.push(parsed);
            }
          } catch {
            /* not JSON */
          }
        }
      }
      return original(...args);
    };
  }
}

const INPUT: PositioningMatrixInput = {
  subjectProblem:
    "1991-1999 döneminde Kürt Özgürlük Hareketi'nin söylemsel dönüşümünü manevra ve mevzi savaşı bağlamında PKK ve HEP-DEP-HADEP partiler hattı üzerinden inceler.",
  theoreticalFramework:
    "Kritik söylem çözümlemesi ve manevra/mevzi savaşı kavramları çerçevesinde söylemsel dönüşüm kavramsallaştırılır.",
  methodology:
    "Yasal parti söylemi ve silahlı kanat bildirilerine karşılaştırmalı nitel söylem analizi uygulanır.",
};

function makeThesis(idx: number): SiftedThesis {
  const titles = [
    "Kürt Siyasal Hareketinin Söylemsel Dönüşümü",
    "1990-2000 Döneminde Yasal Kürt Partileri",
    "Manevra Savaşı Bağlamında Siyasal İslam",
    "Mezopotamya'da Ulusal Kimlik İnşası",
    "Devlet ve Kürt Hareketi Arasında Müzakere",
    "Kürdistan İşçi Partisi'nin Dönemsel Stratejileri",
    "Yasal Siyaset ve Silahlı Mücadele Gerilimi",
    "Kürt Meselesinde Çatışma ve Çözüm Denemeleri",
    "Ortadoğu'da Etnik Mobilizasyon",
    "Türkiye'de Söylem ve Siyasal Şiddet",
  ];
  const title = titles[idx % titles.length];
  return {
    id: 1_000_000 + idx,
    title,
    author: "Test Yazar " + (idx + 1),
    university: "Test Üniversitesi",
    year: 1985 + (idx % 25),
    thesisType: idx % 2 === 0 ? "Doktora" : "Yüksek Lisans",
    department: "Siyaset Bilimi",
    language: "tr",
    abstract:
      title +
      " konusunda 1990'lı yılların Türkiye siyasetindeki aktörler, partiler ve hareketler arası ilişkilerin söylemsel ve kurumsal boyutlarını karşılaştırmalı olarak ele alan, birincil kaynaklara dayalı akademik bir değerlendirme sunar.",
    relevanceScore: 1 - idx / 100,
  };
}

interface KeySendTracker {
  firstSentAt: number | null;
  count: number;
}

const keySendTrackers = new Map<number, KeySendTracker>();

function trackSend(projectIndex: number): { seq: number; offsetMs: number } {
  const t = keySendTrackers.get(projectIndex) ?? {
    firstSentAt: null,
    count: 0,
  };
  const now = Date.now();
  if (t.firstSentAt === null) t.firstSentAt = now;
  t.count += 1;
  keySendTrackers.set(projectIndex, t);
  return { seq: t.count, offsetMs: now - t.firstSentAt };
}

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

interface RequestResult {
  projectIndex: number;
  seq: number;
  sendOffsetMs: number;
  durationMs: number;
  status: string;
  is429: boolean;
  thesisId: number;
}

const results: RequestResult[] = [];

/**
 * EXACT single-attempt replica of the production Gemini call — same payload
 * object shape as generateStructuredContent (config, responseJsonSchema,
 * safetySettings, seed, thinkingConfig) but the SDK call runs exactly ONCE:
 * no withRetry, no backtracking. maxRetries is reported as 0.
 */
async function evaluateSingleNoRetry(
  input: PositioningMatrixInput,
  thesis: SiftedThesis,
  apiKey: string,
  logger: Logger,
): Promise<string> {
  const payload = buildPerThesisEvaluationPromptPayload(input, thesis);
  const projectIndex = getProjectIndex(apiKey) + 1;
  const modelName = FLASH_LITE_31;
  const { seq, offsetMs } = trackSend(projectIndex);
  const startedAt = Date.now();

  logger?.info("ai_attempt", {
    service: "gemini",
    filePath: "src/services/ai/providers/gemini-provider.ts",
    data: {
      attempt: 1,
      maxRetries: 0,
      projectIndex,
      model: modelName,
      retried: false,
      seqInKey: seq,
      msSinceFirstKeyRequest: offsetMs,
    },
  });

  const geminiPayload = {
    model: modelName,
    contents: [{ role: "user", parts: [{ text: payload.userPrompt }] }],
    config: {
      systemInstruction: payload.systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: perThesisEvaluationJsonSchema,
      thinkingConfig: { thinkingLevel: "LOW" },
      seed: GEMINI_SEED,
      safetySettings: SAFETY_SETTINGS,
    },
  };

  try {
    const response = await getGeminiClient(apiKey).models.generateContent(
      geminiPayload,
    );
    const durationMs = Date.now() - startedAt;
    const status = response.text ? "OK" : "EMPTY_RESPONSE";
    results.push({
      projectIndex,
      seq,
      sendOffsetMs: offsetMs,
      durationMs,
      status,
      is429: false,
      thesisId: thesis.id,
    });
    return response.text ?? "";
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const code = (error as { code?: number })?.code;
    const errorStatus = (error as { status?: string })?.status;
    const is429 = code === 429 || errorStatus === "RESOURCE_EXHAUSTED";
    const statusLabel = is429
      ? "429 (RESOURCE_EXHAUSTED)"
      : `${errorStatus ?? code ?? ""}_${error instanceof Error ? error.name : "UNKNOWN"}`;

    logger?.error("positioning_per_thesis_evaluation_failed", {
      service: "gemini",
      filePath: "src/services/ai/providers/gemini-provider.ts",
      durationMs,
      data: {
        model: modelName,
        projectIndex,
        crossProjectRotation: false,
        attempts: 1,
        thinkingLevel: "LOW",
        scenario: is429 ? "quota" : "system",
      },
      error,
    });

    results.push({
      projectIndex,
      seq,
      sendOffsetMs: offsetMs,
      durationMs,
      status: statusLabel,
      is429,
      thesisId: thesis.id,
    });

    throw new Error(`HTTP ${code}: ${errorStatus ?? errorStatus}`);
  }
}

const clients = new Map<string, GoogleGenAI>();

function getGeminiClient(apiKey: string): GoogleGenAI {
  const cached = clients.get(apiKey);
  if (cached) return cached;
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
  clients.set(apiKey, client);
  return client;
}

async function main() {
  captureAllConsole();
  const logger = new Logger(createFlowId());
  const theses = Array.from({ length: 35 }, (_, i) => makeThesis(i));
  const apiKeys = getGeminiKeyPool().keys;
  const t0 = Date.now();

  console.info(
    JSON.stringify({
      event: "verify_harness_start",
      model: FLASH_LITE_31,
      keyCount: apiKeys.length,
      thesisCount: theses.length,
      concurrencyPerKey: 8,
      retriesDisabled: true,
    }),
  );

  const limiterByKey = new Map<string, ConcurrencyLimiter>();
  for (const apiKey of apiKeys) {
    limiterByKey.set(apiKey, createConcurrencyLimiter(8));
  }

  const settled = await Promise.allSettled(
    theses.map((thesis, idx) => {
      const assignedKey = apiKeys[idx % apiKeys.length];
      const limiter = limiterByKey.get(assignedKey)!;
      const task = () =>
        evaluateSingleNoRetry(INPUT, thesis, assignedKey, logger);
      return limiter
        .exec(task)
        .then(
          (value) => value as unknown,
          async (reason) => {
            logger.error("positioning_per_thesis_single_failed", {
              service: "positioning",
              filePath: "src/features/positioning/per-thesis-evaluation.ts",
              data: {
                thesisId: thesis.id,
                thesisTitle: thesis.title,
              },
              error: reason,
            });
            throw reason;
          },
        );
    }),
  );

  const elapsedMs = Date.now() - t0;

  const perKeyTables = new Map<number, RequestResult[]>();
  for (const r of results) {
    const list = perKeyTables.get(r.projectIndex) ?? [];
    list.push(r);
    perKeyTables.set(r.projectIndex, list);
  }

  const summary: Record<string, unknown> = {
    event: "verify_harness_summary",
    elapsedMs,
    totalRequests: results.length,
    okCount: results.filter((r) => r.status === "OK").length,
    rateLimited429: results.filter((r) => r.is429).length,
    otherFailed: results.filter((r) => r.status !== "OK" && !r.is429).length,
    perKey: Array.from(perKeyTables.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([projectIndex, list]) => {
        const sorted = [...list].sort((a, b) => a.seq - b.seq);
        const first429 = sorted.find((r) => r.is429);
        return {
          projectIndex,
          totalSent: sorted.length,
          order: sorted.map((r) => ({
            seq: r.seq,
            sendOffsetMs: r.sendOffsetMs,
            status: r.status,
            is429: r.is429,
          })),
          first429Seq: first429?.seq ?? null,
          requestsSentByThen: first429 ? first429.seq : null,
        };
      }),
    fulfilled:
      settled.filter((s) => s.status === "fulfilled").length,
    rejected: settled.filter((s) => s.status === "rejected").length,
  };

  console.info(JSON.stringify(summary));

  fs.writeFileSync(
    path.join(RAW_DIR, "rpm-no-retry-raw.log"),
    captured.map((e) => JSON.stringify(e)).join("\n"),
  );
  fs.writeFileSync(
    path.join(RAW_DIR, "rpm-no-retry-summary.json"),
    JSON.stringify(summary, null, 2),
  );
}

main().catch((e) => {
  console.error("verify_harness_crashed", e);
  process.exit(1);
});