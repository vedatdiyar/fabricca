/**
 * Test script: METHODOLOGY Box → LLM semantic_query generation → OpenAlex search.
 *
 * Reads thesis_matrix id=6 from the database, takes its METHODOLOGY sub-boxes
 * (id=100 "Tarihsel-Söylemsel Analiz" and id=101 "Eylem ve İttifak Analizi"),
 * feeds them to Gemini via semantic-query-prompt.ts, then sends the generated
 * query strings to OpenAlex search.semantic and prints the first 10 results.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/db";
import { thesisMatrices, thesisBoxes } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import {
  buildSemanticQuerySystemInstruction,
  buildSemanticQueryUserPrompt,
} from "../src/lib/prompts/box-generation/semantic-query-prompt";
import { generateStructuredContent } from "../src/lib/services/gemini";
import { FLASH_LITE_31, GEMINI_SEED } from "../src/lib/constants";
import type { JsonSchema } from "../src/lib/services/gemini";
import { z } from "zod";
import { createFlowId, Logger } from "../src/lib/logger";

// ── Zod + JSON Schema (mirrors bulkSemanticQuerySchema from boxes/_services/schemas) ──

const semanticQueryEntrySchema = z.object({
  subBoxTitle: z.string(),
  semanticQuery: z.string().min(10),
});

const bulkSemanticQuerySchema = z.object({
  semanticQueries: z.array(semanticQueryEntrySchema).min(1),
});

type BulkSemanticQueryResponse = z.infer<typeof bulkSemanticQuerySchema>;

const bulkSemanticQueryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    semanticQueries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subBoxTitle: { type: "string" },
          semanticQuery: { type: "string" },
        },
        required: ["subBoxTitle", "semanticQuery"],
      },
      minItems: 1,
    },
  },
  required: ["semanticQueries"],
};

// ── Helpers ──

const OPENALEX_API_BASE = "https://api.openalex.org/works";
const CROSSREF_USER_AGENT = "FabriccaAcademicAssistant/1.0 (mailto:iletisim@fabricca.com)";

async function searchOpenAlex(query: string): Promise<{ title: string | null; authors: string[]; doi: string | null; year: number | null; relevanceScore: number }[]> {
  const trimmed = query.substring(0, 1000);
  const params = new URLSearchParams({
    "search.semantic": trimmed,
    per_page: "10",
    select: "id,title,authorships,doi,publication_year,relevance_score",
  });

  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);

  const url = `${OPENALEX_API_BASE}?${params.toString().replace(/\+/g, "%20")}`;

  const res = await fetch(url, {
    headers: { "User-Agent": CROSSREF_USER_AGENT },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    console.error(`OpenAlex HTTP ${res.status}: ${res.statusText}`);
    return [];
  }

  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  if (!data.results) return [];

  return data.results.map((r) => {
    const authorships = r.authorships as { author?: { display_name?: string } }[] | undefined;
    return {
      title: (r.title as string) ?? null,
      authors: authorships?.map((a) => a.author?.display_name ?? "").filter(Boolean) ?? [],
      doi: (r.doi as string) ?? null,
      year: (r.publication_year as number) ?? null,
      relevanceScore: (r.relevance_score as number) ?? 0,
    };
  });
}

// ── Main ──

async function main() {
  // 1. Fetch matrix 6
  const matrices = await db.select().from(thesisMatrices).where(eq(thesisMatrices.id, 6));
  if (matrices.length === 0) {
    console.error("matrix id=6 not found");
    process.exit(1);
  }
  const matrix = matrices[0];
  console.log("===========================================");
  console.log("THESIS MATRIX id=6 — SUBJECT PROBLEM");
  console.log("===========================================");
  console.log(matrix.subjectProblem.slice(0, 300) + "...\n");

  // 2. Fetch METHODOLOGY sub-boxes (the two children of parent id=95)
  const mBoxes = await db.select().from(thesisBoxes).where(
    and(
      eq(thesisBoxes.thesisMatrixId, 6),
      eq(thesisBoxes.boxType, "METHODOLOGY"),
    ),
  );

  const subBoxes = mBoxes
    .filter((b) => b.parentId !== null)
    .map((b) => ({
      title: b.title,
      boxType: "METHODOLOGY" as const,
      description: b.description ?? "",
    }));

  console.log("METHODOLOGY SUB-BOXES (input to LLM):");
  console.log(JSON.stringify(subBoxes, null, 2));
  console.log("");

  // 3. Call Gemini to generate semantic queries
  console.log("===========================================");
  console.log("PHASE 1: LLM SEMANTIC QUERY GENERATION");
  console.log("===========================================");

  const systemInstruction = buildSemanticQuerySystemInstruction();
  const prompt = buildSemanticQueryUserPrompt(subBoxes);

  console.log("\n--- System Instruction (abbreviated) ---");
  console.log(systemInstruction.slice(0, 600) + "...\n");
  console.log("\n--- User Prompt ---");
  console.log(prompt + "\n");

  const log = new Logger(createFlowId());

  let llmResult: BulkSemanticQueryResponse;
  try {
    llmResult = await generateStructuredContent<BulkSemanticQueryResponse>(
      FLASH_LITE_31,
      systemInstruction,
      prompt,
      bulkSemanticQueryJsonSchema,
      log,
      {
        thinkingConfig: null,
        zodSchema: bulkSemanticQuerySchema,
        seed: GEMINI_SEED,
        payloadStage: "test_methodology_semantic_query",
        quiet: false,
      },
    );
  } catch (err) {
    console.error("LLM call failed:", err);
    process.exit(1);
  }

  console.log("\n--- LLM Generated Queries ---");
  for (const q of llmResult.semanticQueries) {
    console.log(`  [${q.subBoxTitle}]`);
    console.log(`  Query (${q.semanticQuery.length} chars): ${q.semanticQuery}`);
    console.log("");
  }

  // 4. For each generated query, call OpenAlex search.semantic
  console.log("===========================================");
  console.log("PHASE 2: OPENALEX SEARCH.SEMANTIC RESULTS");
  console.log("===========================================");

  for (const q of llmResult.semanticQueries) {
    console.log(`\n--- Sub-Box: "${q.subBoxTitle}" ---`);
    console.log(`Query: ${q.semanticQuery}\n`);

    const results = await searchOpenAlex(q.semanticQuery);

    if (results.length === 0) {
      console.log("  (no results from OpenAlex)");
    } else {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`  ${i + 1}. [score=${r.relevanceScore.toFixed(4)}] ${r.title}`);
        console.log(`      Authors: ${r.authors.slice(0, 3).join(", ") || "(unknown)"}${r.authors.length > 3 ? " et al." : ""}`);
        console.log(`      Year: ${r.year ?? "N/A"} | DOI: ${r.doi ?? "N/A"}`);
      }
    }
  }

  console.log("\n===========================================");
  console.log("DONE");
  console.log("===========================================");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
