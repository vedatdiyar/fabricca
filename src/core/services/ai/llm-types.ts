import { ThinkingLevel, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { z } from "zod";

export interface JsonSchemaProperty {
  type: string | string[];
  items?:
    | JsonSchemaProperty
    | {
        type: string;
        enum?: (string | number)[];
        properties?: Record<string, JsonSchemaProperty>;
        required?: string[];
        additionalProperties?: boolean;
      };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  enum?: (string | number)[];
  description?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean;
}

export interface JsonSchema {
  type: "object" | "array";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty | JsonSchema;
  additionalProperties?: boolean;
}

/**
 * Unified options shared by structured LLM generation across providers.
 *
 * @typeParam T - The expected structured output type.
 */
export interface StructuredGenerationOptions<T> {
  payloadStage?: string;
  zodSchema?: z.ZodType<T>;
  seed?: number;
  thesisMatrix?: unknown;
  thinkingConfig?: {
    thinkingLevel?: ThinkingLevel;
    /**
     * @deprecated Gemini 3.x için önerilmez — `thinkingLevel` kullanın.
     * Geriye dönük uyumluluk için tutulur, istekte iletilmez.
     */
    thinkingBudget?: number;
  } | null;
  safetySettings?: Array<{
    category: HarmCategory;
    threshold: HarmBlockThreshold;
  }>;
  quiet?: boolean;
  /**
   * @deprecated Gemini 3.x `temperature`/`topP` önerilmez — iletilmez.
   * Net sistem talimatları + `seed` kullanın.
   */
  temperature?: never;
  maxTokens?: number;
  /**
   * @deprecated Gemini 3.x `topP` önerilmez — iletilmez.
   */
  topP?: never;
  /**
   * Pipeline operation key (e.g. "pdf_read", "sanitize"). Operations listed in
   * `GEMINI_FALLBACK_OPERATIONS` may fall back to a weaker model when every key
   * is daily-exhausted; all others hard-stop with a quota outcome.
   */
  operation?: string;
  /**
   * Execution lane.
   * - "interactive" (VIP Lane): priority dispatch for live chat and interactive streams.
   * - "batch" (Default): standard load-balanced execution.
   */
  lane?: "interactive" | "batch";
  /**
   * Optional target key index for sharded batch execution (used by dispatchGeminiBatch).
   */
  targetKeyIndex?: number;
  /**
   * When true, bypasses the token-bucket RPM rate limiter queuing for this call,
   * allowing immediate parallel execution without pacing delays.
   */
  bypassRateLimiter?: boolean;
}
