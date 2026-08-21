import { toast } from "sonner";
import type { BoxWithRelations } from "../constants/quadrant-config";
import { buildSubBoxMarkdown } from "../utils/export-helpers";

/**
 * Clipboard helper for a single sub-box markdown export.
 */
export function useClipboardExport() {
  const copySubBox = (box: BoxWithRelations) => {
    const text = buildSubBoxMarkdown(box);
    navigator.clipboard.writeText(text);
    toast.success(`"${box.title}" kopyalandı.`);
  };

  return { copySubBox };
}
