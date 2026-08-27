import { ThinkingLevel, type FunctionDeclaration } from "@google/genai";
import { getAi } from "@/core/services/ai";
import { dispatchGeminiCall } from "@/core/services/ai/gemini-scheduler";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import type { ThesisMatrix } from "@/lib/types";
import type { AdvisorStreamWriter } from "@/app/(app)/advisor/_services/stream";
import {
  extractTextFromChunk,
  extractFunctionCalls,
  collectModelParts,
} from "@/app/(app)/advisor/_services/tool-loop/stream-parser";
import {
  queryPrecedentTheses,
  queryScholarlyLiterature,
  queryEmpiricalContext,
} from "./advisor-tools";
import { buildAdvisorSystemPrompt } from "./advisor-prompt";

/** Message turn structure for advisor dialogue. */
export interface AdvisorMessage {
  role: "user" | "model";
  content: string;
}

/** Response payload from an advisor turn. */
export interface AdvisorTurnResponse {
  replyText: string;
}

const ONBOARDING_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "lookupPrecedentTheses",
    description:
      "Türkiye'deki 366.000+ onaylı yüksek lisans ve doktora tez arşivini (YÖK/Qdrant) tarar. Araştırmacının fikrinin daha önce nasıl çalışıldığını, hangi yöntem ve örneklemlerin kullanıldığını ve literatürdeki boşlukları denetlemek için kullanılır.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Akademik arama sorgusu veya araştırma konusu.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "lookupScholarlyLiterature",
    description:
      "Uluslararası akademik literatürü (OpenAlex - 250M+ makale) tarar. Temel kuramsal tartışmaları, öncü yazarları ve uluslararası literatürdeki akademik boşlukları doğrulamak için kullanılır.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Kuramsal veya tematik arama sorgusu.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "lookupEmpiricalContext",
    description:
      "Güncel saha verilerini, DergiPark makalelerini, raporları ve sektörel verileri tarar (Exa.ai). Veri kaynaklarının güncelliğini ve saha gerçekliğini test etmek için kullanılır.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Saha, veri kaynağı veya güncel rapor sorgusu.",
        },
      },
      required: ["query"],
    },
  },
];

/**
 * Executes a single conversational turn with the Socratic Academic Advisor (synchronous/non-streaming).
 * Uses FLASH_LITE_35, ThinkingLevel.MEDIUM and parallel tool execution with Promise.all.
 */
