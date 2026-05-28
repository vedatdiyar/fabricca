"use server";

import { db } from "@/db";
import { thesisCore, thesisBoxes } from "@/db/schema";

/**
 * Server Action to finalize and save the structured "Tez Anayasası" (Thesis Core) into Neon PostgreSQL via Drizzle ORM.
 */
export async function saveThesisCoreAction(data: {
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
  boxes?: {
    name: string;
    description: string;
  }[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (
      !data.title ||
      !data.researchQuestion ||
      !data.argument ||
      !data.methodology
    ) {
      return {
        success: false,
        error: "Tez anayasasının tüm alanları doldurulmalıdır.",
      };
    }

    // Insert into Neon PostgreSQL
    const [newThesis] = await db
      .insert(thesisCore)
      .values({
        title: data.title.trim(),
        researchQuestion: data.researchQuestion.trim(),
        argument: data.argument.trim(),
        methodology: data.methodology.trim(),
      })
      .returning();

    // Insert the generated thesis boxes if any
    if (data.boxes && data.boxes.length > 0) {
      await db.insert(thesisBoxes).values(
        data.boxes.map((box, index) => ({
          thesisCoreId: newThesis.id,
          name: box.name.trim(),
          description: box.description?.trim() || null,
          order: index,
        })),
      );
    }

    return { success: true };
  } catch (error) {
    console.error("saveThesisCoreAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez anayasası kaydedilirken hata oluştu.",
    };
  }
}
