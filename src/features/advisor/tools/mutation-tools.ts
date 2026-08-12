import type { MutationToolHandler, MutationToolResult } from "./mutation-types";
import { matrixMutations } from "./matrix-mutations";
import { boxMutations } from "./box-mutations";
import { sourceMutations } from "./source-mutations";
import { noteMutations } from "./note-mutations";
import { taskMutations } from "./task-mutations";
import { outlineMutations } from "./outline-mutations";

const MUTATION_TOOL_HANDLERS: Record<string, MutationToolHandler> = {
  ...matrixMutations,
  ...boxMutations,
  ...sourceMutations,
  ...noteMutations,
  ...taskMutations,
  ...outlineMutations,
};

/**
 * Fetches the real current database state for an entity before mutation,
 * so the UI can render an accurate Old State vs New State preview.
 *
 * @param name - The tool function name.
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The existing record state object, or undefined.
 */
export async function getToolPreviousState(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<Record<string, unknown> | undefined> {
  const handler = MUTATION_TOOL_HANDLERS[name];
  if (!handler) return undefined;
  try {
    return await handler.getPreviousState(args, userId);
  } catch {
    return undefined;
  }
}

/**
 * Executes mutation database tools after explicit user approval in the UI.
 *
 * @param toolName - The function name.
 * @param args - Object containing arguments.
 * @param userId - The ID of the authenticated user.
 * @returns Object with success status, user-facing message, generated data, and captured previous state for undo.
 */
export async function executeMutationTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const handler = MUTATION_TOOL_HANDLERS[toolName];
  if (!handler) {
    return {
      success: false,
      message: `Bilinmeyen veritabanı değişikliği: ${toolName}`,
    };
  }
  return handler.execute(args, userId);
}
