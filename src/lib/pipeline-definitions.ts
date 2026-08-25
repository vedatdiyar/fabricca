import type { ServiceName } from "./logger";

/**
 * Single canonical stage of a multi-step pipeline: technical English key for
 * backend log events plus the Turkish UI loading text derived from it.
 */
export interface PipelineStageDef {
  key: string;
  text: string;
}

/**
 * Canonical definition of a multi-step operation shared by the server-side
 * PipelineRun logger and the client-side loading overlay.
 */
export interface PipelineDefinition {
  id: string;
  service: ServiceName;
  stages: readonly PipelineStageDef[];
}

/**
 * Defines a canonical pipeline, validating that stage keys are unique.
 *
 * @param id - Technical English pipeline identifier used as the log event prefix.
 * @param service - Service name attached to every pipeline log entry.
 * @param stages - Ordered stage definitions.
 * @returns The frozen pipeline definition.
 */
export function definePipeline(
  id: string,
  service: ServiceName,
  stages: readonly PipelineStageDef[],
): PipelineDefinition {
  const seen = new Set<string>();
  for (const stage of stages) {
    if (seen.has(stage.key)) {
      throw new Error(
        `Pipeline "${id}" declares duplicate stage key "${stage.key}".`,
      );
    }
    seen.add(stage.key);
  }
  return Object.freeze({ id, service, stages: Object.freeze([...stages]) });
}

/**
 * Returns the ordinal index of a stage within a pipeline definition.
 *
 * @param pipeline - The pipeline definition to inspect.
 * @param key - The stage key to locate.
 * @returns Zero-based stage index.
 */
export function stageIndexOf(
  pipeline: PipelineDefinition,
  key: string,
): number {
  const index = pipeline.stages.findIndex((s) => s.key === key);
  if (index === -1) {
    throw new Error(`Pipeline "${pipeline.id}" has no stage "${key}".`);
  }
  return index;
}

/**
 * Derives idle loading-overlay steps from a pipeline definition.
 *
 * @param pipeline - The pipeline definition to derive steps from.
 * @returns Idle step list mirroring the definition order.
 */
export function toLoadingSteps(
  pipeline: PipelineDefinition,
): { text: string; status: "idle" }[] {
  return pipeline.stages.map((stage) => ({ text: stage.text, status: "idle" }));
}

/** Matrix submission flow: save matrix, search theses, jury review, persist report. */
export const MATRIX_SUBMIT_PIPELINE = definePipeline("matrix_submit", "flow", [
  { key: "save", text: "Çalışma matrisi kaydediliyor..." },
  { key: "search", text: "Tezler bulunuyor…" },
  { key: "jury_review", text: "Literatür inceleniyor…" },
  { key: "persist", text: "Rapor kaydediliyor..." },
]);

/** Thesis box generation flow: AI structure generation then persistence. */
export const BOX_GENERATION_PIPELINE = definePipeline("boxes", "boxes", [
  {
    key: "generate",
    text: "Altyapısal kutular ve tarama sorguları oluşturuluyor…",
  },
  { key: "persist", text: "Kutular Kaydediliyor..." },
]);

/** Thesis outline generation flow: AI outline generation then persistence. */
export const OUTLINE_GENERATION_PIPELINE = definePipeline(
  "outline",
  "outline",
  [
    { key: "generate", text: "Tez planı yapay zeka tarafından oluşturuluyor…" },
    { key: "persist", text: "Plan veritabanına kaydediliyor..." },
  ],
);

/** Literature review flow: pool check, academic scanning, pool persistence. */
export const LITERATURE_PIPELINE = definePipeline("literature", "literature", [
  { key: "check", text: "Mevcut literatür havuzu kontrol ediliyor..." },
  { key: "scan", text: "Akademik kaynaklar taranıyor..." },
  { key: "persist", text: "Literatür havuzu kaydediliyor..." },
]);
