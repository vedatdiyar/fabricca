import { db } from "@/db";
import { thesisCore, thesisBoxes, notes } from "@/db/schema";
import { GetThesisCoreResult } from "../actions";
import { eq, sql } from "drizzle-orm";

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

    // Fetch associated boxes in correct order
    const boxesList = await db
      .select()
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisCoreId, core.id))
      .orderBy(thesisBoxes.order);

    // Dynamic count fetch for each box's personal reading notes
    const boxesWithCounts = await Promise.all(
      boxesList.map(async (box) => {
        const [noteCountRes] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(notes)
          .where(eq(notes.boxId, box.id));

        return {
          id: box.id,
          name: box.name,
          description: box.description,
          noteCount: noteCountRes?.count || 0,
        };
      }),
    );

    return {
      success: true,
      data: {
        id: core.id,
        title: core.title,
        researchQuestion: core.researchQuestion,
        argument: core.argument,
        methodology: core.methodology,
        boxes: boxesWithCounts,
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

/**
 * Server Action to reset (delete) the Thesis Constitution from Neon PostgreSQL.
 * Cascades to automatically delete thesis boxes via DB rules.
 */
export async function resetThesisCoreAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log("[resetThesisCoreAction] Resetting thesis core parameters...");
    await db.delete(thesisCore);
    return { success: true };
  } catch (error) {
    console.error("resetThesisCoreAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez anayasası sıfırlanırken bir hata oluştu.",
    };
  }
}
