"use server";

import fs from "fs";
import path from "path";
import { compareThreeLlmRequests, simpleLineDiff } from "@/lib/log-comparator";

const LOGS_DIR = path.resolve(process.cwd(), ".next/logs/llm_inputs");

export interface LogMetadata {
  id: string; // Unique file ID (filename without extension)
  hash: string;
  timestamp: string;
  modelName: string;
  stage: string;
  thesisTitle?: string;
}

function ensureDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

export async function listLogsAction(): Promise<LogMetadata[]> {
  try {
    ensureDir();
    const files = fs.readdirSync(LOGS_DIR);
    const logs: LogMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const filePath = path.join(LOGS_DIR, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);

        // Safely extract the stage/context of request
        let stage = data.stage || "gemini";
        if (data.payload?.config?.payloadStage) {
          stage = data.payload.config.payloadStage;
        }

        logs.push({
          id: file.replace(".json", ""),
          hash: data.hash,
          timestamp: data.timestamp,
          modelName: data.modelName || data.payload?.model || "Unknown Model",
          stage,
          thesisTitle: data.thesisMatrix?.studyTitle || undefined,
        });
      } catch {
        // Skip malformed log files
      }
    }

    // Sort by timestamp descending (newest first)
    return logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (err) {
    console.error("Failed to list LLM logs:", err);
    return [];
  }
}

export async function getLogDetailsAction(id: string) {
  try {
    ensureDir();
    const filePath = path.join(LOGS_DIR, id + ".json");
    if (!fs.existsSync(filePath)) throw new Error("Log file not found");

    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to get log details for ${id}:`, err);
    return null;
  }
}

export async function compareLogsAction(
  id1: string,
  id2: string,
  id3?: string | null,
) {
  try {
    const log1 = await getLogDetailsAction(id1);
    const log2 = await getLogDetailsAction(id2);
    const log3 = id3 ? await getLogDetailsAction(id3) : null;

    if (!log1 || !log2) {
      return { error: "One or both log files could not be loaded." };
    }

    const report = compareThreeLlmRequests(log1, log2, log3);

    const promptDiffLines = simpleLineDiff(
      `System Instruction:\n${log1.systemInstruction}\n\nUser Prompt:\n${log1.userPrompt}`,
      `System Instruction:\n${log2.systemInstruction}\n\nUser Prompt:\n${log2.userPrompt}`,
    );

    const promptDiffLines23 = log3
      ? simpleLineDiff(
          `System Instruction:\n${log2.systemInstruction}\n\nUser Prompt:\n${log2.userPrompt}`,
          `System Instruction:\n${log3.systemInstruction}\n\nUser Prompt:\n${log3.userPrompt}`,
        )
      : [];

    const promptDiffLines13 = log3
      ? simpleLineDiff(
          `System Instruction:\n${log1.systemInstruction}\n\nUser Prompt:\n${log1.userPrompt}`,
          `System Instruction:\n${log3.systemInstruction}\n\nUser Prompt:\n${log3.userPrompt}`,
        )
      : [];

    return {
      success: true as const,
      log1,
      log2,
      log3,
      report,
      promptDiffLines,
      promptDiffLines23,
      promptDiffLines13,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteLogAction(id: string) {
  try {
    ensureDir();
    const filePath = path.join(LOGS_DIR, id + ".json");
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearAllLogsAction() {
  try {
    ensureDir();
    const files = fs.readdirSync(LOGS_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(LOGS_DIR, file));
      }
    }
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
