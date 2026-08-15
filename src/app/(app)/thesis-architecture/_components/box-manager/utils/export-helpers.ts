import { QUADRANTS } from "../constants/quadrant-config";
import type { BoxWithRelations } from "../constants/quadrant-config";

/** Builds the markdown representation of a single sub-box for clipboard export. */
export function buildSubBoxMarkdown(box: BoxWithRelations): string {
  const concepts =
    Array.isArray(box.concepts) && box.concepts.length > 0
      ? `\nKavramlar: ${box.concepts.map((c) => `#${c}`).join(" ")}`
      : "";
  const semantic = box.semanticQuery
    ? `\nSemantik Sorgu: ${box.semanticQuery}`
    : "";
  return `### ${box.title}\n${box.description ?? ""}${concepts}${semantic}`;
}

/**
 * Builds the full architecture summary markdown: every quadrant (root box) with
 * its sub-boxes, concept tags and semantic queries.
 */
export function buildArchitectureSummaryMarkdown(
  rootBoxes: BoxWithRelations[],
  subBoxesByParent: Record<number, BoxWithRelations[]>,
): string {
  let summary = `# Tez Araştırma Temaları ve Konu Kutuları\n\n`;

  for (const root of rootBoxes) {
    const config = QUADRANTS[root.boxType ?? ""] ?? {
      label: root.title,
      number: 0,
    };
    summary += `## ${config.number}. ${root.title}\n`;
    if (root.description) summary += `${root.description}\n\n`;

    const subs = subBoxesByParent[root.id] ?? [];
    if (subs.length === 0) {
      summary += `*(Tanımlı alt konu bulunmuyor)*\n\n`;
    } else {
      for (const sub of subs) {
        summary += `### • ${sub.title}\n`;
        if (sub.description) summary += `${sub.description}\n`;
        if (Array.isArray(sub.concepts) && sub.concepts.length > 0) {
          summary += `Etiketler: ${sub.concepts.map((c) => `#${c}`).join(", ")}\n`;
        }
        if (sub.semanticQuery) {
          summary += `Semantik Sorgu: ${sub.semanticQuery}\n`;
        }
        summary += `\n`;
      }
    }
    summary += `---\n\n`;
  }

  return summary;
}
