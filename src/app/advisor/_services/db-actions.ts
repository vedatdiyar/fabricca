"use server";

import { db } from "@/db";
import { references, thesisCore, thesisBoxes, aiInsights } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface ReferenceItem {
  id: number;
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  abstract: string | null;
}

/**
 * Server Action to fetch all references for the list selection in Dijital Danışman Odası
 */
export async function getLibraryReferencesAction(): Promise<{
  success: boolean;
  references?: ReferenceItem[];
  error?: string;
}> {
  try {
    const allRefs = await db
      .select({
        id: references.id,
        title: references.title,
        authors: references.authors,
        year: references.year,
        doi: references.doi,
        abstract: references.abstract,
      })
      .from(references)
      .orderBy(references.createdAt);

    return {
      success: true,
      references: allRefs,
    };
  } catch (error) {
    console.error("getLibraryReferencesAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Referans listesi çekilemedi.",
    };
  }
}

/**
 * Server Action to save a specific brilliant academic insight into the Fikir Sepeti
 */
export async function saveInsightAction(
  insightText: string,
  noteId?: number,
): Promise<{
  success: boolean;
  insightId?: number;
  error?: string;
}> {
  try {
    if (!insightText || !insightText.trim()) {
      return { success: false, error: "Öngörü içeriği boş olamaz." };
    }

    const [newInsight] = await db
      .insert(aiInsights)
      .values({
        insightText: insightText.trim(),
        noteId: noteId || null,
      })
      .returning();

    return {
      success: true,
      insightId: newInsight.id,
    };
  } catch (error) {
    console.error("saveInsightAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Öngörü kaydedilirken hata oluştu.",
    };
  }
}

/**
 * Server Action using Drizzle ORM to update a specific thesis box description content by its ID.
 * Triggered after user approval in Advisor Chat room.
 */
export async function updateThesisBoxContentAction(
  boxId: number,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanBoxId = Number(boxId);
    console.log(
      `[updateThesisBoxContentAction] Attempting database update for boxId: ${boxId} (parsed as number: ${cleanBoxId})`,
    );

    if (isNaN(cleanBoxId)) {
      return { success: false, error: `Geçersiz Kutu ID: ${boxId}` };
    }

    const updatedRows = await db
      .update(thesisBoxes)
      .set({ description: content })
      .where(eq(thesisBoxes.id, cleanBoxId))
      .returning();

    console.log(
      `[updateThesisBoxContentAction] Update query execution complete. Affected row count: ${updatedRows.length}`,
      updatedRows,
    );

    if (updatedRows.length === 0) {
      console.warn(
        `[updateThesisBoxContentAction] Warning: No row was updated for boxId: ${cleanBoxId}. Row may not exist.`,
      );
      return {
        success: false,
        error: `Güncellenecek kutu bulunamadı (Kutu ID: ${cleanBoxId}).`,
      };
    }

    // Revalidate paths for real-time dashboard and card index room synchronization
    revalidatePath("/dashboard");
    revalidatePath("/kartoteks");

    return { success: true };
  } catch (error) {
    console.error("updateThesisBoxContentAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez kutusu güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action using Drizzle ORM to update the methodology and historical framework of the
 * main Thesis Constitution (thesis_core table).
 * Triggered after user approval in Advisor Chat room.
 */
export async function updateThesisCoreFrameworkAction(
  methodologyContent: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      `[updateThesisCoreFrameworkAction] Updating thesis_core methodology with new content...`,
    );

    // Single tenant system has only one row in thesisCore table. Get the first core row.
    const [core] = await db.select().from(thesisCore).limit(1);
    if (!core) {
      console.warn(
        "[updateThesisCoreFrameworkAction] Error: No thesis_core record found.",
      );
      return {
        success: false,
        error: "Güncellenecek Tez Anayasası (thesis_core) kaydı bulunamadı.",
      };
    }

    const updatedRows = await db
      .update(thesisCore)
      .set({ methodology: methodologyContent })
      .where(eq(thesisCore.id, core.id))
      .returning();

    console.log(
      `[updateThesisCoreFrameworkAction] Thesis core methodology updated. Affected row count: ${updatedRows.length}`,
      updatedRows,
    );

    if (updatedRows.length === 0) {
      return {
        success: false,
        error: "Tez Anayasası güncellenemedi.",
      };
    }

    // Revalidate paths for real-time dashboard synchronization
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("updateThesisCoreFrameworkAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez anayasası güncellenirken bir hata oluştu.",
    };
  }
}
