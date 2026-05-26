/**
 * Helper to extract raw text content from multi-format OAI-PMH XML fields (strings, objects, or arrays).
 */
export function extractText(field: any): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    return field.map(extractText).join(" / ");
  }
  if (typeof field === "object") {
    return field["#text"] || "";
  }
  return String(field);
}
