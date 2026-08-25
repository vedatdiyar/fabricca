import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { FLASH_LITE_35 } from "@/lib/constants";
import { createFlowId, Logger } from "@/lib/logger";

export type AdvisorPersona = "SOCRATIC_ADVISOR" | "TEZ_ASSISTANT";

export type AdvisorMode = "DIRECT" | "PIPELINE";

export interface ClassifierResult {
  persona: AdvisorPersona;
  reasoning: string;
  isActionQuery: boolean;
  mode: AdvisorMode;
}

const classifierZodSchema = z.object({
  persona: z.enum(["SOCRATIC_ADVISOR", "TEZ_ASSISTANT"]),
  reasoning: z.string(),
  isActionQuery: z.boolean(),
  mode: z.enum(["DIRECT", "PIPELINE"]),
});

const classifierJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    persona: {
      type: "string",
      enum: ["SOCRATIC_ADVISOR", "TEZ_ASSISTANT"],
      description:
        "SOCRATIC_ADVISOR if user presents a thesis idea, hypothesis, writing plan, chapter structure, or asks for feedback/critique. TEZ_ASSISTANT if user asks factual definition, literature search, APA rule, or database operation.",
    },
    reasoning: {
      type: "string",
      description: "Brief reason for classification in Turkish.",
    },
    isActionQuery: {
      type: "boolean",
      description:
        "true if user explicitly requests a database creation/update/deletion or tool execution.",
    },
    mode: {
      type: "string",
      enum: ["DIRECT", "PIPELINE"],
      description:
        "PIPELINE if the user message is a multi-sentence paragraph/draft text (typically an English thesis passage) to be audited, critically discussed, and polished. DIRECT if it is a standalone question (APA rule, concept question, database action) to be answered directly.",
    },
  },
  required: ["persona", "reasoning", "isActionQuery", "mode"],
  additionalProperties: false,
};

import { buildClassifierPromptPayload } from "../_prompts/classifier.prompt";

/**
 * Classifies user intent into SOCRATIC_ADVISOR vs TEZ_ASSISTANT using Gemini Flash Lite 3.5,
 * and decides whether the message is a standalone question (DIRECT) or a draft paragraph (PIPELINE).
 *
 * @param query - The user's current message.
 * @param history - Optional recent chat history context.
 * @returns The classification result containing persona, reasoning, isActionQuery flag, and mode.
 */
export async function classifyAdvisorIntent(
  query: string,
  history?: Array<{ role: string; content: string }>,
): Promise<ClassifierResult> {
  try {
    let historyText = "";
    if (history && history.length > 0) {
      historyText = history
        .slice(-4)
        .map(
          (m) => `${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.content}`,
        )
        .join("\n");
    }

    const payload = buildClassifierPromptPayload({
      userQuery: query,
      historyText,
    });

    const res = await generateGeminiStructuredContent<ClassifierResult>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      classifierJsonSchema,
      undefined,
      {
        zodSchema: classifierZodSchema,
        payloadStage: "advisor_intent_classifier",
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    );

    const isDirectActionMutation =
      /\b(güncelle\w*|değiştir\w*|ekle\w*|sil\w*|oluştur\w*|kaydet\w*)\b/i.test(
        query,
      ) &&
      /\b(matris\w*|çerçeve\w*|kuram\w*|problem\w*|yöntem\w*|metodoloji\w*|kutu\w*|görev\w*|bölüm\w*|kaynak\w*|not\w*)\b/i.test(
        query,
      );

    if (isDirectActionMutation) {
      return {
        ...res,
        persona: "TEZ_ASSISTANT",
        isActionQuery: true,
        mode: "DIRECT",
      };
    }

    return res;
  } catch (error) {
    new Logger(createFlowId()).warn("Advisor intent classification fallback:", {
      service: "advisor",
      error,
    });
    // Safe fallback based on simple regex heuristics
    const isAction =
      /\b(ekle\w*|oluştur\w*|sil\w*|güncelle\w*|değiştir\w*|düzenle\w*|tamamla\w*|göster\w*)\b/i.test(
        query,
      );
    const isSocratic =
      /\b(tezim\w*|yazacağım|düşünüyorum|hipotez\w*|yöntem\w*|bölüm\w*|fikrim\w*|nasıl\w*|eleştir\w*)\b/i.test(
        query,
      );

    const wordCount = query.trim().split(/\s+/).length;
    const hasMultiSentence = /\w+\s+\w+.*[.!?]["']?\s+/.test(query);
    const hasNewline = /\n/.test(query);
    const isRedactionRequest =
      /\b(polish|proofread|redakte|gözden geçir|düzelt\.*|revize|review my text)\b/i.test(
        query,
      );

    return {
      persona: isSocratic ? "SOCRATIC_ADVISOR" : "TEZ_ASSISTANT",
      reasoning: "Fallback classification",
      isActionQuery: isAction,
      mode:
        isRedactionRequest || wordCount > 40 || hasNewline || hasMultiSentence
          ? "PIPELINE"
          : "DIRECT",
    };
  }
}
