"use server";

import { getSession } from "@/lib/session";
import { generateChatTitle } from "@/app/(app)/advisor/_services/chat-title";
import { handleActionError } from "@/lib/errors/handle-error";
import { renameChatSession } from "./session-actions";

/**
 * Generates a concise 3-5 word academic topic title using Gemini Flash Lite 3.5
 * and updates the chat session title in the database.
 *
 * @param sessionId - The chat session ID to update.
 * @param userQuery - The first user prompt query.
 * @returns Operation result with generated title.
 */
export async function generateChatTitleAction(
  sessionId: number,
  userQuery: string,
): Promise<{ success: boolean; title?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

  try {
    const title = await generateChatTitle(userQuery);
    await renameChatSession(sessionId, title);
    return { success: true, title };
  } catch (error) {
    return handleActionError(error);
  }
}
