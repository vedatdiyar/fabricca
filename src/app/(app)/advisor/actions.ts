"use server";

import {
  getChatSessions as _getChatSessions,
  createChatSession as _createChatSession,
  renameChatSession as _renameChatSession,
  deleteChatSession as _deleteChatSession,
} from "./session-actions";
import {
  getChatMessages as _getChatMessages,
  saveChatMessage as _saveChatMessage,
  updateChatMessageToolCalls as _updateChatMessageToolCalls,
} from "./message-actions";
import { generateChatTitleAction as _generateChatTitleAction } from "./title-actions";

export type {
  ChatSessionListItem,
  ChatSessionsResult,
} from "./session-actions";

export async function getChatSessions() {
  return _getChatSessions();
}

export async function createChatSession(title: string) {
  return _createChatSession(title);
}

export async function renameChatSession(sessionId: number, newTitle: string) {
  return _renameChatSession(sessionId, newTitle);
}

export async function deleteChatSession(sessionId: number) {
  return _deleteChatSession(sessionId);
}

export async function getChatMessages(sessionId: number) {
  return _getChatMessages(sessionId);
}

export async function saveChatMessage(
  ...args: Parameters<typeof _saveChatMessage>
) {
  return _saveChatMessage(...args);
}

export async function updateChatMessageToolCalls(
  ...args: Parameters<typeof _updateChatMessageToolCalls>
) {
  return _updateChatMessageToolCalls(...args);
}

export async function generateChatTitleAction(
  sessionId: number,
  firstUserMessage: string,
) {
  return _generateChatTitleAction(sessionId, firstUserMessage);
}