export async function runAdvisorTurn(
  history: AdvisorMessage[],
  currentMatrix: Partial<ThesisMatrix>,
): Promise<AdvisorTurnResponse> {
  const systemInstruction = buildAdvisorSystemPrompt(currentMatrix);

  type GeminiContentItem = {
    role: "user" | "model";
    parts: Array<
      | { text: string }
      | { functionCall: { name: string; args: Record<string, unknown> } }
      | { functionResponse: { name: string; response: Record<string, unknown> } }
    >;
  };

  const contents: GeminiContentItem[] = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  let loopLimit = 3;
  let finalReply = "";

  while (loopLimit > 0) {
    loopLimit--;

    const response = await dispatchGeminiCall({
      model: FLASH_LITE_35,
      task: async ({ model, apiKey }) => {
        const ai = getAi(apiKey);
        return ai.models.generateContent({
          model,
          contents: contents as never,
          config: {
            systemInstruction,
            seed: GEMINI_SEED,
            tools: [{ functionDeclarations: ONBOARDING_TOOL_DECLARATIONS }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        });
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const functionCalls = parts.filter(
      (
        p,
      ): p is {
        functionCall: {
          id?: string;
          name: string;
          args: Record<string, unknown>;
        };
      } => "functionCall" in p && Boolean(p.functionCall),
    );

    const textParts = parts.filter(
      (p): p is { text: string } => "text" in p && typeof p.text === "string",
    );

    if (textParts.length > 0) {
      finalReply += textParts.map((p) => p.text).join("\n");
    }

    if (functionCalls.length === 0) {
      break;
    }

    // Append full model parts (including thoughtSignature) for 3.5+ thought preservation
    contents.push({
      role: "model",
      parts: parts as unknown as GeminiContentItem["parts"],
    });

    // Execute requested tools in parallel via Promise.all (strict 3.5+ id+name matching)
    const toolResponses = await Promise.all(
      functionCalls.map(async (fc) => {
        const { name, args } = fc.functionCall;
        const id = (fc.functionCall as { id?: string }).id;
        const query = typeof args.query === "string" ? args.query : "";

        let toolResult: unknown = {};
        if (name === "lookupPrecedentTheses") {
          toolResult = await queryPrecedentTheses(query);
        } else if (name === "lookupScholarlyLiterature") {
          toolResult = await queryScholarlyLiterature(query);
        } else if (name === "lookupEmpiricalContext") {
          toolResult = await queryEmpiricalContext(query);
        }

        return {
          functionResponse: {
            ...(id ? { id } : {}),
            name,
            response: { output: toolResult },
          },
        };
      }),
    );

    // Append tool responses back as user role for Gemini (id+name strictly matched)
    contents.push({
      role: "user",
      parts: toolResponses,
    });
  }

  return {
    replyText: finalReply.trim(),
  };
}

/**
 * Resolved stream object returned by Gemini's generateContentStream.
 */
type GeminiContentStream = Awaited<
  ReturnType<ReturnType<typeof getAi>["models"]["generateContentStream"]>
>;

/**
 * Executes a streaming conversational turn with the Socratic Academic Advisor.
 * Emits SSE deltas and executes silent research tools in parallel.
 */
export async function runAdvisorTurnStream(
  writer: AdvisorStreamWriter,
  options: {
    history: AdvisorMessage[];
    currentMatrix: Partial<ThesisMatrix>;
  },
): Promise<AdvisorTurnResponse> {
  const { history, currentMatrix } = options;
  const systemInstruction = buildAdvisorSystemPrompt(currentMatrix);

  type GeminiContentItem = {
    role: "user" | "model";
    parts: Array<
      | { text: string }
      | { functionCall: { name: string; args: Record<string, unknown> } }
      | { functionResponse: { name: string; response: Record<string, unknown> } }
      | Record<string, unknown>
    >;
  };

  const contents: GeminiContentItem[] = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  let loopLimit = 3;
  let fullAccumulatedText = "";

  while (loopLimit > 0) {
    loopLimit--;

    const stream = await dispatchGeminiCall<GeminiContentStream>({
      model: FLASH_LITE_35,
      task: async ({ model, apiKey }) => {
        const ai = getAi(apiKey);
        return ai.models.generateContentStream({
          model,
          contents: contents as never,
          config: {
            systemInstruction,
            seed: GEMINI_SEED,
            tools: [{ functionDeclarations: ONBOARDING_TOOL_DECLARATIONS }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        });
      },
    });

    const turnModelParts: Array<Record<string, unknown>> = [];
    const functionCalls: Array<{ id?: string; name?: string; args?: unknown }> = [];

    for await (const chunk of stream) {
      turnModelParts.push(...collectModelParts(chunk as never));

      const calls = extractFunctionCalls(chunk as never);
      if (calls.length > 0) {
        functionCalls.push(...calls);
      }

      const delta = extractTextFromChunk(chunk as never);
      if (delta) {
        fullAccumulatedText += delta;
        writer.delta(delta);
      }
    }

    if (functionCalls.length === 0) {
      break;
    }

    writer.send("status", {
      message: "Danışman literatürü ve emsal tez arşivini inceliyor...",
    });

    // Astryx-like ChatToolCalls: emit running events for visible research tools
    const visibleCalls = functionCalls.map((fc, idx) => ({
      id: fc.id ?? `tool-${Date.now()}-${idx}`,
      name: fc.name ?? "unknown",
      query: (fc.args as Record<string, unknown> | undefined)?.query ?? "",
      original: fc,
    }));
    for (const vc of visibleCalls) {
      writer.send("tool_call", {
        id: vc.id,
        name: vc.name,
        query: typeof vc.query === "string" ? vc.query : "",
        status: "running",
      });
      if (!vc.original.id) vc.original.id = vc.id;
    }

    contents.push({
      role: "model",
      parts: turnModelParts,
    });

    // Execute requested research tools in parallel via Promise.all (strict 3.5+ id+name matching)
    const toolResponses = await Promise.all(
      functionCalls.map(async (fc) => {
        const name = fc.name ?? "";
        const id = fc.id;
        const args = (fc.args ?? {}) as Record<string, unknown>;
        const query = typeof args.query === "string" ? args.query : "";

        let toolResult: unknown = {};
        if (name === "lookupPrecedentTheses") {
          toolResult = await queryPrecedentTheses(query);
        } else if (name === "lookupScholarlyLiterature") {
          toolResult = await queryScholarlyLiterature(query);
        } else if (name === "lookupEmpiricalContext") {
          toolResult = await queryEmpiricalContext(query);
        }

        // Emit done event for visible tools with result summary
        if (id) {
          const count = Array.isArray(toolResult) ? toolResult.length : 0;
          const titles = Array.isArray(toolResult)
            ? (toolResult as Array<Record<string, unknown>>)
                .slice(0, 2)
                .map((r) => (typeof r.title === "string" ? r.title : ""))
                .filter(Boolean)
            : [];
          writer.send("tool_call", {
            id,
            name,
            query,
            status: "done",
            resultCount: count,
            resultTitles: titles,
          });
        }

        return {
          functionResponse: {
            ...(id ? { id } : {}),
            name,
            response: { output: toolResult },
          },
        };
      }),
    );

    contents.push({
      role: "user",
      parts: toolResponses,
    });
  }

  return {
    replyText: fullAccumulatedText.trim(),
  };
}
