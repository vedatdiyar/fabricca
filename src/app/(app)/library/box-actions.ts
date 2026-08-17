"use server";

import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { ensureUserMatrixAndBoxes } from "@/core/services/box/ownership";
import { compareBoxTypes } from "@/lib/box-constants";
import type { ThesisBoxType } from "./_lib/types";

/** One sub-box option for the PDF upload selector. */
export interface LibrarySubBoxOption {
  id: number;
  title: string;
}

/** One parent box with its sub-box options for the PDF upload selector. */
export interface LibraryParentBoxOption {
  id: number;
  title: string;
  boxType: Exclude<ThesisBoxType, "ALL">;
  children: LibrarySubBoxOption[];
}

/**
 * Server Action: Fetches the user's thesis box hierarchy (parent boxes with sub-boxes) for the PDF upload modal, seeding default boxes when onboarding is incomplete.
 *
 * @returns The parent box hierarchy for the PDF upload selector, or an error message on failure.
 */
export async function getBoxHierarchyForLibraryAction(): Promise<
  | { success: true; data: LibraryParentBoxOption[] }
  | { success: false; error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const { boxes } = await ensureUserMatrixAndBoxes(session.userId);

    const parentBoxes = boxes
      .filter((b) => b.parentId === null)
      .sort((a, b) => compareBoxTypes(a.boxType, b.boxType));

    const hierarchy: LibraryParentBoxOption[] = parentBoxes.map((parent) => ({
      id: parent.id,
      title: parent.title,
      boxType: (parent.boxType || "THEORETICAL_FRAMEWORK") as Exclude<
        ThesisBoxType,
        "ALL"
      >,
      children: boxes
        .filter((b) => b.parentId === parent.id)
        .map((child) => ({ id: child.id, title: child.title })),
    }));

    return { success: true, data: hierarchy };
  } catch (err) {
    log.error("get_box_hierarchy_failed", {
      service: "library",
      error: err,
    });
    return {
      success: false,
      error: "Kutu hiyerarşisi yüklenirken bir hata oluştu.",
    };
  }
}
