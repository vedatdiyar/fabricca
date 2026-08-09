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
interface CerebrasSelectionResponse {
  /** Indices (from confirmedCandidates) to include in final selection. */
  selectedIndices: number[];
  /** Suspicious candidates NOT to add (they are duplicates). */
  suspiciousDuplicates: string[];
  /** Suspicious candidates that are NOT duplicates (safe to include). */
  suspiciousClear: string[];
}

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
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    // Fallback: return top-N confirmed candidates without LLM
    return allCandidates.slice(0, payload.targetCount);
  }

  const prompt = buildPrompt(payload);

  let raw: string;
  try {
    const response = await fetch(
      "https://api.cerebras.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gemma-4-31b",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          max_completion_tokens: 512,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.status}`);
    }

    const json = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    raw = json.choices[0]?.message?.content ?? "";
  } catch {
    // Network/API failure: fall back to top-N order
    return allCandidates.slice(0, payload.targetCount);
  }

  // Parse structured JSON from response
  let parsed: CerebrasSelectionResponse;
  try {
    // Strip any markdown fences the model might have added
    const cleaned = raw
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();
    parsed = JSON.parse(cleaned) as CerebrasSelectionResponse;
  } catch {
    // Malformed JSON: fall back to top-N order
    return allCandidates.slice(0, payload.targetCount);
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
