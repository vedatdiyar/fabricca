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
import { buildPromptPayload } from "@/lib/ai/prompt-builder";
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

function buildSelectionPromptPayload(payload: CerebrasSelectionPayload) {
  const suspiciousSection =
    payload.suspiciousCandidates.length > 0
      ? `### Şüpheli Çift Kayıtlar (Suspicious Duplicates - Doğrulama Gerektirenler):
${payload.suspiciousCandidates
  .map(
    (s, i) =>
      `[SUSPICIOUS_${i}]
  Aday Başlık: "${s.candidateTitle}" — ${s.candidateAuthors?.[0] ?? "Bilinmiyor"}
  Eşleşen Mevcut Başlık: "${s.matchedExistingTitle}"
  Benzerlik Skorları: başlık=${s.titleScore.toFixed(2)}, yazar=${s.authorScore.toFixed(2)}`,
  )
  .join("\n\n")}`
      : "### Şüpheli Çift Kayıtlar:\nYok.";

  return buildPromptPayload({
    roleAndExpertise:
      "You are an expert academic librarian and bibliographic deduplication assistant curating high-relevance literature for a thesis.",

    primaryTask:
      "Verify suspicious duplicate candidates against existing library sources and select the top N unique academic sources that best fit the thesis context.",

    rulesAndConstraints: `1. **Duplicate Detection:**
   - Examine each candidate in 'Suspicious Duplicates'.
   - If a candidate represents the SAME intellectual work as an existing source (despite minor edition/language/punctuation variations), classify its title in 'suspiciousDuplicates'.
   - If a candidate is a genuinely DIFFERENT work that merely shares similar wording or author, classify its title in 'suspiciousClear'.

2. **Ranked Candidate Selection:**
   - From the confirmed candidates list (and any approved 'suspiciousClear' entries), select exactly the target count (${payload.targetCount}) of most relevant sources.
   - If fewer candidates exist than the target count, select all confirmed candidates.`,

    outputFormat:
      "Output strict JSON adhering to the schema without markdown formatting or conversational filler.",

    examples: `<example>
<input>
### Tez Bağlamı:
Kürt siyasal hareketinin 1990'lar meclis ve yasal parti söylemleri.

### Mevcut Kütüphane Kaynakları (1 Adet):
- "The Kurdish Nationalist Movement: Opportunity, Mobilization and Identity" [David Romano]

### Doğrulanmış Aday Kaynaklar:
[0] "The Kurdish National Movement in Turkey: From Protest to Resistance" — Cengiz Gunes (cited by 4 seed papers)
[1] "Kurdish Political Mobilization in Turkey" — Nicole Watts (cited by 3 seed papers)

### Şüpheli Çift Kayıtlar:
[SUSPICIOUS_0]
  Aday Başlık: "The Kurdish Nationalist Movement (2006 Edition)" — David Romano
  Eşleşen Mevcut Başlık: "The Kurdish Nationalist Movement: Opportunity, Mobilization and Identity"
</input>
<output>
{
  "selectedIndices": [0, 1],
  "suspiciousDuplicates": ["The Kurdish Nationalist Movement (2006 Edition)"],
  "suspiciousClear": []
}
</output>
</example>`,

    inputContext: `### Tez Bağlamı (Thesis Context):
${payload.thesisContext}

### Mevcut Kütüphane Kaynakları (${payload.existingSources.length} Adet):
${payload.existingSources.map((s) => `- "${s.title}" [${s.authors?.[0] ?? "?"}]`).join("\n")}

### Doğrulanmış Aday Kaynaklar:
${payload.confirmedCandidates
  .map(
    (c) =>
      `[${c.index}] "${c.title}" — ${c.authors?.[0] ?? "Bilinmiyor"} (cited by ${c.coAuthorCount} seed papers)`,
  )
  .join("\n")}

${suspiciousSection}`,

    taskTrigger:
      `Analyze the candidates in <context> against existing library sources and select exactly ${payload.targetCount} top relevant sources into structured JSON output according to <instructions>.`,
  });
}

/**
 * Calls Cerebras Gemma-4-31B to deduplicate suspicious candidates and
 * select the final N sources from the backward expansion candidate pool.
 *
 * @param payload - Structured input: context, candidates, suspicious list, target count.
 * @param allCandidates - Full list of candidate sources.
 * @returns Selected CandidateSource items (length ≤ targetCount).
 */
export async function selectWithCerebras(
  payload: CerebrasSelectionPayload,
  allCandidates: CandidateSource[],
): Promise<CandidateSource[]> {
  const fallback = () => allCandidates.slice(0, payload.targetCount);

  const promptPayload = buildSelectionPromptPayload(payload);

  // Route through the central Cerebras provider (CEREBRAS_MODEL, retries,
  // structured output + zod validation). Any failure degrades to top-N order.
  let parsed: CerebrasSelectionResponse;
  try {
    parsed = await generateCerebrasStructuredContent<CerebrasSelectionResponse>(
      CEREBRAS_MODEL,
      promptPayload.systemInstruction,
      promptPayload.userPrompt,
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
