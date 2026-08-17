"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/core/db";
import { matrices, outlines } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import { generateOutlineAction } from "@/app/(onboarding)/onboarding/outline/_services/generator";

const sectionInputSchema = z.object({
  title: z.string().min(1, "Bölüm başlığı boş olamaz."),
  description: z.string().optional().default(""),
  sortOrder: z.number().int(),
  subSections: z
    .array(
      z.object({
        title: z.string().min(1, "Alt bölüm başlığı boş olamaz."),
        description: z.string().optional().default(""),
        sortOrder: z.number().int(),
      }),
    )
    .optional()
    .default([]),
});

const outlineHierarchySchema = z.object({
  academicField: z.string().nullable().optional(),
  sections: z.array(sectionInputSchema).min(1, "En az bir bölüm gereklidir."),
});

export type OutlineHierarchyInput = z.infer<typeof outlineHierarchySchema>;

/**
 * Saves the edited outline hierarchy to the database for the authenticated user.
 *
 * @param input - The outline hierarchy payload to validate and persist.
 * @returns A success flag or an error message.
 */
export async function saveOutlineHierarchyAction(
  input: OutlineHierarchyInput,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const parsed = outlineHierarchySchema.safeParse(input);
    if (!parsed.success) {
      log.error("save_outline_validation_failed", {
        service: "outline",
        error: parsed.error,
      });
      return { error: "Geçersiz tez planı verisi gönderildi." };
    }

    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const { academicField, sections } = parsed.data;
    await db.transaction(async (tx) => {
      await tx.delete(outlines).where(eq(outlines.matrixId, matrix.id));

      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const [insertedParent] = await tx
          .insert(outlines)
          .values({
            matrixId: matrix.id,
            parentId: null,
            title: sec.title,
            description: sec.description || null,
            sortOrder: i + 1,
            academicField: academicField || null,
          })
          .returning({ id: outlines.id });

        if (sec.subSections && sec.subSections.length > 0) {
          const childValues = sec.subSections.map((sub, subIdx) => ({
            matrixId: matrix.id,
            parentId: insertedParent.id,
            title: sub.title,
            description: sub.description || null,
            sortOrder: subIdx + 1,
            academicField: null,
          }));

          await tx.insert(outlines).values(childValues);
        }
      }
    });

    invalidateOnboardingStepCache("outline");

    log.info("save_outline_hierarchy_success", {
      service: "outline",
      data: { sectionCount: sections.length },
    });

    return { success: true };
  } catch (err) {
    log.error("save_outline_hierarchy_failed", {
      service: "outline",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Tez planı kaydedilirken bir hata oluştu.",
    };
  }
}

/**
 * Regenerates the outline using Gemini AI and persists it to the database.
 *
 * @returns A success flag with generated outline sections or an error message.
 */
export async function regenerateAndPersistOutlineAction(): Promise<
  | {
      success: true;
      academicField: string;
      sections: Array<{
        title: string;
        description: string;
        sortOrder: number;
        subSections: Array<{
          title: string;
          description: string;
          sortOrder: number;
        }>;
      }>;
    }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const genResult = await generateOutlineAction();
    if ("error" in genResult) {
      return { error: genResult.error };
    }

    const { outline } = genResult;
    const saveResult = await saveOutlineHierarchyAction({
      academicField: outline.academicField,
      sections: outline.sections.map((sec, i) => ({
        title: sec.title,
        description: sec.description,
        sortOrder: i + 1,
        subSections: (sec.subSections || []).map((sub, subIdx) => ({
          title: sub.title,
          description: sub.description,
          sortOrder: subIdx + 1,
        })),
      })),
    });

    if ("error" in saveResult) {
      return { error: saveResult.error };
    }

    log.info("regenerate_and_persist_outline_success", {
      service: "outline",
    });

    return {
      success: true,
      academicField: outline.academicField,
      sections: outline.sections.map((sec, i) => ({
        title: sec.title,
        description: sec.description,
        sortOrder: i + 1,
        subSections: (sec.subSections || []).map((sub, subIdx) => ({
          title: sub.title,
          description: sub.description,
          sortOrder: subIdx + 1,
        })),
      })),
    };
  } catch (err) {
    log.error("regenerate_and_persist_outline_failed", {
      service: "outline",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return { error: "Tez planı yeniden oluşturulurken bir hata oluştu." };
  }
}
