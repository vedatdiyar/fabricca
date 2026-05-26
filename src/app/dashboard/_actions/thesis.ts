import { db } from "@/db";
import { thesisCore } from "@/db/schema";
import { GetThesisCoreResult } from "../actions";

/**
 * Server Action to retrieve the thesis core parameters (Thesis Constitution) from Neon PostgreSQL.
 * Since this is a single-user system, we fetch the first (and only) row. We accept userId to satisfy
 * user requirements, logging it dynamically or utilizing it for future multi-tenant expansions.
 */
export async function getThesisCoreAction(
  userId?: string,
): Promise<GetThesisCoreResult> {
  try {
    if (userId) {
      console.log(
        `[getThesisCoreAction] Fetching thesis core for user: ${userId}`,
      );
    }

    const [core] = await db.select().from(thesisCore).limit(1);

    if (!core) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        title: core.title,
        researchQuestion: core.researchQuestion,
        argument: core.argument,
        methodology: core.methodology,
      },
    };
  } catch (error) {
    console.error("getThesisCoreAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez anayasası yüklenirken bir hata oluştu.",
    };
  }
}
