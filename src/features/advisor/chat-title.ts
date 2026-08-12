import { z } from "zod";
import { generateCerebrasStructuredContent } from "@/services/ai";
import { CEREBRAS_MODEL } from "@/lib/constants";
import { buildChatTitlePromptPayload } from "./prompts/chat-title.prompt";

const CHAT_TITLE_ZOD_SCHEMA = z.object({
  title: z
    .string()
    .describe(
      "3 ila 5 kelimelik, net, öz ve Türkçe bir akademik sohbet başlığı.",
    ),
});

const CHAT_TITLE_JSON_SCHEMA = {
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
 * Generates a concise 3-5 word academic topic title using Cerebras Gemma 4 (gemma-4-31b).
 *
 * @param userQuery - The first user prompt query to derive the title from.
 * @returns The generated title string.
 * @throws When the model fails to produce a non-empty title.
 */
export async function generateChatTitle(userQuery: string): Promise<string> {
  const payload = buildChatTitlePromptPayload(userQuery);

  const res = await generateCerebrasStructuredContent<{ title: string }>(
    CEREBRAS_MODEL,
    payload.systemInstruction,
    payload.userPrompt,
    CHAT_TITLE_JSON_SCHEMA,
    undefined,
    {
      zodSchema: CHAT_TITLE_ZOD_SCHEMA,
      payloadStage: "advisor_chat_title",
    },
  );

  const title = res.title?.trim().slice(0, 100);
  if (!title) {
    throw new Error("Başlık üretilemedi.");
  }
  return title;
}
