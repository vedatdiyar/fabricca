/**
 * Global console.log filtreleme modülü.
 * Sadece development ortaminda ve istege bagli tetiklenen
 * `initConsoleFilter()` ile aktive olur.
 * Modül import edildigi an degil, sadece bu fonksiyon çagrildiginda
 * console.log override'ini aktif eder.
 */

const originalConsoleLog = console.log;

const FILTER_PATTERNS = [
  "Cache skipped reason",
  "api.openalex.org",
  "api.crossref.org",
  "fetchCache = default-no-store",
  "cache skip",
];

let lastRenderedFlowId: string | null = null;
let isActive = false;

/**
 * Development ortaminda gereksiz Next.js ve API log'larini filtreler.
 * Flow ID geçislerinde görsel ayraç (separator) çizgileri ekler.
 * Sadece `process.env.NODE_ENV === 'development'` iken çalisir.
 */
export function initConsoleFilter(): void {
  if (isActive) return;
  if (process.env.NODE_ENV !== "development") return;

  isActive = true;

  console.log = (...args: unknown[]) => {
    const message = typeof args[0] === "string" ? args[0] : "";
    if (FILTER_PATTERNS.some((p) => message.includes(p))) return;

    const match = message.match(/\[(fl_\w+)\]/);
    if (match) {
      const currentFlowId = match[1];
      if (lastRenderedFlowId !== null && lastRenderedFlowId !== currentFlowId) {
        originalConsoleLog(
          "\x1b[90m└───────────────────────────────────────────────────────────────────────────────────────────────────┘\x1b[0m",
        );
        originalConsoleLog(
          `\x1b[90m┌── [${currentFlowId}] ─────────────────────────────────────────────────────────────────────────────┐\x1b[0m`,
        );
      } else if (lastRenderedFlowId === null) {
        originalConsoleLog(
          `\x1b[90m┌── [${currentFlowId}] ─────────────────────────────────────────────────────────────────────────────┐\x1b[0m`,
        );
      }
      lastRenderedFlowId = currentFlowId;
    }
    originalConsoleLog(...args);
  };
}
