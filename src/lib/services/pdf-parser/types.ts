import type { GoogleGenAI } from "@google/genai";
import type { DocumentChunk } from "@/lib/services/pdf/chunker";
import type { DocumentAnalysisResult } from "./schema";

/** Shared pause gate used by workers for coordinating 429 backoff. */
export interface PauseGate {
  /** Resolves immediately when no pause is active; blocks while a pause is in effect. */
  wait(): Promise<void>;
  /** Activates a pause for `ms` milliseconds. */
  pause(ms: number): void;
  /** Returns true if the gate is currently unpaused and ready. */
  isReady(): boolean;
  /** Returns the timestamp in ms until which this gate is paused. */
  getPauseUntil(): number;
}

/** Individual worker instance managing an API key, GenAI client, and pause gate. */
export interface KeyWorker {
  keyIndex: number;
  apiKey: string;
  client: GoogleGenAI;
  gate: PauseGate;
}

/** Per-batch parse diagnostics collected for tuning and observability. */
export interface PdfBatchMetric {
  /** 1-based inclusive start page of the batch. */
  startPage: number;
  /** 1-based inclusive end page of the batch. */
  endPage: number;
  /** Wall-clock latency of the batch, in milliseconds. */
  durationMs: number;
  /** Total number of Gemini attempts (1 + retries) for the batch. */
  attempts: number;
  /** Prompt (input) token count reported by the model, when available. */
  inputTokens?: number;
  /** Candidate (output) token count reported by the model, when available. */
  outputTokens?: number;
  /** Total token count reported by the model, when available. */
  totalTokens?: number;
  /** Raw finishReason reported by the model, when available. */
  finishReason?: string;
}

/** Tunable options for the PDF parsing driver. */
export interface PdfParseOptions {
  /** 1-based inclusive start page (default: 1). */
  startPage?: number;
  /** 1-based inclusive end page (default: last page). */
  endPage?: number;
  /** Number of pages submitted per Gemini request (default: 5). */
  batchSize?: number;
  /** Maximum concurrent in-flight Gemini requests. */
  concurrency?: number;
  /** When provided, the driver appends one entry per completed batch. */
  metrics?: PdfBatchMetric[];
}

/** Result shape for the high-level parsePdfToChunks adapter. */
export interface PdfChunkParseResult {
  chunks: DocumentChunk[];
  references: DocumentAnalysisResult["references"];
  metadata: DocumentAnalysisResult["metadata"];
}
