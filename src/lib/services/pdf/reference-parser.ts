import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { CROSSREF_USER_AGENT } from "@/lib/api-utils";
import {
  extractCleanDoi,
  formatAuthorList,
  extractCrossrefYear,
} from "@/lib/academic/utils";
import type { Logger } from "@/lib/logger";

/** A single parsed bibliographic reference extracted from a resource's reference list. */
export interface ParsedReference {
  raw: string;
  doi: string | null;
  title: string | null;
  authors: string[];
  year: number | null;
  journal: string | null;
  resolved: boolean;
}

const DOI_REGEX = /10\.\d{4,}\/[-._;()/:A-Z0-9]+/i;

/**
 * Extracts a reference entry from a raw bibliography string.
 *
 * @param text - The raw reference text.
 * @returns The cleaned entry, or null when empty.
 */
function cleanReferenceEntry(text: string): string {
  return text
    .replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Splits the raw references text into individual reference entries.
 *
 * @param rawText - The full raw reference section text.
 * @returns Array of candidate reference lines.
 */
function splitReferenceEntries(rawText: string): string[] {
  const cleaned = rawText.replace(/\r/g, "").trim();
  if (!cleaned) return [];

  const numberedMatch = cleaned.match(/(?:^|\n)\d{1,3}[.)]\s+/);
  if (numberedMatch) {
    return cleaned
      .split(/\n(?=\d{1,3}[.)]\s+)/)
      .map(cleanReferenceEntry)
      .filter((entry) => entry.length > 0);
  }

  return cleaned
    .split(/\n{2,}/)
    .map(cleanReferenceEntry)
    .filter((entry) => entry.length > 0);
}

/**
 * Enriches a parsed reference with structured metadata from the Crossref REST API.
 *
 * @param reference - The parsed reference to resolve.
 * @returns The resolved reference, or the unresolved original on failure.
 */
async function resolveReferenceWithCrossref(
  reference: ParsedReference,
): Promise<ParsedReference> {
  if (!reference.doi) return reference;

  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(reference.doi)}`,
      {
        headers: { "User-Agent": CROSSREF_USER_AGENT },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) return reference;

    const json = (await response.json()) as {
      message?: Record<string, unknown>;
    };
    const message = json.message;
    if (!message) return reference;

    return {
      raw: reference.raw,
      doi: reference.doi,
      title: ((message.title as string[])?.[0] as string) || null,
      authors: formatAuthorList(
        message.author as { given?: string; family?: string }[] | undefined,
      ),
      year: extractCrossrefYear(message),
      journal:
        ((message["container-title"] as string[])?.[0] as string) ?? null,
      resolved: true,
    };
  } catch {
    return reference;
  }
}

/**
 * Parses the raw reference list of a resource into structured entries and persists them to the source record.
 *
 * @param sourceId - The source resource id whose references are parsed.
 * @param rawText - The raw reference section text.
 * @param log - Optional logger for structured parsing logging.
 */
export async function parseAndSaveReferences(
  sourceId: number,
  rawText: string,
  log?: Logger,
): Promise<void> {
  const entries = splitReferenceEntries(rawText);

  log?.info("pdf_references_entries_split", {
    service: "library",
    data: { sourceId, entryCount: entries.length },
  });

  const parsed: ParsedReference[] = entries.map((raw) => {
    const doiMatch = raw.match(DOI_REGEX);
    const doi = doiMatch ? extractCleanDoi(doiMatch[0]) : null;
    return {
      raw,
      doi,
      title: null,
      authors: [],
      year: null,
      journal: null,
      resolved: false,
    };
  });

  const resolved: ParsedReference[] = await Promise.all(
    parsed.map(resolveReferenceWithCrossref),
  );

  await db
    .update(sources)
    .set({ parsedReferences: resolved })
    .where(eq(sources.id, sourceId));

  const resolvedCount = resolved.filter((r) => r.resolved).length;

  log?.info("pdf_references_parse_success", {
    service: "library",
    data: {
      sourceId,
      entryCount: resolved.length,
      resolvedCount,
      unresolvedCount: resolved.length - resolvedCount,
    },
  });
}
