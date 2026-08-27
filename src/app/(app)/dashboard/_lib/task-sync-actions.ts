"use server";

import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { syncAcademicTasks } from "../_services/task-sync-service";
import {
  runThesisStrategistAudit,
  type StrategistAuditResult,
} from "../_services/task-strategist-service";

/**
 * Explicitly triggers academic task synchronization.
 *
 * @returns Sync statistics or an error
 */
export async function syncTasksAction(): Promise<{
  success: boolean;
  autoCompletedCount?: number;
  newTasksCreatedCount?: number;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const result = await syncAcademicTasks(session.userId);
    revalidatePath("/dashboard");
    return { success: true, ...result };
  } catch (err) {
    log.error("sync_tasks_action_failed", {
      service: "dashboard",
      error: err,
    });
    return {
      success: false,
      error: "Görevler senkronize edilirken bir hata oluştu.",
    };
  }
}

/**
 * Runs the Gemini Flash LLM Thesis Strategist audit.
 *
 * @returns Strategist result or an error
 */
export async function runStrategistAuditAction(): Promise<{
  success: boolean;
  data?: StrategistAuditResult;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const result = await runThesisStrategistAudit(session.userId);
    if (result.success) {
      revalidatePath("/dashboard");
    }
    return result;
  } catch (err) {
    log.error("run_strategist_audit_action_failed", {
      service: "dashboard",
      error: err,
    });
    return {
      success: false,
      error: "Tez stratejisi analizi sırasında bir hata oluştu.",
    };
  }
}
