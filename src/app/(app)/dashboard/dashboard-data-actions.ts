"use server";

import { createFlowId, Logger } from "@/lib/logger";
import { boxes, sources } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { getUsersMatrixAndBoxesWithResources } from "./_services/box-service";

/**
 * Fetches the current user's parent boxes and library resources so the client
 * can re-sync its local article state after literature expansion inserts new
 * sources into the database.
 *
 * @returns The fresh parent boxes and resources, or an error message.
 */
export async function refreshDashboardDataAction(): Promise<
  | {
      success: true;
      data: {
        parentBoxes: (typeof boxes.$inferSelect)[];
        resources: (typeof sources.$inferSelect)[];
      };
    }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const boxResult = await getUsersMatrixAndBoxesWithResources(session.userId);
    if ("error" in boxResult) {
      return { success: false, error: boxResult.error };
    }

    return {
      success: true,
      data: {
        parentBoxes: boxResult.data.parentBoxes,
        resources: boxResult.data.resources,
      },
    };
  } catch (err) {
    log.error("refresh_dashboard_data_failed", {
      service: "dashboard",
      error: err,
    });
    return {
      success: false,
      error: "Panel verileri yenilenirken bir hata oluştu.",
    };
  }
}
