export const CROSSREF_USER_AGENT =
  "FabriccaAcademicAssistant/1.0 (mailto:iletisim@fabricca.com)";

export function extractCleanDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/10\.\d{4,}[^\s]*/i);
  return match ? match[0].replace(/\.$/, "") : null;
}
