import type { TezaraThesisSummary } from "./types";

/**
 * Raw, loosely-typed thesis object as it appears in the Tezara RSC payload.
 *
 * All fields are optional because the source structure is not contractually
 * guaranteed — consumers must narrow each field before use. Field names mirror
 * the snake_case keys emitted by Tezara (with camelCase fallbacks observed in
 * some payloads).
 */
export interface TezaraRawThesisObj {
  id?: number | string;
  title_original?: string;
  title_translated?: string;
  author?: string;
  university?: string;
  year?: number | string;
  thesis_type?: string;
  thesisType?: string;
  department?: string;
  abstract_original?: string;
  abstract_translated?: string;
}

/**
 * Safely extracts all JSON objects found within a given string.
 * Uses a brace-counting scanner that respects string literal boundaries and escape characters.
 *
 * Edge case note: the scanner only tracks string boundaries via double quotes (`"`).
 * Single-quoted JSON-like fragments are not recognized as strings and could throw off the
 * brace counter. Additionally, the `escapeNext` flag handles single-level escaping; deeply
 * nested escape sequences (e.g. `\\\\\\"`) may produce slightly off results. In practice the
 * RSC stream emits well-formed JSON so these cases rarely occur.
 *
 * @param text - The raw string input to search.
 * @returns An array of parsed JSON objects.
 */
export function extractJsonObjects(text: string): unknown[] {
  const jsonObjects: unknown[] = [];
  if (typeof text !== "string") {
    return jsonObjects;
  }

  let braceCount = 0;
  let startIdx = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      if (inString) {
        escapeNext = true;
      }
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        if (braceCount === 0) {
          startIdx = i;
        }
        braceCount++;
      } else if (char === "}") {
        if (braceCount > 0) {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            const candidate = text.substring(startIdx, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === "object") {
                jsonObjects.push(parsed);
              }
            } catch (err) {
              void err;
            }
          }
        }
      }
    }
  }

  return jsonObjects;
}

/**
 * Extracts RSC stream text fragments mapped by their reference key.
 *
 * @param text - The raw RSC response text.
 * @returns A mapping of reference IDs to their resolved text contents.
 */
export function extractRscTexts(text: string): Record<string, string> {
  const refMap: Record<string, string> = {};
  if (typeof text !== "string") {
    return refMap;
  }

  const lines = text.split("\n");
  for (const line of lines) {
    try {
      const trimmedLine = line.trim();
      const colonIdx = trimmedLine.indexOf(":");
      if (colonIdx === -1) {
        continue;
      }

      const key = trimmedLine.substring(0, colonIdx).trim();
      // Ensure the key looks like a valid alphanumeric reference identifier
      if (!/^[a-zA-Z0-9]+$/.test(key)) {
        continue;
      }

      let content = trimmedLine.substring(colonIdx + 1);

      // If the content starts with a type prefix (like T12, etc.) followed by a comma
      // e.g. "T12,Özet" or "T12,\"Özet\""
      if (/^[a-zA-Z][a-zA-Z0-9]*,/.test(content)) {
        const commaIdx = content.indexOf(",");
        if (commaIdx !== -1) {
          content = content.substring(commaIdx + 1);
        }
      }

      // If it is wrapped in quotes, try to parse it as a JSON string to handle unescaping
      if (content.startsWith('"') && content.endsWith('"')) {
        try {
          const parsed = JSON.parse(content);
          if (typeof parsed === "string") {
            refMap[key] = parsed;
            continue;
          }
        } catch (err) {
          void err;
        }
      }

      // Fallback: save content as is, trimmed
      refMap[key] = content.trim();
    } catch (err) {
      void err;
    }
  }

  return refMap;
}

/**
 * Maps a raw thesis object from a Tezara RSC response to a typed TezaraThesisSummary.
 * Returns null if the raw object has no valid identifier.
 *
 * @param raw - The raw object from the Tezara response
 * @returns A typed summary object, or null
 */
function mapToThesisSummary(raw: Record<string, unknown>): TezaraThesisSummary | null {
  const id = Number(raw.id ?? 0);
  if (!id) return null;

  return {
    id,
    title: String(raw.title_original ?? raw.title_translated ?? ""),
    author: String(raw.author ?? ""),
    university: String(raw.university ?? ""),
    year: Number(raw.year ?? 0),
    thesisType: String(raw.thesis_type ?? raw.thesisType ?? ""),
    department: String(raw.department ?? ""),
  };
}

