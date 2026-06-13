/**
 * Development-only görsel log renderer'ları ve dev state yönetimi.
 *
 * Bu modül yalnızca `process.env.NODE_ENV === "development"` durumunda
 * aktif olur. Production'da içe aktarılmasına rağmen hiçbir kodu çalışmaz
 * (Logger.write() erken return eder).
 */

import chalk from "chalk";
import type { LogLevel, LogEvent, LogParams } from "./logger";

// ============================================================================
// Dev Types
// ============================================================================

/** Development modundayken bir adım için tutulan kayıt */
interface DevStepRecord {
  step: string;
  event: LogEvent;
  durationMs: number;
  timestamp: number;
}

/** Development modundayken bir arama sorgusu için tutulan kayıt */
interface DevSearchEntry {
  query: string;
  resultCount: number;
  durationMs: number;
  page?: number;
}

/** Development modunda flow başına biriktirilen istatistikler */
interface DevFlowStats {
  startTime: number;
  service: string;
  aiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  thinkingTokens: number;
  steps: DevStepRecord[];
  slowestStep: DevStepRecord | null;
  searchResults: {
    tavily: DevSearchEntry[];
    tezara: DevSearchEntry[];
  };
  selectedFinalIds?: number[];
  uniqueFilterCount?: number;
  stepCallCount: Record<string, number>;
  rawCount?: number;
  stage1SelectedCount?: number;
  stage2ValidDetailsCount?: number;
  stage2FinalCount?: number;
  reportDbDurationMs?: number;
  reportDbStatus?: "success" | "failed";
}

// ============================================================================
// Global State
// ============================================================================

const devStatsMap = new Map<string, DevFlowStats>();

/** Önceki flow'larda seçilen final ID'leri (← yeni karşılaştırması için) */
const previousFinalIdsMap = new Map<string, number[]>();

// ============================================================================
// Constants
// ============================================================================

const BOX_INNER_WIDTH = 97;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Çağrı yığınını (call stack) dolaşarak logger.ts dışındaki
 * ilk kullanıcı koduna ait dosya:satır bilgisini döndürür.
 *
 * @returns "src/app/(auth)/onboarding/risk/_services/sifting.ts:184" formatında konum
 */
function getCallerLocation(): string {
  const stack = new Error().stack;
  if (!stack) return "unknown";

  const lines = stack.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "Error") continue;
    if (trimmed.includes("logger.ts")) continue;
    if (trimmed.includes("node:internal")) continue;
    if (trimmed.includes("node_modules")) continue;

    const match = trimmed.match(
      /\(?([a-zA-Z0-9_\-./\\]+\.(?:ts|tsx|js|jsx)):(\d+):\d+\)?$/,
    );
    if (match) {
      const filePath = match[1];
      if (!filePath.includes("(")) {
        return `${filePath}:${match[2]}`;
      }
    }
  }
  return "unknown";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Box Drawing Primitives
// ============================================================================

function drawTopBorder(color: chalk.Chalk): string {
  return color(`╔${"═".repeat(BOX_INNER_WIDTH)}╗`);
}

function drawBottomBorder(color: chalk.Chalk): string {
  return color(`╚${"═".repeat(BOX_INNER_WIDTH)}╝`);
}

function drawContentLine(text: string, clr: chalk.Chalk = chalk.reset): string {
  const inner = ` ${text}`;
  const padding = Math.max(0, BOX_INNER_WIDTH - inner.length);
  return clr(`║${inner}${" ".repeat(padding)}║`);
}

// ============================================================================
// Visual Renderers
// ============================================================================

function renderErrorBox(
  message: string,
  location: string,
  flowId: string,
  step?: string,
  callCount?: number,
): string {
  const clr = chalk.red;
  const lines: string[] = [];
  lines.push(drawTopBorder(clr));
  lines.push(drawContentLine(chalk.bold.red("💥 ERROR DETECTED"), clr));
  lines.push(drawContentLine("", clr));
  lines.push(
    drawContentLine(chalk.bold("Flow ID:  ") + chalk.cyan(flowId), clr),
  );
  if (step) {
    let stepLabel = `Step:     ${step}`;
    if (callCount !== undefined && callCount > 1) {
      stepLabel += chalk.gray(`  [Çağrı: ${callCount}]`);
    }
    lines.push(drawContentLine(stepLabel, clr));
  }
  lines.push(drawContentLine("", clr));
  lines.push(
    drawContentLine(chalk.bold("Message:  ") + chalk.red(message), clr),
  );
  lines.push(drawContentLine("", clr));
  lines.push(
    drawContentLine(chalk.bold("Location: ") + chalk.gray(location), clr),
  );
  lines.push(drawBottomBorder(clr));
  return lines.join("\n");
}

