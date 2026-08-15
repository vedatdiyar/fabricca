import { toast } from "sonner";
import type { BoxWithRelations } from "../constants/quadrant-config";
import {
  buildSubBoxMarkdown,
  buildArchitectureSummaryMarkdown,
} from "../utils/export-helpers";

/**
 * Abstracts the clipboard + toast side effects behind markdown export actions
 * for a single sub-box or the whole architecture summary.
 */
export function useClipboardExport() {
  const copySubBox = (box: BoxWithRelations) => {
    const text = buildSubBoxMarkdown(box);
    navigator.clipboard.writeText(text);
    toast.success(`"${box.title}" kopyalandı.`);
  };

  const copyAllBoxesSummary = (
    rootBoxes: BoxWithRelations[],
    subBoxesByParent: Record<number, BoxWithRelations[]>,
  ) => {
    const summary = buildArchitectureSummaryMarkdown(
      rootBoxes,
      subBoxesByParent,
    );
    navigator.clipboard.writeText(summary);
    toast.success("Tüm konu kutuları ve kavram yapısı panoya kopyalandı.");
  };

  return { copySubBox, copyAllBoxesSummary };
}