/**
 * Recursively searches any value to find and extract objects that match the thesis summary structure.
 *
 * @param val - The value to scan.
 * @param results - The accumulator array of thesis summaries.
 */
function findThesesRecursively(val: unknown, results: TezaraThesisSummary[]): void {
  if (!val || typeof val !== "object") {
    return;
  }

  if (Array.isArray(val)) {
    for (const item of val) {
      findThesesRecursively(item, results);
    }
    return;
  }

  const obj = val as Record<string, unknown>;

  // If the object looks like a thesis summary (must have title and some identifier or author)
  if (
    (typeof obj.title_original === "string" ||
      typeof obj.title_translated === "string") &&
    (obj.id !== undefined || obj.author !== undefined)
  ) {
    const summary = mapToThesisSummary(obj);
    if (summary && !results.some((r) => r.id === summary.id)) {
      results.push(summary);
    }
  }

  // Recurse into all properties
  const keys = Object.keys(obj);
  for (const key of keys) {
    try {
      findThesesRecursively(obj[key], results);
    } catch (err) {
      void err;
    }
  }
}

/**
 * Parses the thesis search results from raw RSC stream text response.
 *
 * @param text - The raw RSC response text.
 * @returns A list of parsed thesis summary objects.
 */
export function parseRscTheses(text: string): TezaraThesisSummary[] {
  const results: TezaraThesisSummary[] = [];
  if (typeof text !== "string") {
    return results;
  }

  const lines = text.split("\n");
  for (const line of lines) {
    try {
      const jsonObjects = extractJsonObjects(line);
      for (const obj of jsonObjects) {
        if (!obj || typeof obj !== "object") {
          continue;
        }

        const record = obj as Record<string, unknown>;

        // Navigate the standard Next.js query cache state structure safely
        const queries = (record?.state as Record<string, unknown>)?.queries || (record?.queries as unknown[]) || [];
        if (Array.isArray(queries)) {
          for (const q of queries) {
            if (
              q &&
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === "searchTheses"
            ) {
              const hits =
                q.state?.data?.json?.hits ||
                q.data?.json?.hits ||
                q.state?.data?.hits ||
                q.data?.hits ||
                [];
              if (Array.isArray(hits)) {
                for (const hit of hits) {
                  if (hit && typeof hit === "object") {
                    const summary = mapToThesisSummary(hit as Record<string, unknown>);
                    if (summary && !results.some((r) => r.id === summary.id)) {
                      results.push(summary);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      void err;
    }
  }

  // Fallback: If no results were found via the structured path, search recursively
  if (results.length === 0) {
    for (const line of lines) {
      try {
        const jsonObjects = extractJsonObjects(line);
        for (const obj of jsonObjects) {
          findThesesRecursively(obj, results);
        }
      } catch (err) {
        void err;
      }
    }
  }

  return results;
}

/**
 * Recursively searches a JSON structure to find the thesis object details.
 *
 * @param val - The value to scan.
 * @returns The found raw thesis object or null.
 */
export function findThesisObjRecursively(val: unknown): TezaraRawThesisObj | null {
  if (!val || typeof val !== "object") {
    return null;
  }

  const obj = val as Record<string, unknown>;

  // Check if the object contains a nested 'thesis' object with academic fields
  if (obj.thesis && typeof obj.thesis === "object") {
    const nested = obj.thesis as Record<string, unknown>;
    if (
      nested.title_original !== undefined ||
      nested.title_translated !== undefined ||
      nested.author !== undefined
    ) {
      return nested as TezaraRawThesisObj;
    }
  }

  // Check if the object itself has title_original / title_translated and author
  if (
    (obj.title_original !== undefined || obj.title_translated !== undefined) &&
    (obj.author !== undefined || obj.university !== undefined)
  ) {
    return obj as TezaraRawThesisObj;
  }

  // Recurse into all keys
  const keys = Object.keys(obj);
  for (const key of keys) {
    try {
      const result = findThesisObjRecursively(obj[key]);
      if (result) {
        return result;
      }
    } catch (err) {
      void err;
    }
  }

  return null;
}
