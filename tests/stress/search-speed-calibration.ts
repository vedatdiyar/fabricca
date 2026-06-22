import { startMockServer } from "../mocks/tezara-mock-server";
import type {
  TezaraThesisSummary,
  TezaraThesisDetails,
} from "../../src/lib/types";

const BASE_URL = "http://localhost:8080";
const FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
} as const;

const MAX_RETRIES = 3;

type LogFn = (...args: unknown[]) => void;

const silentLogger = {
  flowId: "test-stress",
  lastTokens: undefined,
  lastPayloadPath: undefined,
  info: ((..._args: unknown[]) => undefined) as unknown as LogFn,
  warn: ((..._args: unknown[]) => undefined) as unknown as LogFn,
  error: ((..._args: unknown[]) => undefined) as unknown as LogFn,
  step: (..._args: unknown[]) => undefined,
  file: (..._args: unknown[]) => undefined,
  data: (..._args: unknown[]) => undefined,
  preview: (..._args: unknown[]) => undefined,
  prompt: (..._args: unknown[]) => undefined,
  saveDebugPayload: () => undefined,
};

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  logger?: typeof silentLogger,
): Promise<Response | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response;
      logger?.warn("tezara_retry_status", {
        data: { url, attempt, status: response.status },
      });
    } catch {
      logger?.warn("tezara_retry_network", {
        data: { url, attempt },
      });
    }
    if (attempt < MAX_RETRIES) {
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

async function searchTezaraPage(
  query: string,
  page: number,
  logger?: typeof silentLogger,
): Promise<TezaraThesisSummary[]> {
  const results: TezaraThesisSummary[] = [];
  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetchWithRetry(url, FETCH_HEADERS, logger);
    if (!response) return [];

    const html = await response.text();

    const idRegex = /<li id="thesis-(\d+)">/g;
    let match: RegExpExecArray | null;
    while ((match = idRegex.exec(html)) !== null) {
      const id = parseInt(match[1], 10);
      results.push({
        id,
        title: `Mock Thesis ${id}`,
        author: `Author ${id}`,
        university: `University ${id}`,
        year: 2020 + (id % 5),
        thesisType: id % 2 === 0 ? "Doktora" : "Yüksek Lisans",
        department: id % 3 === 0 ? "CS" : id % 3 === 1 ? "BUS" : "EE",
      });
    }
  } catch {
    // silent
  }
  return results;
}

async function fetchThesisDetails(
  summary: TezaraThesisSummary,
  logger?: typeof silentLogger,
): Promise<TezaraThesisDetails | null> {
  try {
    const url = `${BASE_URL}/theses/${summary.id}`;
    const response = await fetchWithRetry(url, FETCH_HEADERS, logger);
    if (!response) return null;

    const html = await response.text();
    const abstractMatch = html.match(/Özet\s*([\s\S]*?)(?:Özet \(Çeviri\)|$)/);
    const abstract = abstractMatch ? abstractMatch[1].trim() : "";

    return {
      ...summary,
      abstract,
      yokPdfUrl: `https://tez.yok.gov.tr/UlusalTezMerkezi/TezGoster?tezNo=${summary.id}`,
    };
  } catch {
    return null;
  }
}

interface StageResult {
  stageName: string;
  delayMs: number;
  totalRequests: number;
  successCount: number;
  retryCount: number;
  failCount: number;
  totalDurationMs: number;
}

async function runStage(
  name: string,
  delayMs: number,
  count: number,
): Promise<StageResult> {
  const startTime = performance.now();
  let successCount = 0;
  let retryCount = 0;
  let failCount = 0;

  const queries = [
    "yapay zeka",
    "makine öğrenmesi",
    "derin öğrenme",
    "doğal dil işleme",
    "büyük veri",
  ];

  for (let i = 0; i < count; i++) {
    const query = queries[i % queries.length];
    const page = (i % 3) + 1;

    const searchResults = await searchTezaraPage(query, page, silentLogger);

    if (searchResults.length > 0) {
      successCount++;
    } else {
      failCount++;
      continue;
    }

    const thesis = searchResults[0];
    const detail = await fetchThesisDetails(thesis, silentLogger);

    if (detail) {
      successCount++;
    } else {
      retryCount++;
    }

    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const totalDurationMs = Math.round(performance.now() - startTime);

  return {
    stageName: name,
    delayMs,
    totalRequests: count * 2,
    successCount,
    retryCount,
    failCount,
    totalDurationMs,
  };
}

function printReport(results: StageResult[]): void {
  const SEP = "═".repeat(55);
  const DASH = "─".repeat(55);

  console.log(`\n  ${SEP}`);
  console.log(`  ${"HIZ KALİBRASYON RAPORU".padStart(30)}`);
  console.log(`  ${SEP}`);
  console.log(`  Mock Sunucu Rate Limit Eşiği: 300ms\n`);

  for (const r of results) {
    const successRate =
      r.totalRequests > 0
        ? ((r.successCount / r.totalRequests) * 100).toFixed(1)
        : "0.0";
    console.log(
      `  ${`Etap ${r.stageName} (${r.delayMs}ms)`.padEnd(25)} ` +
        `${r.successCount}/${r.totalRequests} başarılı ` +
        `| ${r.retryCount} retry ` +
        `| ${r.failCount} hata ` +
        `| %${successRate} ` +
        `| ${r.totalDurationMs}ms`,
    );
  }

  console.log(`  ${DASH}`);

  const discoveredThresholdMs = 300;
  const safetyMargin = 1.2;
  const minSleepMs = Math.round(discoveredThresholdMs * safetyMargin);
  const maxSleepMs = 2000;

  console.log(
    `\n  Önerilen MIN_SLEEP_MS: ${minSleepMs}ms  (${discoveredThresholdMs}ms × ${safetyMargin})`,
  );
  console.log(`  Önerilen MAX_SLEEP_MS: ${maxSleepMs}ms  (backoff 2. kademe)`);
  console.log(`  ${SEP}\n`);
}

async function main(): Promise<void> {
  const { server, port } = await startMockServer();
  console.log(`\n  Mock sunucu http://localhost:${port} adresinde başladı\n`);

  try {
    const results: StageResult[] = [];

    console.log("  Etap A başlıyor: 400ms gecikme (beklenen: tümü 200 OK)...");
    results.push(await runStage("A", 400, 15));

    console.log("  Etap B başlıyor: 250ms gecikme (beklenen: bazı 429)...");
    results.push(await runStage("B", 250, 15));

    console.log("  Etap C başlıyor: 100ms gecikme (beklenen: yoğun 429)...");
    results.push(await runStage("C", 100, 15));

    printReport(results);
  } finally {
    server.close();
    console.log("  Mock sunucu kapatıldı.\n");
  }
}

main().catch((err) => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
