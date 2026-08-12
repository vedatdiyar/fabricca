/**
 * Cerebras Gemma-4-31B selection client for backward expansion.
 *
 * Single LLM call that performs two tasks simultaneously:
 *   1. Cross-language / edition-aware duplicate detection for "suspicious" candidates
 *      (those that passed the Jaccard/Jaro-Winkler threshold but are not certain duplicates).
 *   2. Final ranked selection of N sources from the confirmed + cleared-suspicious pool,
 *      guided by the thesis box context.
 *
 * The model receives a Cohere-reranked, co-citation-ordered list and emits a
 * structured JSON response — no tool use, pure structured output.
 */

import { z } from "zod";
import { CEREBRAS_MODEL } from "@/lib/constants";
import {
  generateCerebrasStructuredContent,
  type JsonSchema,
} from "@/services/ai";
import type { CandidateSource } from "./types";

/** A suspicious candidate that needs LLM verification. */
export interface SuspiciousEntry {
  candidateTitle: string;
  candidateAuthors: string[];
  matchedExistingTitle: string;
  titleScore: number;
  authorScore: number;
}

/** Payload sent to the Cerebras LLM. */
interface CerebrasSelectionPayload {
  /** Thesis box context (title + description + matrix summary). */
  thesisContext: string;
  /** All confirmed-unique candidates in priority order (Cohere reranked). */
  confirmedCandidates: {
    index: number;
    title: string;
    authors: string[];
    coAuthorCount: number;
  }[];
  /** Candidates that may be duplicates — LLM decides. */
  suspiciousCandidates: SuspiciousEntry[];
  /** All existing source titles+authors in the user library (for context). */
  existingSources: { title: string; authors: string[] }[];
  /** How many final sources to select. */
  targetCount: number;
}

/** Structured response from the LLM. */
const selectionResponseSchema = z.object({
  /** Indices (from confirmedCandidates) to include in final selection. */
  selectedIndices: z.array(z.number()),
  /** Suspicious candidates NOT to add (they are duplicates). */
  suspiciousDuplicates: z.array(z.string()),
  /** Suspicious candidates that are NOT duplicates (safe to include). */
  suspiciousClear: z.array(z.string()),
});

type CerebrasSelectionResponse = z.infer<typeof selectionResponseSchema>;

/** Strict JSON schema constraint for the Cerebras structured selection call. */
const SELECTION_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    selectedIndices: {
      type: "array",
      items: { type: "number" },
      description:
        "Indices from the confirmed candidates list to include in the final selection.",
    },
    suspiciousDuplicates: {
      type: "array",
      items: { type: "string" },
      description:
        "Candidate titles that ARE true duplicates of existing sources.",
    },
    suspiciousClear: {
      type: "array",
      items: { type: "string" },
      description:
        "Candidate titles that are NOT duplicates and safe to include.",
    },
  },
  required: ["selectedIndices", "suspiciousDuplicates", "suspiciousClear"],
  additionalProperties: false,
};

/** System instruction for the structured dedup + selection call. */
const SELECTION_SYSTEM_INSTRUCTION =
  "You are an academic librarian assistant curating a literature list for a thesis. Output strict JSON only — no markdown, no explanation.";