function renderFlowStartBox(
  service: string,
  step: string | undefined,
  flowId: string,
): string {
  const clr = chalk.cyan;
  const stepText = step ? ` (${step})` : "";
  const title = `FLOW STARTED: ${service}${stepText} — ${flowId}`;
  const lines: string[] = [];
  lines.push(drawTopBorder(clr));
  lines.push(drawContentLine(chalk.bold(title), clr));
  lines.push(drawBottomBorder(clr));
  return lines.join("\n");
}

function renderStepTree(flowId: string, stats: DevFlowStats): string | null {
  const tavily = stats.searchResults.tavily;
  const tezara = stats.searchResults.tezara;
  if (tavily.length === 0 && tezara.length === 0) return null;

  const lines: string[] = [];
  const stepDuration =
    stats.steps.length > 0 ? stats.steps[stats.steps.length - 1].durationMs : 0;

  lines.push(
    chalk.dim(
      `┌─ sifting_stage_1 ${"─".repeat(55)} ${formatDuration(stepDuration)}`,
    ),
  );

  if (tavily.length > 0) {
    const tavilyTotalFacts = tavily.reduce((sum, e) => sum + e.resultCount, 0);
    const tavilyAvgMs =
      tavily.reduce((sum, e) => sum + e.durationMs, 0) / tavily.length;
    lines.push(
      chalk.dim(
        `│  ├─ Tavily:  ${String(tavily.length).padStart(2)} queries → ${tavilyTotalFacts} facts (avg ${formatDuration(tavilyAvgMs)})`,
      ),
    );
  }

  if (tezara.length > 0) {
    const tezaraAvgMs =
      tezara.reduce((sum, e) => sum + e.durationMs, 0) / tezara.length;
    const tezaraTotalRaw =
      stats.rawCount ??
      tezara.reduce((sum, e) => sum + e.resultCount, 0);
    lines.push(
      chalk.dim(
        `│  ├─ Tezara: ${String(tezara.length).padStart(2)} queries → ${tezaraTotalRaw} raw theses (avg ${formatDuration(tezaraAvgMs)})`,
      ),
    );
  }

  const rawCount = stats.rawCount ?? 0;
  const uniqueCount = stats.uniqueFilterCount ?? 0;
  if (rawCount > 0 && uniqueCount > 0) {
    const exactMatchDrop = rawCount - uniqueCount;
    lines.push(
      chalk.dim(
        `│  ├─ Exact Match Drop: ${exactMatchDrop} duplicates`,
      ),
    );
    lines.push(
      chalk.dim(
        `│  └─ Unique Pool: ${uniqueCount} theses`,
      ),
    );
  }

  return lines.join("\n");
}

function renderSelectedThreats(
  ids: number[],
  titles: string[],
  service: string,
  inputPoolSize: number,
): string {
  const lines: string[] = [];
  const prevIds = previousFinalIdsMap.get(service) ?? [];

  lines.push(chalk.dim(`├─ sifting_stage_2 ➔ Deep Abstract Analysis Complete`));

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const title = titles[i] ?? `ID ${id}`;
    const isNew = !prevIds.includes(id);
    const newTag = isNew ? chalk.green(" [← yeni]") : chalk.gray(" [mevcut]");
    lines.push(
      chalk.dim(
        `│  ${String(i + 1).padStart(2)}. ID ${String(id).padEnd(6)} ${title}${newTag}`,
      ),
    );
  }

  const eliminated = inputPoolSize - ids.length;
  const eliminationRate =
    inputPoolSize > 0
      ? ((eliminated / inputPoolSize) * 100).toFixed(2)
      : "0.00";
  lines.push(
    chalk.dim(
      `└─ Elimination: ${inputPoolSize} → ${ids.length} (${eliminationRate}% elendi)`,
    ),
  );

  previousFinalIdsMap.set(service, ids);

  return lines.join("\n");
}

function renderArchiveLine(flowId: string, stats: DevFlowStats): string {
  const dbStatus = stats.reportDbStatus ?? "success";
  const dbDuration = stats.reportDbDurationMs
    ? ` (${formatDuration(stats.reportDbDurationMs)})`
    : "";
  const statusIcon =
    dbStatus === "success" ? chalk.green("✓") : chalk.red("✗");
  return chalk.dim(
    `  🗂️ ${flowId} ➔ read_report ➔ db_${dbStatus}${dbDuration} ${statusIcon}`,
  );
}

