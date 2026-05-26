/**
 * Helper to extract raw text content from multi-format OAI-PMH XML fields (strings, objects, or arrays).
 */
export function extractText(field: unknown): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    return field.map((item: unknown) => extractText(item)).join(" / ");
  }
  if (typeof field === "object" && field !== null) {
    const obj = field as Record<string, unknown>;
    return typeof obj["#text"] === "string" ? obj["#text"] : "";
  }
  return String(field);
}
