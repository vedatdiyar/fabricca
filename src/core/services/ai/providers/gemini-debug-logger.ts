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

/**
 * In development, persists a failed model output together with its Zod issues
 * to `.next/logs/llm_outputs` so schema violations can be diagnosed post-hoc.
 * No-op outside development or when text is empty.
 *
 * @param params - Object containing the stage label, model name, raw output text, and issue summaries.
 * @param params.stage - Pipeline stage label identifying the failed call.
 * @param params.modelName - The Gemini model identifier used for the call.
 * @param params.outputText - The raw model output that failed validation.
 * @param params.issues - Zod issue summaries (path + message) for the failure.
 * @returns The written file path, or undefined when logging is skipped.
 */
export async function logFailedLlmOutput(params: {
  stage: string;
  modelName: string;
  outputText: string;
  issues: { path: string; message: string }[];
}): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "development") return undefined;
  if (typeof window !== "undefined") return undefined;
  if (!params.outputText) return undefined;

  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    stage: params.stage,
    model: params.modelName,
    issues: params.issues,
    outputText: params.outputText,
  };

  try {
    const dir = path.resolve(process.cwd(), ".next/logs/llm_outputs");
    await fs.mkdir(dir, { recursive: true });
    const cleanTime = timestamp.replace(/:/g, "-");
    const hash = crypto
      .createHash("sha256")
      .update(params.outputText)
      .digest("hex")
      .substring(0, 8);
    const filename = `${cleanTime}_${params.stage}_${hash}.json`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, JSON.stringify(logData, null, 2), "utf-8");
    return filePath;
  } catch (err) {
    const log = new Logger(createFlowId());
    log.error("write_failed_llm_output_failed", {
      service: "gemini",
      data: { error: String(err) },
    });
    return undefined;
  }
}