function renderSummaryTable(stats: DevFlowStats): string {
  const separator = chalk.gray("─".repeat(98));
  const slowestName = stats.slowestStep
    ? `${stats.slowestStep.step} (${formatDuration(stats.slowestStep.durationMs)})`
    : "—";

  const totalDuration = formatDuration(performance.now() - stats.startTime);

  const lines: string[] = [];
  lines.push("");
  lines.push(separator);
  lines.push(chalk.bold(" ÖZET İSTATİSTİKLER (bu oturum):"));
  lines.push(
    chalk.dim(
      " ┌─────────────────────┬────────────────────────────────────────────┐",
    ),
  );
  lines.push(
    chalk.dim(` │ Süre                │ ${totalDuration.padEnd(42)}│`),
  );
  lines.push(
    chalk.dim(
      ` │ AI Çağrısı          │ ${String(stats.aiCalls).padEnd(42)} runs │`,
    ),
  );
  lines.push(
    chalk.dim(
      ` │ Girdi Token         │ ${String(stats.totalInputTokens).padEnd(42)}│`,
    ),
  );
  lines.push(
    chalk.dim(
      ` │ Çıktı Token         │ ${String(stats.totalOutputTokens).padEnd(42)}│`,
    ),
  );
  lines.push(
    chalk.dim(
      ` │ Toplam Token        │ ${String(stats.totalTokens).padEnd(42)}│`,
    ),
  );
  lines.push(
    chalk.dim(
      ` │ Düşünce Token       │ ${String(stats.thinkingTokens).padEnd(42)}│`,
    ),
  );
  lines.push(chalk.dim(` │ En Yavaş Adım       │ ${slowestName.padEnd(42)}│`));
  lines.push(
    chalk.dim(
      " └─────────────────────┴────────────────────────────────────────────┘",
    ),
  );
  lines.push(separator);

  return lines.join("\n");
}

function renderMiniStep(
  event: LogEvent,
  step: string | undefined,
  durationMs: number | undefined,
): string {
  const stepLabel = step ? `${step} ` : "";
  const dur =
    durationMs !== undefined
      ? chalk.gray(` (${formatDuration(durationMs)})`)
      : "";
  return chalk.dim(`  • ${stepLabel}${event}${dur}`);
}

// ============================================================================
// Dev Stats Updater
// ============================================================================

function updateDevStats(
  flowId: string,
  level: LogLevel,
  event: LogEvent,
  params?: LogParams,
): void {
  let stats = devStatsMap.get(flowId);
  if (!stats) {
    stats = {
      startTime: performance.now(),
      service: params?.service ?? "flow",
      aiCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      thinkingTokens: 0,
      steps: [],
      slowestStep: null,
      searchResults: { tavily: [], tezara: [] },
      stepCallCount: {},
    };
    devStatsMap.set(flowId, stats);
  }

  // Record step if present
  if (params?.step && event !== "flow_start") {
    const stepRecord: DevStepRecord = {
      step: params.step,
      event,
      durationMs: params.durationMs ?? 0,
      timestamp: Date.now(),
    };
    stats.steps.push(stepRecord);
    stats.stepCallCount[params.step] =
      (stats.stepCallCount[params.step] || 0) + 1;

    if (
      params.durationMs !== undefined &&
      (!stats.slowestStep || params.durationMs > stats.slowestStep.durationMs)
    ) {
      stats.slowestStep = stepRecord;
    }
  }

  // Track search results
  if (event === "search_success" && params?.durationMs !== undefined) {
    const query = (params.data?.query as string) ?? "";
    const resultCount =
      (params.data?.resultCount as number) ??
      (params.data?.totalResults as number) ??
      0;
    const page = (params.data?.page as number) ?? undefined;

    if (params.service === "tavily") {
      stats.searchResults.tavily.push({
        query,
        resultCount,
        durationMs: params.durationMs,
      });
    } else if (params.service === "tezara") {
      if (
        params.step !== "deduplicate_and_score" &&
        params.step !== "fetch_details_stage_2_complete"
      ) {
        stats.searchResults.tezara.push({
          query,
          resultCount,
          durationMs: params.durationMs,
          page,
        });
      }
    }
  }

  // Record aggregate sifting metrics from deduplicate step
  if (
    event === "search_success" &&
    params?.step === "deduplicate_and_score"
  ) {
    if (params?.data?.uniqueCount !== undefined) {
      stats.uniqueFilterCount = params.data.uniqueCount as number;
    }
    if (params?.data?.rawCount !== undefined) {
      stats.rawCount = params.data.rawCount as number;
    }
  }

  // Track AI call tokens
  if (
    (event === "ai_request_success" || event === "ai_request_failed") &&
    params?.tokens
  ) {
    stats.aiCalls += 1;

    const thisCallInput = params.tokens.input ?? 0;
    const thisCallOutput = params.tokens.output ?? 0;
    const thisCallRawTotal = params.tokens.total ?? 0;

    stats.totalInputTokens += thisCallInput;
    stats.totalOutputTokens += thisCallOutput;
    stats.totalTokens += thisCallInput + thisCallOutput;
    stats.thinkingTokens += Math.max(
      0,
      thisCallRawTotal - thisCallInput - thisCallOutput,
    );
  }

  // Track AI retry as an AI call attempt
  if (event === "ai_retry_attempt" || event === "ai_low_quality_response") {
    stats.aiCalls += 1;
  }

  // Track stage 1 selected count
  if (
    event === "ai_request_success" &&
    params?.step === "sifting_stage_1_end" &&
    params?.data?.selectedCount !== undefined
  ) {
    stats.stage1SelectedCount = params.data.selectedCount as number;
  }

  // Track valid details count after detail fetch
  if (
    event === "search_success" &&
    params?.step === "fetch_details_stage_2_complete" &&
    params?.data?.successCount !== undefined
  ) {
    stats.stage2ValidDetailsCount = params.data.successCount as number;
  }

  // Track report DB step status
  if (event === "db_success" && params?.step === "read_report") {
    stats.reportDbDurationMs = params.durationMs;
    stats.reportDbStatus = "success";
  }
  if (event === "db_failed" && params?.step === "read_report") {
    stats.reportDbDurationMs = params.durationMs;
    stats.reportDbStatus = "failed";
  }

  // Store final selected IDs and count for diff comparison
  if (
    event === "flow_complete" &&
    params?.step === "sifting_complete"
  ) {
    if (params?.data?.finalIds) {
      stats.selectedFinalIds = params.data.finalIds as number[];
    }
    if (params?.data?.finalCount !== undefined) {
      stats.stage2FinalCount = params.data.finalCount as number;
    }
  }
}

