/**
 * Extracts a clean DOI string from a raw value.
 *
 * @param raw - Raw DOI value from any source.
 * @returns The normalized DOI, or null when no DOI is present.
 */
export function extractCleanDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/10\.\d{4,}[^\s]*/i);
  return match ? match[0].replace(/\.$/, "") : null;
}

/**
 * Extracts the canonical short OpenAlex work ID from a URL, plain ID, or junk value.
 *
 * @param raw - Raw OpenAlex identifier or URL.
 * @returns The extracted W... ID, or null when the input is invalid.
 */
export function extractOpenAlexId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "null") return null;
  const match = trimmed.match(/(?:^|\/)(W\d+)$/i);
  if (match) return match[1];
  return /^W\d+$/i.test(trimmed) ? trimmed : null;
}
