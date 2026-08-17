import { formatRagSourceContext } from "@/app/(app)/advisor/_services/pipeline/context";
import {
  performHybridRagSearch,
  type RagSearchResultItem,
} from "@/core/services/search/rag-search";

export interface TurnContextResult {
  sources: RagSearchResultItem[];
  contextText: string;
  userMessageText: string;
}

/**
 * Prepares RAG context and formatted user prompt text for an advisor turn.
 * Fast-paths direct action queries by skipping heavy literature RAG search.
 *
 * @param query - The user question or instruction.
 * @param isAction - True when classified as a database/tool action query.
 * @returns Sources, context string, and combined prompt text.
 */
export async function prepareTurnContext(
  query: string,
  isAction: boolean,
): Promise<TurnContextResult> {
  let sources: RagSearchResultItem[] = [];

  // Fast-Path: Skip heavy RAG literature search for direct database action queries
  if (!isAction) {
    sources = await performHybridRagSearch({ query, topK: 7 });
  }

  let contextText = "";
  if (sources.length > 0) {
    contextText = formatRagSourceContext(sources, {
      includePartialNotice: true,
    });
  } else if (isAction) {
    contextText =
      "Kullanıcı doğrudan bir veritabanı/araç işlemi gerçekleştirmek istemektedir. İlgili aracı (function call) uygun parametrelerle hemen çağırın.";
  } else {
    contextText =
      "Kütüphanenizde bu sorguyla doğrudan eşleşen veya yeterince alakalı bir kaynak bulunamadı. Lütfen sorgunuzu kütüphanenizdeki mevcut konulara yönelik olarak yeniden formüle edin.";
  }

  const userMessageText = `Kütüphane Kaynak Bağlamı:\n${contextText}\n\nKullanıcı Sorgusu:\n${query}`;

  return {
    sources,
    contextText,
    userMessageText,
  };
}

/**
 * Builds the initial Gemini chat contents payload with bounded conversation history.
 *
 * @param userPrompt - Final formatted prompt for the current turn.
 * @param history - Optional recent conversation messages.
 * @returns Array of contents objects for Gemini API.
 */
export function buildTurnChatContents(
  userPrompt: string,
  history?: Array<{ role: "user" | "model"; content: string }>,
): Array<Record<string, unknown>> {
  const contents: Array<Record<string, unknown>> = [];

  if (history && history.length > 0) {
    for (const msg of history.slice(-6)) {
      contents.push({ role: msg.role, parts: [{ text: msg.content }] });
    }
  }

  contents.push({ role: "user", parts: [{ text: userPrompt }] });

  return contents;
}