function buildPrompt(payload: CerebrasSelectionPayload): string {
  const suspiciousSection =
    payload.suspiciousCandidates.length > 0
      ? `## Suspicious Duplicates (Verify)
The fuzzy matcher flagged these candidates as potentially matching an existing source.
Decide for each: is it a TRUE duplicate (same work, different edition/language/punctuation)?
Or is it a DIFFERENT work that merely sounds similar?

${payload.suspiciousCandidates
  .map(
    (s, i) =>
      `[SUSPICIOUS_${i}]
  Candidate: "${s.candidateTitle}" — ${s.candidateAuthors?.[0] ?? "Unknown"}
  Matches existing: "${s.matchedExistingTitle}"
  Similarity scores: title=${s.titleScore.toFixed(2)}, author=${s.authorScore.toFixed(2)}`,
  )
  .join("\n\n")}`
      : "## Suspicious Duplicates\nNone.";

  return `You are an academic librarian assistant helping curate a literature list for a thesis.

## Thesis Context
${payload.thesisContext}

## Existing Library Sources (${payload.existingSources.length} total)
${payload.existingSources.map((s) => `- "${s.title}" [${s.authors?.[0] ?? "?"}]`).join("\n")}

## Confirmed Unique Candidates (priority-ordered, select from these)
${payload.confirmedCandidates
  .map(
    (c) =>
      `[${c.index}] "${c.title}" — ${c.authors?.[0] ?? "Unknown"} (cited by ${c.coAuthorCount} seed papers)`,
  )
  .join("\n")}

${suspiciousSection}

## Task
1. For each SUSPICIOUS entry: output its candidate title in either "suspiciousDuplicates" (if it IS the same work as the matched existing source) or "suspiciousClear" (if it is a DIFFERENT work).
2. From the confirmed candidates (plus any suspiciousClear), select exactly ${payload.targetCount} that best serve the thesis context. If fewer than ${payload.targetCount} unique candidates exist, select all of them.
3. Output ONLY valid JSON — no markdown, no explanation.

## Output Format
{
  "selectedIndices": [list of integer indices from the confirmed candidates list],
  "suspiciousDuplicates": [list of candidate title strings that ARE duplicates],
  "suspiciousClear": [list of candidate title strings that are NOT duplicates]
}`;
}

/**
 * Calls Cerebras Gemma-4-31B to deduplicate suspicious candidates and
 * select the final N sources from the backward expansion candidate pool.
 *
 * @param payload - Structured input: context, candidates, suspicious list, target count.
 * @returns Selected CandidateSource items (length ≤ targetCount).
 */
export async function selectWithCerebras(
  payload: CerebrasSelectionPayload,
  allCandidates: CandidateSource[],
): Promise<CandidateSource[]> {
  const fallback = () => allCandidates.slice(0, payload.targetCount);

  const prompt = buildPrompt(payload);

  // Route through the central Cerebras provider (CEREBRAS_MODEL, retries,
  // structured output + zod validation). Any failure degrades to top-N order.
  let parsed: CerebrasSelectionResponse;
  try {
    parsed = await generateCerebrasStructuredContent<CerebrasSelectionResponse>(
      CEREBRAS_MODEL,
      SELECTION_SYSTEM_INSTRUCTION,
      prompt,
      SELECTION_JSON_SCHEMA,
      undefined,
      {
        payloadStage: "backward_expansion_selection",
        zodSchema: selectionResponseSchema,
        temperature: 0,
        maxTokens: 512,
      },
    );
  } catch {
    // Network/API failure or malformed/off-schema output: fall back to top-N order
    return fallback();
  }

  // Build final selection
  const selected: CandidateSource[] = [];
  const duplicateTitleSet = new Set(
    (parsed.suspiciousDuplicates ?? []).map((t) => t.toLowerCase().trim()),
  );

  // Add confirmed candidates in the order Gemma selected
  for (const idx of parsed.selectedIndices ?? []) {
    if (selected.length >= payload.targetCount) break;
    const candidate = allCandidates[idx];
    if (candidate) selected.push(candidate);
  }

  // Append suspiciousClear candidates that Gemma approved, if still room
  for (const clearTitle of parsed.suspiciousClear ?? []) {
    if (selected.length >= payload.targetCount) break;
    if (duplicateTitleSet.has(clearTitle.toLowerCase().trim())) continue;
    const match = allCandidates.find(
      (c) => c.title.toLowerCase().trim() === clearTitle.toLowerCase().trim(),
    );
    if (match && !selected.includes(match)) selected.push(match);
  }

  // Final safety: if LLM returned fewer than target, pad with remaining confirmed
  if (selected.length < payload.targetCount) {
    for (const c of allCandidates) {
      if (selected.length >= payload.targetCount) break;
      if (!selected.includes(c)) selected.push(c);
    }
  }

  return selected.slice(0, payload.targetCount);
}
