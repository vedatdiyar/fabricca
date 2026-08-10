"use server";

import { z } from "zod";
import { db } from "@/db";
import { critiques } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { getOwnedSource } from "./_services/helpers";

/** Validation schema for saving the 1:1 article analysis of a library source. */
const saveResourceCritiqueSchema = z.object({
  resourceId: z.number().int().positive("Geçerli bir kaynak seçilmelidir."),
  researchQuestion: z.string().trim().max(10000).optional(),
  theoreticalFramework: z.string().trim().max(10000).optional(),
  methodology: z.string().trim().max(10000).optional(),
  mainArgument: z.string().trim().max(10000).optional(),
  literatureGap: z.string().trim().max(10000).optional(),
});

/**
 * Server Action: Upserts the 1:1 article analysis (research question, theoretical framework,
 * methodology, main argument, literature gap) for a library source.
 *
 * @param input - The critique payload.
 * @param input.resourceId - The ID of the resource the analysis belongs to.
 * @param input.researchQuestion - What the study tries to solve or understand.
 * @param input.theoreticalFramework - The theory, concepts, or key terms the study relies on.
 * @param input.methodology - The research method used.
 * @param input.mainArgument - The author's main conclusion and defended thesis.
 * @param input.literatureGap - Where the author fell short or what future work remains.
 * @returns The saved critique on success, or an error message on failure.
 */
export async function saveResourceCritiqueAction(input: {
  resourceId: number;
  researchQuestion?: string;
  theoreticalFramework?: string;
  methodology?: string;
  mainArgument?: string;
  literatureGap?: string;
}) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = saveResourceCritiqueSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : "Geçersiz veri.",
      };
    }

    const valid = parsed.data;

    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const owned = await getOwnedSource(valid.resourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const fieldValues = {
      researchQuestion: valid.researchQuestion?.trim() || null,
      theoreticalFramework: valid.theoreticalFramework?.trim() || null,
      methodology: valid.methodology?.trim() || null,
      mainArgument: valid.mainArgument?.trim() || null,
      literatureGap: valid.literatureGap?.trim() || null,
    };

    const [critique] = await db
      .insert(critiques)
      .values({
        sourceId: valid.resourceId,
        userId: session.userId,
        ...fieldValues,
      })
      .onConflictDoUpdate({
        target: critiques.sourceId,
        set: {
          ...fieldValues,
          updatedAt: new Date(),
        },
      })
      .returning();

    log.info("save_resource_critique_success", {
      service: "library",
      data: { critiqueId: critique.id, resourceId: valid.resourceId },
    });

    return {
      success: true,
      data: {
        resourceId: critique.sourceId,
        researchQuestion: critique.researchQuestion ?? undefined,
        theoreticalFramework: critique.theoreticalFramework ?? undefined,
        methodology: critique.methodology ?? undefined,
        mainArgument: critique.mainArgument ?? undefined,
        literatureGap: critique.literatureGap ?? undefined,
        updatedAt: critique.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    log.error("save_resource_critique_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Eser analizi kaydedilirken bir hata oluştu.",
    };
  }
}
