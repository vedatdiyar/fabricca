import { db } from "@/db";
import {
  thesisCore,
  thesisBoxes,
  notes,
  references,
  pdfChunks,
  tasks,
  aiInsights,
} from "@/db/schema";
import { GetThesisCoreResult } from "../actions";
import { eq, sql } from "drizzle-orm";
import { deletePdfFromR2 } from "@/app/library/_services/r2.service";
import { revalidatePath } from "next/cache";

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
 * Server Action to reset (delete) the entire thesis, all references, notes, chunks, tasks, and insights.
 * Also cleans up all uploaded PDF files from Cloudflare R2 securely.
 */
export async function resetThesisCoreAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log(
      "[resetThesisCoreAction] Resetting all thesis-related data (complete database and storage clear)...",
    );

    // 1. Fetch all references to clean up physical PDF files in Cloudflare R2
    const allRefs = await db.select().from(references);

    // 2. Iterate and delete objects from R2
    for (const ref of allRefs) {
      if (ref.pdfUrl && ref.pdfUrl !== "recommended-onboarding") {
        try {
          await deletePdfFromR2(ref.pdfUrl);
          console.log(
            `Successfully deleted R2 file during reset: ${ref.pdfUrl}`,
          );
        } catch (r2Error) {
          console.error(
            `Failed to delete R2 file during reset: ${ref.pdfUrl}`,
            r2Error,
          );
        }
      }
    }

    // 3. Clear database tables sequentially
    await db.delete(aiInsights);
    await db.delete(references); // Cascades to notes, pdf_chunks, and tasks
    await db.delete(thesisCore); // Cascades to thesisBoxes

    // 4. Revalidate all major paths
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
    revalidatePath("/library");
    revalidatePath("/advisor");

    return { success: true };
  } catch (error) {
    console.error("resetThesisCoreAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez ve ilişkili tüm veriler sıfırlanırken bir hata oluştu.",
    };
  }
}
