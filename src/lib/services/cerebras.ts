"use server";

import { z } from "zod";
import type { Logger } from "@/lib/logger";

const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";

/**
 * Sends a chat completion request to the Cerebras API with structured JSON output
 * enforcement (json_schema + strict mode). Returns the parsed, type-safe result.
 *
 * @param modelName - Cerebras model ID (e.g. "gemma-4-31b")
 * @param systemInstruction - System-level instruction / persona
 * @param prompt - User prompt
 * @param jsonSchema - JSON Schema object for structured output (must include additionalProperties: false for strict mode)
 * @param log - Optional Logger instance
 * @param options - Optional payload stage label and Zod schema for post-hoc validation
 * @returns Parsed response matching the expected type T
 */
export async function generateStructuredContent<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string,
  jsonSchema: object,
  log?: Logger,
  options?: {
    payloadStage?: string;
    zodSchema?: z.ZodType<T>;
  },
): Promise<T> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    throw new Error("CEREBRAS_API_KEY environment variable is not defined");
  }

  const stage = options?.payloadStage || "cerebras";

  log?.info(`${stage}_start`, {
    service: "cerebras",
    data: { model: modelName, promptLength: prompt.length },
  });

  const response = await fetch(`${CEREBRAS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: stage,
          strict: true,
          schema: jsonSchema,
        },
      },
      temperature: 0,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Cerebras API returned ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Cerebras returned an empty response.");
  }

  const parsed = JSON.parse(content) as T;

  if (options?.zodSchema) {
    const validationResult = options.zodSchema.safeParse(parsed);
    if (!validationResult.success) {
      log?.error(`${stage}_schema_validation_failed`, {
        service: "cerebras",
        data: {
          issues: validationResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      });
      throw new Error(
        "Cerebras response did not match the expected structural schema.",
      );
    }
  }

  log?.info(`${stage}_success`, {
    service: "cerebras",
    data: { model: modelName },
  });

  return parsed;
}