// ============================================================================
// Visual Output Dispatcher
// ============================================================================

function renderVisual(
  flowId: string,
  level: LogLevel,
  event: LogEvent,
  params?: LogParams,
): string | null {
  const stats = devStatsMap.get(flowId);
  if (!stats) return null;

  switch (level) {
    case "error": {
      const err = params?.error;
      const message =
        err instanceof Error
          ? err.message
          : err != null
            ? String(err)
            : "Unknown error";
      const step = params?.step;
      const callCount =
        step && stats.stepCallCount[step]
          ? stats.stepCallCount[step]
          : undefined;
      return renderErrorBox(
        message,
        getCallerLocation(),
        flowId,
        step,
        callCount,
      );
    }
    default: {
      // Atomik arama/DB başlangıçlarını ve tekil success'leri gösterme — özetler yeterli
      if (event === "search_start" || event === "db_start") return null;
      if (
        event === "search_success" &&
        params?.step !== "deduplicate_and_score" &&
        params?.step !== "fetch_details_stage_2_complete"
      ) {
        return null;
      }

      switch (event) {
        case "flow_start":
          if (params?.step === "read_report") return null;
          return renderFlowStartBox(
            params?.service ?? "flow",
            params?.step,
            flowId,
          );
        case "flow_complete": {
          if (params?.step === "sifting_complete") {
            const ids = (params.data?.finalIds as number[]) ?? [];
            const titles: string[] = [];
            for (const id of ids) {
              titles.push(`ID ${id}`);
            }
            return renderSelectedThreats(
              ids,
              titles,
              params?.service ?? "originality",
              stats.uniqueFilterCount ?? 0,
            );
          }

          if (params?.step === "read_report") {
            return renderArchiveLine(flowId, stats);
          }

          if (params?.step) {
            return renderMiniStep(event, params.step, params.durationMs);
          }

          return renderSummaryTable(stats);
        }
        case "ai_request_success":
          if (params?.step === "sifting_stage_1_end") {
            const tree = renderStepTree(flowId, stats);
            if (tree) return tree;
          }
          return renderMiniStep(event, params?.step, params?.durationMs);
        default:
          return renderMiniStep(event, params?.step, params?.durationMs);
      }
    }
  }
}

// ============================================================================
// Public API for logger.ts
// ============================================================================

/**
 * Development istatistiklerini günceller.
 * Yalnızca Logger.write() tarafından development modunda çağrılır.
 */
export { updateDevStats };

/**
 * Development görsel çıktısını üretir.
 * Yalnızca Logger.write() tarafından development modunda çağrılır.
 */
export { renderVisual };

/**
 * Bir flowId'ye ait development istatistiklerini bellekten temizler.
 * Flow tamamlandığında (flow_complete + no step) çağrılır.
 *
 * @param flowId - Temizlenecek flow'un ID'si
 */
export function clearDevFlow(flowId: string): void {
  devStatsMap.delete(flowId);
}
