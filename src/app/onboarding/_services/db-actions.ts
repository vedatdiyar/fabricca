"use server";

import { db } from "@/db";
import { thesisCore, thesisBoxes, references } from "@/db/schema";

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
  coreBooks?: {
    title: string;
    author: string;
    publisher: string;
    year: string;
    rationale: string;
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

    // Insert coreBooks as references with status = 'recommended'
    if (data.coreBooks && data.coreBooks.length > 0) {
      const filteredBooks = data.coreBooks.filter((book) => {
        const author = book.author?.trim();
        const year = book.year?.trim();
        const title = book.title?.trim();

        if (author === "Belirtilmemiş" || year === "Belirtilmemiş") {
          return false;
        }
        if (title && title.includes("Kurucu Kaynak:")) {
          return false;
        }
        return true;
      });

      if (filteredBooks.length > 0) {
        await db.insert(references).values(
          filteredBooks.map((book) => {
            const parsedYear = book.year
              ? parseInt(book.year.replace(/\D/g, ""), 10)
              : NaN;
            return {
              title: book.title.trim(),
              authors: book.author.trim(),
              year: isNaN(parsedYear) ? null : parsedYear,
              pdfUrl: "recommended-onboarding",
              abstract: `Yayınevi: ${book.publisher.trim()}\n\nÖneri Gerekçesi: ${book.rationale.trim()}`,
              status: "recommended",
            };
          }),
        );
      }
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
