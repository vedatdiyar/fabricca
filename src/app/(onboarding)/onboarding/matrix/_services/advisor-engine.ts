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
import type { MatrixFieldKey } from "./rubrics";

/** Message turn structure for advisor dialogue. */
export interface AdvisorMessage {
  role: "user" | "model";
  content: string;
}

/** Potential structured update for one of the matrix quadrants. */
export interface MatrixFieldUpdate {
  field: MatrixFieldKey;
  value: string;
  explanation?: string;
}

/** Response payload from an advisor turn. */
export interface AdvisorTurnResponse {
  replyText: string;
  matrixUpdate?: MatrixFieldUpdate;
}

const ONBOARDING_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "crystallizeMatrixQuadrant",
    description:
      "Müzakere sonucunda araştırmacıyla üzerinde uzlaşılan veya yeterli akademik olgunluğa ulaşan bir matris kadranını (Araştırma Problemi, Kuramsal Çerçeve, Veri Kaynağı, Metodoloji) sisteme kaydeder ve mühürler. Kadran olgunlaştığında bu aracı çağırın.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: [
            "subjectProblem",
            "theoreticalFramework",
            "primaryMaterial",
            "methodology",
          ],
          description: "Mühürlenecek matris kadranının teknik anahtarı.",
        },
        value: {
          type: "string",
          description:
            "Matrise işlenecek, değişkenleri ve bağlamı net tanımlanmış yüksek akademik Türkçe kristalize metin.",
        },
        explanation: {
          type: "string",
          description:
            "Bu kadranın neden olgunlaştığına dair 1 cümlelik metodolojik gerekçe.",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "lookupPrecedentTheses",
    description:
      "Silently consults the institutional archive of 366,000+ defended master's and doctoral theses to review practical methodology implementations, sample sizes, and data collection bottlenecks.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Academic query describing research topic or methodology.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "lookupScholarlyLiterature",
    description:
      "Silently consults international scholarly literature (250M+ papers) to verify theoretical debates, key academic poles, and pioneer works.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Scholarly search query for theoretical papers.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "lookupEmpiricalContext",
    description:
      "Silently consults current local field reports, DergiPark publications, and sector data for empirical realities and emerging developments.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Empirical query for local context and field data.",
        },
      },
      required: ["query"],
    },
  },
];

/**
 * Executes a single conversational turn with the Socratic Academic Advisor (synchronous/non-streaming).
 * Uses FLASH_LITE_35, ThinkingLevel.LOW and parallel tool execution with Promise.all.
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
  let capturedMatrixUpdate: MatrixFieldUpdate | undefined;

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
        if (name === "crystallizeMatrixQuadrant") {
          const field = String(args.field ?? "") as MatrixFieldKey;
          const value = String(args.value ?? "");
          const explanation =
            typeof args.explanation === "string" ? args.explanation : undefined;

          if (
            [
              "subjectProblem",
              "theoreticalFramework",
              "primaryMaterial",
              "methodology",
            ].includes(field) &&
            value.trim()
          ) {
            capturedMatrixUpdate = {
              field,
              value: value.trim(),
              explanation,
            };
            toolResult = {
              status: "success",
              message: `Kadran '${field}' başarıyla matrise mühürlendi.`,
            };
          } else {
            toolResult = {
              status: "error",
              message: "Geçersiz kadran veya boş metin.",
            };
          }
        } else if (name === "lookupPrecedentTheses") {
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
    matrixUpdate: capturedMatrixUpdate,
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
 * Emits SSE deltas and executes tools (including native matrix crystallization) in parallel.
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
  let capturedMatrixUpdate: MatrixFieldUpdate | undefined;

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

    const isCrystallizing = functionCalls.some(
      (fc) => fc.name === "crystallizeMatrixQuadrant",
    );
    const isSearching = functionCalls.some(
      (fc) => fc.name !== "crystallizeMatrixQuadrant",
    );

    if (isCrystallizing) {
      writer.send("status", {
        message: "Danışman matris kadranını mühürlüyor...",
      });
    } else if (isSearching) {
      writer.send("status", {
        message: "Danışman literatürü ve emsal tez arşivini inceliyor...",
      });
    }

    // Astryx-like ChatToolCalls: emit running events for visible research tools
    const visibleCalls = functionCalls
      .filter((fc) => fc.name !== "crystallizeMatrixQuadrant")
      .map((fc, idx) => ({
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
      // Ensure original fc has stable id for strict matching
      if (!vc.original.id) vc.original.id = vc.id;
    }

    contents.push({
      role: "model",
      parts: turnModelParts,
    });

    // Execute requested tools in parallel via Promise.all (strict 3.5+ id+name matching)
    const toolResponses = await Promise.all(
      functionCalls.map(async (fc) => {
        const name = fc.name ?? "";
        const id = fc.id;
        const args = (fc.args ?? {}) as Record<string, unknown>;
        const query = typeof args.query === "string" ? args.query : "";

        let toolResult: unknown = {};
        if (name === "crystallizeMatrixQuadrant") {
          const field = String(args.field ?? "") as MatrixFieldKey;
          const value = String(args.value ?? "");
          const explanation =
            typeof args.explanation === "string" ? args.explanation : undefined;

          if (
            [
              "subjectProblem",
              "theoreticalFramework",
              "primaryMaterial",
              "methodology",
            ].includes(field) &&
            value.trim()
          ) {
            capturedMatrixUpdate = {
              field,
              value: value.trim(),
              explanation,
            };
            toolResult = {
              status: "success",
              message: `Kadran '${field}' başarıyla matrise mühürlendi.`,
            };
          } else {
            toolResult = {
              status: "error",
              message: "Geçersiz kadran veya boş metin.",
            };
          }
        } else if (name === "lookupPrecedentTheses") {
          toolResult = await queryPrecedentTheses(query);
        } else if (name === "lookupScholarlyLiterature") {
          toolResult = await queryScholarlyLiterature(query);
        } else if (name === "lookupEmpiricalContext") {
          toolResult = await queryEmpiricalContext(query);
        }

        // Emit done event for visible tools with result summary
        if (name !== "crystallizeMatrixQuadrant" && id) {
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
    matrixUpdate: capturedMatrixUpdate,
  };
}
