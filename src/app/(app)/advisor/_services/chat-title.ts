import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { FLASH_LITE_35 } from "@/lib/constants";
import { buildChatTitlePromptPayload } from "../_prompts/chat-title.prompt";

const CHAT_TITLE_ZOD_SCHEMA = z.object({
  title: z
    .string()
    .describe(
      "3 ila 5 kelimelik, net, öz ve Türkçe bir akademik sohbet başlığı.",
    ),
});

const CHAT_TITLE_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "3 ila 5 kelimelik, net, öz ve Türkçe bir akademik sohbet başlığı.",
    },
  },
  required: ["title"],
  additionalProperties: false,
};

/**
 * Generates a concise 3-5 word academic topic title using Gemini Flash Lite 3.5.
 *
 * @param userQuery - The first user prompt query to derive the title from.
 * @returns The generated title string.
 * @throws When the model fails to produce a non-empty title.
 */
export async function generateChatTitle(userQuery: string): Promise<string> {
  const payload = buildChatTitlePromptPayload(userQuery);

  const res = await generateGeminiStructuredContent<{ title: string }>(
    FLASH_LITE_35,
    payload.systemInstruction,
    payload.userPrompt,
    CHAT_TITLE_JSON_SCHEMA,
    undefined,
    {
      zodSchema: CHAT_TITLE_ZOD_SCHEMA,
      payloadStage: "advisor_chat_title",
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    },
  );

  const title = res.title?.trim().slice(0, 100);
  if (!title) {
    throw new Error("Başlık üretilemedi.");
  }
  return title;
}
