import { Logger, createFlowId } from "./logger";
import {
  formatPipelineHeader,
  formatStageLine,
  formatPipelineFinish,
} from "./logger-format";
import { stageIndexOf, type PipelineDefinition } from "./pipeline-definitions";

interface StageRecord {
  key: string;
  index: number;
  status: "SUCCESS" | "FAILED";
  startedAt: number;
  durationMs: number;
  error?: string;
}

interface ActiveStage {
  key: string;
  index: number;
  badgePrinted: boolean;
}

interface FlowRecord {
  definitionId: string;
  createdAt: number;
  headerPrinted: boolean;
  activeStage?: ActiveStage;
  stages: Map<string, StageRecord>;
}

const FLOW_TTL_MS = 30 * 60 * 1000;
const flows = new Map<string, FlowRecord>();

/**
 * Evicts flow records that exceeded the time-to-live window.
 *
 * @param now - Current epoch milliseconds.
 */
function pruneFlows(now: number): void {
  for (const [flowId, record] of flows) {
    if (now - record.createdAt > FLOW_TTL_MS) {
      flows.delete(flowId);
    }
  }
}

/**
 * Maps a stage key to a default human-readable technical description.
 *
 * @param key - The stage key.
 * @returns Technical description for terminal logging.
 */
function defaultDescriptionForKey(key: string): string {
  const map: Record<string, string> = {
    save: "State Checkpoint",
    search: "Cohere Rerank & Vector Search",
    jury_review: "Gemini Parallel Review",
    jury: "Gemini Parallel Review",
    persist: "Final Storage",
    decompose: "Gemini Flash",
    discovery: "Parallel Literature Scan",
    critique: "Gemini Flash",
    analysis: "User Clarification Answers",
    synthesis: "Matrix Synthesis",
    matrix: "Initial Matrix Synthesis",
    generate: "AI Synthesis",
    check: "Literature Pool Check",
    scan: "Academic Sources Scan",
  };
  return map[key] || key.replace(/_/g, " ");
}

/**
 * Orchestrates logging for a multi-step pipeline run: emits clean badge-aligned
 * stage completions, parallel sub-steps, and a final summary.
 */
export class PipelineRun {
  public readonly flowId: string;
  public readonly logger: Logger;

  private readonly definition: PipelineDefinition;
  private readonly record: FlowRecord;
  private finished = false;
  private readonly devMode = process.env.NODE_ENV === "development";

  /**
   * Creates a fresh pipeline run with a new flowId.
   *
   * @param definition - The canonical pipeline definition.
   * @returns A new pipeline run instance.
   */
  static create(definition: PipelineDefinition): PipelineRun {
    return new PipelineRun(definition, createFlowId(), true);
  }

  /**
   * Joins an in-progress pipeline run identified by flowId, creating the flow
   * record when this is the first server-side touch of the flow.
   *
   * @param definition - The canonical pipeline definition shared by all participants.
   * @param flowId - The flow identifier created by the first participant.
   * @returns A pipeline run instance bound to the existing flowId.
   */
  static resume(definition: PipelineDefinition, flowId: string): PipelineRun {
    return new PipelineRun(definition, flowId, false);
  }

  /**
   * Creates a pipeline run bound to a flow record in the shared registry.
   *
   * @param definition - The canonical pipeline definition.
   * @param flowId - The flow identifier attached to every log line.
   * @param reset - True to replace any existing registry entry for the flowId.
   */
  private constructor(
    definition: PipelineDefinition,
    flowId: string,
    reset: boolean,
  ) {
    this.definition = definition;
    this.flowId = flowId;
    this.logger = new Logger(flowId);
    pruneFlows(Date.now());

    const existing = flows.get(flowId);
    if (reset || !existing || existing.definitionId !== definition.id) {
      this.record = {
        definitionId: definition.id,
        createdAt: Date.now(),
        headerPrinted: false,
        stages: new Map(),
      };
      flows.set(flowId, this.record);
    } else {
      this.record = existing;
    }
  }

  /**
   * Prints the pipeline header banner if it has not yet been output for this flow.
   */
  private printHeader(): void {
    if (this.record.headerPrinted) return;
    this.record.headerPrinted = true;
    if (this.devMode) {
      console.log(
        formatPipelineHeader({
          module: this.definition.service,
          name: this.definition.id,
        }),
      );
    }
  }

