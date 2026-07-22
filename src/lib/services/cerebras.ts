import { Logger } from "../logger";
import { classifyError } from "../error-utils";
import type { JsonSchema } from "./gemini";

/**
 * Default Cerebras Inference Model for structured extraction and NLU tasks.
 */
export const CEREBRAS_DEFAULT_MODEL = "gemma-4-31b";

/**
 * Options for Cerebras structured content generation.
 */
export interface CerebrasOptions {
  /**
   * The target model ID (defaults to gemma-4-31b).
   */
  model?: string;
  /**
   * Sampling temperature (defaults to 0.1 for deterministic extraction).
   */
  temperature?: number;
  /**
   * Payload stage tag for logging.
   */
  payloadStage?: string;
}

/**
 * Recursively injects `additionalProperties: false` into all object definitions
 * in a JSON schema to ensure compliance with Cerebras Strict JSON Schema mode.
 *
 * @param schema - The original JSON schema.
 * @returns A deep-cloned schema with additionalProperties set to false on all object nodes.
 */
export function sanitizeSchemaForCerebrasStrict(
  schema: JsonSchema,
): JsonSchema {
  const cloned = JSON.parse(JSON.stringify(schema));

  function processNode(node: Record<string, unknown>): void {
    if (!node || typeof node !== "object") return;

    if (node.type === "object") {
      if (!("additionalProperties" in node)) {
        node.additionalProperties = false;
      }
      if (node.properties && typeof node.properties === "object") {
        for (const child of Object.values(
          node.properties as Record<string, unknown>,
        )) {
          processNode(child as Record<string, unknown>);
        }
      }
    } else if (
      node.type === "array" &&
      node.items &&
      typeof node.items === "object"
    ) {
      processNode(node.items as Record<string, unknown>);
    }
  }

  processNode(cloned);
  return cloned as JsonSchema;
}

/**
 * Generates structured JSON content using Cerebras Inference API with strict JSON schema validation.
 * Stops execution and throws immediately on failure (no fallback).
 *
 * @param systemInstruction - System instruction for the model.
 * @param prompt - The user prompt.
 * @param schema - The JSON schema governing the output format.
 * @param log - Logger instance for flow tracking.
 * @param options - Additional options (model, temperature, payloadStage).
 * @returns Parsed JSON object of type T.
 * @throws Error if CEREBRAS_API_KEY is missing, request fails, or JSON parsing fails.
 */
export async function generateCerebrasStructuredContent<T>(
  systemInstruction: string,
  prompt: string,
  schema: JsonSchema,
  log: Logger,
  options: CerebrasOptions = {},
): Promise<T> {
  log.file("cerebras.ts");
  const apiKey = process.env.CEREBRAS_API_KEY;

  if (!apiKey) {
    throw new Error("CEREBRAS_API_KEY is missing in environment variables.");
  }

  const model = options.model || CEREBRAS_DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.1;
  const stage = options.payloadStage || "cerebras_structured_generation";

  log.groupStart(`cerebras_${stage}_start`);
  log.prompt(`${model} (${stage})`, prompt);

  const strictSchema = sanitizeSchemaForCerebrasStrict(schema);
  const startTime = performance.now();

  try {
    const response = await fetch(
      "https://api.cerebras.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: `${stage}_response`,
              strict: true,
              schema: strictSchema,
            },
          },
          temperature,
        }),
      },
    );

    const durationMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text();
      log.error("cerebras_api_failed", {
        service: "cerebras",
        data: { status: response.status, stage, errorText },
      });
      log.groupEnd(`cerebras_${stage}_failed`, durationMs);
      throw new Error(
        `Cerebras API request failed with status ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json();
    const contentStr = data.choices?.[0]?.message?.content;

    if (!contentStr) {
      log.groupEnd(`cerebras_${stage}_failed`, durationMs);
      throw new Error("Cerebras API returned empty completion content.");
    }

    log.info("cerebras_api_success", {
      service: "cerebras",
      durationMs,
      data: {
        stage,
        model,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    });

    const parsed: T = JSON.parse(contentStr);
    log.groupEnd(`cerebras_${stage}_success`, durationMs);
    return parsed;
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    const classified = classifyError(err);
    log.error("cerebras_generation_failed", {
      service: "cerebras",
      error: classified,
      data: { stage, model },
    });
    log.groupEnd(`cerebras_${stage}_failed`, durationMs);
    throw err;
  }
}
