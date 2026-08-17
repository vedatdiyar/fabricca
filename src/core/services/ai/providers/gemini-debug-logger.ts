import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { Logger, createFlowId } from "@/lib/logger";

/**
 * In development, persists a hashed record of LLM inputs to `.next/logs/llm_inputs` for debugging.
 *
 * @param params - Object containing the model name, prompts, payload, thesis matrix, and optional stage label.
 * @param params.modelName - The Gemini model identifier used for the call.
 * @param params.systemInstruction - The system-level instructions sent to the model.
 * @param params.userPrompt - The user prompt sent to the model.
 * @param params.payload - The raw request payload sent to the model.
 * @param params.thesisMatrix - The thesis matrix context included in the log.
 * @param params.stage - Optional label identifying the pipeline stage.
 * @returns The SHA-256 hash of the logged inputs, or undefined when logging is skipped.
 */
export async function logRawLlmCall(params: {
  modelName: string;
  systemInstruction: string;
  userPrompt: string;
  payload: unknown;
  thesisMatrix: unknown;
  stage?: string;
}): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof window !== "undefined") return;

  const timestamp = new Date().toISOString();
  const combinedPrompt = `System Instruction:\n${params.systemInstruction}\n\nUser Prompt:\n${params.userPrompt}`;

  const hashObject = {
    systemInstruction: params.systemInstruction,
    userPrompt: params.userPrompt,
    combinedPrompt,
    payload: params.payload,
    thesisMatrix: params.thesisMatrix,
  };

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashObject))
    .digest("hex");

  const logData = {
    timestamp,
    hash,
    stage: params.stage || "gemini",
    ...hashObject,
  };

  try {
    const dir = path.resolve(process.cwd(), ".next/logs/llm_inputs");
    await fs.mkdir(dir, { recursive: true });
    const cleanTime = timestamp.replace(/:/g, "-");
    const filename = `${cleanTime}_${hash.substring(0, 8)}.json`;
    await fs.writeFile(
      path.join(dir, filename),
      JSON.stringify(logData, null, 2),
      "utf-8",
    );
  } catch (err) {
    const log = new Logger(createFlowId());
    log.error("write_llm_log_failed", {
      service: "gemini",
      data: { error: String(err) },
    });
  }

  return hash;
}
