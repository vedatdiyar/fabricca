import { HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import { getAi } from "@/services/ai";
import { dispatchGeminiCall } from "@/services/ai/gemini-scheduler";
import { buildAdvisorTurnPromptPayload } from "../prompts/turn.prompt";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import type { PipelineSseWriter } from "./orchestrator";

/** Resolved stream object returned by Gemini's `generateContentStream`. */
type GeminiContentStream = Awaited<
  ReturnType<ReturnType<typeof getAi>["models"]["generateContentStream"]>
>;

export interface SocraticStreamParams {
  sourceContext: string;
  originalDraft: string;
  writer: PipelineSseWriter;
}

/**
 * Streams the Socratic Advisor response via Gemini 2.5 Flash Lite streaming API.
 *
 * @param params - Context, user draft, and SSE writer.
 * @returns Complete accumulated response text.
 */
export async function streamSocraticAdvisorResponse(
  params: SocraticStreamParams,
): Promise<string> {
  const { sourceContext, originalDraft, writer } = params;

  const userMessageText = `Kütüphane Kaynak Bağlamı:\n${sourceContext}\n\nKullanıcı Taslağı:\n${originalDraft}`;
  const payload = buildAdvisorTurnPromptPayload(
    "SOCRATIC_ADVISOR",
    userMessageText,
  );
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: payload.userPrompt,
        },
      ],
    },
  ];

  let fullText = "";

  const stream = await dispatchGeminiCall<GeminiContentStream>({
    model: FLASH_LITE_35,
    task: async ({ model, apiKey }) => {
      const ai = getAi(apiKey);
      const stream = await ai.models.generateContentStream({
        model,
        contents: contents as unknown as Parameters<
          typeof ai.models.generateContentStream
        >[0]["contents"],
        config: {
          systemInstruction: payload.systemInstruction,
          seed: GEMINI_SEED,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        },
      });
      return stream;
    },
  });

  for await (const chunk of stream) {
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

    if (text) {
      fullText += text;
      writer.delta(text);
    }
  }

  return fullText;
}
