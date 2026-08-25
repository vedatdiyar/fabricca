import { Logger, createFlowId } from "./logger";
import { C_GREEN, C_RED, C_RESET, formatDuration } from "./logger-format";
import { stageIndexOf, type PipelineDefinition } from "./pipeline-definitions";

interface StageRecord {
  key: string;
  index: number;
  status: "SUCCESS" | "FAILED";
  startedAt: number;
  durationMs: number;
  error?: string;
}

interface FlowRecord {
  definitionId: string;
  createdAt: number;
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
 * Orchestrates logging for a multi-step pipeline run: emits conforming
 * `<pipeline>_<stage>_start/_success/_failed` event pairs per stage and a
 * final TOTAL summary with the full stage manifest.
 */
export class PipelineRun {
  public readonly flowId: string;
  public readonly logger: Logger;

  private readonly definition: PipelineDefinition;
  private readonly record: FlowRecord;
  private finished = false;

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
        stages: new Map(),
      };
      flows.set(flowId, this.record);
    } else {
      this.record = existing;
    }
  }

  /**
   * Runs a single pipeline stage, emitting its start/success/failed event pair,
   * measuring its duration, and rethrowing any failure to the caller.
   *
   * @param key - The stage key declared in the pipeline definition.
   * @param fn - The stage work; must throw on failure so the stage is marked FAILED.
   * @returns The value returned by the stage work.
   */
  async execute<R>(key: string, fn: () => Promise<R>): Promise<R> {
    const index = stageIndexOf(this.definition, key);
    const total = this.definition.stages.length;
    const eventBase = `${this.definition.id}_${key}`;
    const startedAt = performance.now();

    this.logger.info(`${eventBase}_start`, {
      service: this.definition.service,
      data: {
        summary: `[${index + 1}/${total}]`,
        stageIndex: index + 1,
        stageTotal: total,
      },
    });

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
      this.logger.info(`${eventBase}_success`, {
        service: this.definition.service,
        durationMs,
      });
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
      this.logger.info(`${eventBase}_failed`, {
        service: this.definition.service,
        durationMs,
        error: err,
      });
      throw err;
    }
  }

  /**
   * Emits the final TOTAL line with the accumulated stage manifest and clears
   * the flow record; safe to call multiple times within one flow.
   *
   * @param p - Optional override of the total duration in milliseconds.
   */
  finish(p?: { durationMs?: number }): void {
    if (this.finished) return;
    this.finished = true;

    const stages = [...this.record.stages.values()].sort(
      (a, b) => a.index - b.index,
    );

    let durationMs = p?.durationMs;
    if (durationMs === undefined && stages.length > 0) {
      const firstStart = Math.min(...stages.map((s) => s.startedAt));
      const lastEnd = Math.max(
        ...stages.map((s) => s.startedAt + s.durationMs),
      );
      durationMs = Math.round(lastEnd - firstStart);
    }
    if (durationMs === undefined) return;

    this.logger.total(this.definition.id, durationMs, {
      service: this.definition.service,
      data: {
        stages: stages.map(({ key, status, durationMs: d }) => ({
          key,
          status,
          durationMs: d,
        })),
      },
    });
    this.printDevManifest(stages);

    flows.delete(this.flowId);
  }

  /**
   * Prints the compact per-stage manifest beneath the TOTAL line in dev mode.
   *
   * @param stages - The recorded stages ordered by execution index.
   */
  private printDevManifest(stages: StageRecord[]): void {
    if (process.env.NODE_ENV !== "development" || stages.length === 0) return;

    const width = Math.max(...stages.map((s) => s.key.length));
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const icon = stage.status === "SUCCESS" ? "✓" : "✖";
      const color = stage.status === "SUCCESS" ? C_GREEN : C_RED;
      const branch = i === stages.length - 1 ? "└─" : "├─";
      console.log(
        `  ${branch} ${color}${icon}${C_RESET} ${stage.key.padEnd(width)}  ${formatDuration(stage.durationMs)}`,
      );
    }
  }
}