  /**
   * Emits a formatted sub-step log line under the current stage (e.g. for parallel calls).
   *
   * @param description - Short technical label of the sub-step.
   * @param durationMs - Duration in milliseconds.
   * @param status - Step status (SUCCESS, FAILED, RETRY).
   * @param options - Additional error or backoff parameters.
   */
  subStep(
    description: string,
    durationMs: number,
    status: "SUCCESS" | "FAILED" | "RETRY" = "SUCCESS",
    options?: { backoffMs?: number; error?: unknown },
  ): void {
    this.printHeader();
    if (this.devMode) {
      const active = this.record.activeStage;
      let stageIndex: number | undefined = undefined;
      let stageTotal: number | undefined = undefined;
      let stageKey: string | undefined = undefined;

      if (active && !active.badgePrinted) {
        stageIndex = active.index + 1;
        stageTotal = this.definition.stages.length;
        stageKey = active.key;
        active.badgePrinted = true;
      }

      console.log(
        formatStageLine({
          stageIndex,
          stageTotal,
          stageKey,
          isSubStep: stageIndex === undefined,
          description,
          durationMs: Math.round(durationMs),
          status,
          backoffMs: options?.backoffMs,
          error: options?.error,
        }),
      );
    }
  }

  /**
   * Runs a single pipeline stage, emitting its completion event,
   * measuring pure execution duration, and rethrowing any failure.
   *
   * @param key - The stage key declared in the pipeline definition.
   * @param fn - The stage work; must throw on failure so the stage is marked FAILED.
   * @param options - Optional custom description for the terminal line.
   * @returns The value returned by the stage work.
   */
  async execute<R>(
    key: string,
    fn: () => Promise<R>,
    options?: { description?: string },
  ): Promise<R> {
    this.printHeader();
    const index = stageIndexOf(this.definition, key);
    const total = this.definition.stages.length;
    const stageDesc = options?.description ?? defaultDescriptionForKey(key);
    const startedAt = performance.now();

    this.record.activeStage = {
      key,
      index,
      badgePrinted: false,
    };

    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - startedAt);
      this.record.stages.set(key, {
        key,
        index,
        status: "SUCCESS",
        startedAt,
        durationMs,
      });

      if (this.devMode) {
        const active = this.record.activeStage;
        const badgePrinted = active?.badgePrinted ?? false;
        console.log(
          formatStageLine({
            stageIndex: badgePrinted ? undefined : index + 1,
            stageTotal: badgePrinted ? undefined : total,
            stageKey: badgePrinted ? undefined : key,
            isSubStep: badgePrinted,
            isStageTotal: badgePrinted,
            description: stageDesc,
            durationMs,
            status: "SUCCESS",
          }),
        );
        console.log();
      } else {
        const eventBase = `${this.definition.id}_${key}`;
        this.logger.success(`${eventBase}_success`, {
          service: this.definition.service,
          durationMs,
          data: {
            summary: `[${index + 1}/${total}]`,
            stageIndex: index + 1,
            stageTotal: total,
          },
        });
      }
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      this.record.stages.set(key, {
        key,
        index,
        status: "FAILED",
        startedAt,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      });

      if (this.devMode) {
        const active = this.record.activeStage;
        const badgePrinted = active?.badgePrinted ?? false;
        console.log(
          formatStageLine({
            stageIndex: badgePrinted ? undefined : index + 1,
            stageTotal: badgePrinted ? undefined : total,
            stageKey: badgePrinted ? undefined : key,
            isSubStep: badgePrinted,
            isStageTotal: badgePrinted,
            description: stageDesc,
            durationMs,
            status: "FAILED",
            error: err,
          }),
        );
        console.log();
      } else {
        const eventBase = `${this.definition.id}_${key}`;
        this.logger.failed(`${eventBase}_failed`, {
          service: this.definition.service,
          durationMs,
          error: err,
          data: {
            summary: `[${index + 1}/${total}]`,
            stageIndex: index + 1,
            stageTotal: total,
          },
        });
      }
      throw err;
    } finally {
      this.record.activeStage = undefined;
    }
  }

  /**
   * Emits the final completion summary line with accumulated pure execution duration.
   *
   * @param p - Optional override of total duration in milliseconds.
   */
  finish(p?: { durationMs?: number }): void {
    if (this.finished) return;
    this.finished = true;

    const stages = [...this.record.stages.values()].sort(
      (a, b) => a.index - b.index,
    );

    let durationMs = p?.durationMs;
    if (durationMs === undefined && stages.length > 0) {
      durationMs = stages.reduce((acc, s) => acc + s.durationMs, 0);
    }
    if (durationMs === undefined) return;

    const totalStages = this.definition.stages.length;

    if (this.devMode) {
      console.log(
        formatPipelineFinish({
          completedStages: stages.length,
          totalStages,
          durationMs,
          status: "SUCCESS",
        }),
      );
    } else {
      const summary = `(${stages.length}/${totalStages} stages)`;
      this.logger.total(this.definition.id, durationMs, {
        service: "pipeline",
        data: {
          summary,
          stages: stages.map(({ key, status, durationMs: d }) => ({
            key,
            status,
            durationMs: d,
          })),
        },
      });
    }

    flows.delete(this.flowId);
  }
}
