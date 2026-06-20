import { Logger, createFlowId } from "@/lib/logger";

const log = new Logger(createFlowId());

log.info("ai_request_start", {
  service: "matrix",
  status: "START",
  step: "Tez matrisi Gemini'ye gonderiliyor",
  data: { model: "gemini-2.8-flash-lite" },
});

log.info("ai_request_success", {
  service: "matrix",
  status: "SUCCESS",
  durationMs: 2340,
  tokens: { input: 520, output: 380, total: 900 },
  data: { thinkingLevel: "HIGH" },
});

log.step("Tez matrisi basariyla zenginlestirildi");

log.info("ai_request_start", {
  service: "risk",
  status: "START",
  step: "YOKTEZ taramasi baslatiliyor",
});

log.info("search_filtered", {
  service: "risk",
  status: "SUCCESS",
  durationMs: 3450,
  data: { before: 48, after: 12, rawCount: 48 },
});

log.file("src/app/(auth)/onboarding/risk/_services/analysis.ts");

log.info("literature_search_start", {
  service: "literature",
  status: "START",
  step: "Literatür taramasi yapiliyor",
});

log.info("literature_sifting_chunk", {
  service: "literature",
  status: "SUCCESS",
  durationMs: 890,
  data: { resultCount: 42 },
});

log.info("literature_jury_done", {
  service: "literature",
  status: "SUCCESS",
  durationMs: 12400,
  tokens: { input: 3200, output: 1800 },
});

log.info("complete", {
  service: "complete",
  status: "SUCCESS",
  step: "Onboarding tamamlandi",
  durationMs: 45000,
});

log.warn("ai_retry_attempt", {
  service: "gemini",
  status: "RETRY",
  data: { attempt: 3 },
});

log.error("literature_review_failed", {
  service: "literature",
  status: "FAILED",
  durationMs: 30000,
  error: new Error("429 Too Many Requests"),
});

log.prompt(
  "gemini-2.8-flash-lite",
  "Sen bir akademik danismansin. Verilen tez matrisini analiz et...",
);

log.data("flowId", log.flowId);
