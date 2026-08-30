import { eq, asc } from "drizzle-orm";
import { db } from "@/core/db";
import { sessions, messages, outlines } from "@/core/db/schema";
import { HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import { getAi } from "@/core/services/ai";
import { dispatchGeminiCall } from "@/core/services/ai/gemini-scheduler";
import { FLASH_37, GEMINI_SEED } from "@/lib/constants";
import { buildOfficeDefensePromptPayload } from "../_prompts/office-defense.prompt";
import type { AdvisorStreamWriter } from "./stream";
import type { PipelineResultData, JuryCritique } from "./pipeline/types";

export interface StreamOfficeDefenseInput {
  userId: number;
  sessionId: number;
  userMessage?: string;
  writer: AdvisorStreamWriter;
}

type GeminiContentStream = Awaited<
  ReturnType<ReturnType<typeof getAi>["models"]["generateContentStream"]>
>;

/**
 * Streams the Socratic Professor's Office Defense response.
 *
 * @param input - userId, sessionId, optional userMessage, SSE stream writer.
 */
export async function streamOfficeDefense(
  input: StreamOfficeDefenseInput,
): Promise<void> {
  const { userId, sessionId, userMessage, writer } = input;

  // 1. Fetch Session
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || session.userId !== userId) {
    writer.send("error", {
      message: "Oturum bulunamadı veya yetkisiz erişim.",
    });
    writer.done();
    return;
  }

  // 2. Fetch Outline
  let outlineTitle = "Tez Bölümü";
  let outlineDescription: string | undefined = undefined;
  if (session.outlineId) {
    const [outline] = await db
      .select()
      .from(outlines)
      .where(eq(outlines.id, session.outlineId))
      .limit(1);
    if (outline) {
      outlineTitle = outline.title;
      outlineDescription = outline.description || undefined;
    }
  }

  // 3. Fetch Messages to get review data & history
  const sessionMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  // Extract jury critiques and audit summary from initial message's pipelineData
  let juryCritiques: JuryCritique[] = [];
  let auditSummary = "";
  for (const msg of sessionMessages) {
    if (msg.pipelineData) {
      const data = msg.pipelineData as PipelineResultData;
      if (data.juryCritiques && data.juryCritiques.length > 0) {
        juryCritiques = data.juryCritiques;
      }
      if (data.audit?.summary) {
        auditSummary = data.audit.summary;
      }
    }
  }

  // If student sent a message, persist it first
  if (userMessage && userMessage.trim()) {
    await db.insert(messages).values({
      sessionId,
      role: "user",
      content: userMessage.trim(),
    });
  }

  // Build prompt
  const payload = buildOfficeDefensePromptPayload({
    draftText: session.draftText || "",
    outlineTitle,
    outlineDescription,
    juryCritiques,
    auditSummary,
    userMessage: userMessage?.trim() || undefined,
  });

  // Prepare Gemini contents with conversation history
  const contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> = [];

  // Add conversation history (excluding the first raw audit card if already summarized)
  const historySlice = sessionMessages.filter(
    (m) => m.role === "user" || (m.role === "assistant" && !m.pipelineData),
  );

  for (const m of historySlice.slice(-8)) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  // Append latest turn prompt
  contents.push({
    role: "user",
    parts: [{ text: payload.userPrompt }],
  });

  let fullText = "";

  const stream = await dispatchGeminiCall<GeminiContentStream>({
    model: FLASH_37,
    task: async ({ model, apiKey }) => {
      const ai = getAi(apiKey);
      return ai.models.generateContentStream({
        model,
        contents: contents as unknown as Parameters<
          typeof ai.models.generateContentStream
        >[0]["contents"],
        config: {
          systemInstruction: payload.systemInstruction,
          seed: GEMINI_SEED,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
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

  // Persist advisor's streamed response
  if (fullText.trim()) {
    await db.insert(messages).values({
      sessionId,
      role: "assistant",
      persona: "advisor",
      content: fullText.trim(),
    });
  }

  writer.done();
}
