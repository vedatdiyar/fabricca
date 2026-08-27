import { sanitizeModelStreamText } from "@/lib/text-sanitizer";

/**
 * Extracts plain text from a Gemini chunk, sanitized.
 *
 * @param chunk - Raw Gemini streaming chunk.
 * @returns Sanitized text delta, or empty string.
 */
export function extractTextFromChunk(chunk: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  text?: string;
}): string {
  let text = "";
  try {
    if (chunk.candidates?.[0]?.content?.parts) {
      for (const part of chunk.candidates[0].content.parts) {
        if (part.text) text += part.text;
      }
    } else {
      text = chunk.text ?? "";
    }
  } catch {
    text = "";
  }
  return text ? sanitizeModelStreamText(text) : "";
}

/**
 * Extracts function calls from a Gemini chunk.
 * Preserves the call `id` for strict 3.5+ FunctionResponse matching (id + name + count must be 1:1).
 *
 * @param chunk - Raw Gemini streaming chunk.
 * @returns Array of function calls with id preserved, or empty array.
 */
export function extractFunctionCalls(chunk: {
  functionCalls?: Array<{ id?: string; name?: string; args?: unknown }>;
  candidates?: Array<{
    content?: {
      parts?: Array<{ functionCall?: { id?: string; name?: string; args?: unknown } }>;
    };
  }>;
}): Array<{ id?: string; name?: string; args?: unknown }> {
  if (chunk.functionCalls && chunk.functionCalls.length > 0) {
    return chunk.functionCalls;
  }
  const parts = chunk.candidates?.[0]?.content?.parts;
  if (!parts) return [];
  const callParts = parts.filter((p) => p.functionCall);
  if (callParts.length === 0) return [];
  return callParts.map((p) => p.functionCall!);
}

/**
 * Collects model parts from a chunk for conversation history.
 * Keeps thought / thoughtSignature parts (required for 3.5+ thought preservation).
 *
 * @param chunk - Raw Gemini streaming chunk.
 * @returns Array of part objects (unfiltered).
 */
export function collectModelParts(chunk: {
  candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  if (!chunk.candidates?.[0]?.content?.parts) return [];
  return chunk.candidates[0].content.parts as unknown as Array<
    Record<string, unknown>
  >;
}
