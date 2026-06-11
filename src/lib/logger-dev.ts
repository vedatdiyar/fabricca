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

function drawContentLine(
  text: string,
  clr: chalk.Chalk = chalk.reset,
): string {
  const inner = ` ${text}`;
  const padding = Math.max(0, BOX_INNER_WIDTH - inner.length);
  return clr(`║${inner}${" ".repeat(padding)}║`);
}

// ============================================================================
// Visual Renderers
// ============================================================================

function renderErrorBox(message: string, location: string): string {
  const clr = chalk.red;
  const lines: string[] = [];
  lines.push(drawTopBorder(clr));
  lines.push(drawContentLine(chalk.bold.red("💥 ERROR DETECTED"), clr));
  lines.push(drawContentLine("", clr));
  lines.push(
    drawContentLine(chalk.bold("Message: ") + chalk.red(message), clr),
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
    stats.steps.length > 0
      ? stats.steps[stats.steps.length - 1].durationMs
      : 0;

  lines.push(
    chalk.dim(
      `┌─ sifting_stage_1 ${"─".repeat(55)} ${formatDuration(stepDuration)}`,
    ),
  );
  lines.push(
    chalk.dim(`│  ┌─ Tavily Search Outcomes (${tavily.length} queries)`),
  );
  for (const entry of tavily) {
    lines.push(
      chalk.dim(
        `│  │  • ${entry.query} ➔ ${entry.resultCount} facts (${formatDuration(entry.durationMs)})`,
      ),
    );
  }
  lines.push(
    chalk.dim(
      `│  └─ Tezara Combination Search Outcomes (${tezara.length} queries)`,
    ),
  );
  for (const entry of tezara) {
    lines.push(
      chalk.dim(
        `│  │  • ${entry.query} ➔ ${entry.resultCount} tez (${formatDuration(entry.durationMs)})`,
      ),
    );
  }

  const filterCount = stats.uniqueFilterCount;
  if (filterCount !== undefined) {
    lines.push(
      chalk.dim(`│  └─ Total Filter: ${filterCount} matching rows merged.`),
    );
  }

  return lines.join("\n");
}

function renderSelectedThreats(
  ids: number[],
  titles: string[],
  service: string,
): string {
  const lines: string[] = [];
  const prevIds = previousFinalIdsMap.get(service) ?? [];

  lines.push(
    chalk.dim(`├─ sifting_stage_2 ➔ Deep Abstract Analysis Complete`),
  );

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const title = titles[i] ?? `ID ${id}`;
    const isNew = !prevIds.includes(id);
    const newTag = isNew ? chalk.green(" [← yeni]") : "";
    lines.push(
      chalk.dim(`│    ★ Selected Threat: ID ${id} ➔ ${title}${newTag}`),
    );
  }

  previousFinalIdsMap.set(service, ids);

  return lines.join("\n");
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
    chalk.dim(
      ` │ Süre                │ ${totalDuration.padEnd(42)}│`,
    ),
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
  lines.push(
    chalk.dim(
      ` │ En Yavaş Adım       │ ${slowestName.padEnd(42)}│`,
    ),
  );
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
  return chalk.dim(`  ├─ ${stepLabel}➔ ${event}${dur}`);
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

    if (
      params.durationMs !== undefined &&
      (!stats.slowestStep ||
        params.durationMs > stats.slowestStep.durationMs)
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
        });
      }
    }
  }

  // Record unique filter count from deduplicate step
  if (
    event === "search_success" &&
    params?.step === "deduplicate_and_score" &&
    params?.data?.uniqueCount !== undefined
  ) {
    stats.uniqueFilterCount = params.data.uniqueCount as number;
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
    stats.thinkingTokens += Math.max(0, thisCallRawTotal - thisCallInput - thisCallOutput);
  }

  // Track AI retry as an AI call attempt
  if (event === "ai_retry_attempt" || event === "ai_low_quality_response") {
    stats.aiCalls += 1;
  }

  // Store final selected IDs for diff comparison
  if (
    event === "flow_complete" &&
    params?.step === "sifting_complete" &&
    params?.data?.finalIds
  ) {
    stats.selectedFinalIds = params.data.finalIds as number[];
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
      return renderErrorBox(message, getCallerLocation());
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
            );
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
