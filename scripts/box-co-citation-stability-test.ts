/**
 * 3x Consecutive Run Stability Test: Box Generation + Co-Citation Mining
 *
 * Tests determinism of:
 *   1. Gemini box structure generation (titles, boxType mappings)
 *   2. Co-citation mining champion selection (Referee verdict)
 *
 * Run: npx tsx scripts/box-co-citation-stability-test.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "../src/lib/gemini";
import { Logger, createFlowId } from "../src/lib/logger";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "../src/lib/prompts/box-generation";
import {
  CO_CITATION_REFEREE_SCHEMA,
  buildRefereeSystemInstruction,
  buildRefereePrompt,
} from "../src/lib/prompts";
import { mineCoCitations } from "../src/app/(auth)/onboarding/_services/co-citation-miner";
import type { GeminiThesisBox, FoundationalQuery } from "../src/lib/types";
import { z } from "zod";

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const SEED = 42;
const TEMPERATURE = 1.0;

// ---------------------------------------------------------------------------
// Raw schemas (mirrors actions.ts)
// ---------------------------------------------------------------------------
const RawSubBoxSchema = z.object({
  title: z.string().min(1),
  semanticQuery: z.string().min(1),
  concepts: z.array(z.string()).max(4).optional(),
  foundationalQueries: z
    .array(
      z.object({
        author: z.string().min(1),
        title: z.string().min(1),
        publicationYear: z.coerce.number().int().min(0),
      }),
    )
    .max(2)
    .optional(),
});

const RawGeminiBoxSchema = z.object({
  title: z.string().min(1),
  boxType: z.enum([
    "PROBLEMATIZATION",
    "CONCEPTUAL",
    "DATA_PROTOCOL",
    "PRIMARY_MATERIAL",
  ]),
  description: z.string().min(1),
  subBoxes: z.array(RawSubBoxSchema),
});

const RawBoxGenerationResponseSchema = z.object({
  boxes: z.array(RawGeminiBoxSchema).min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize box structure to a comparable key */
function boxFingerprint(boxes: GeminiThesisBox[]): string {
  const canonical = boxes
    .filter((b) => b.boxType !== "RELATED_THESES") // exclude server-appended box
    .map((b) => ({
      title: b.title,
      boxType: b.boxType,
      subBoxTitles: (b.subBoxes ?? []).map((s) => s.title),
    }));
  return JSON.stringify(canonical);
}

/** Build a stable key for a champion FoundationalQuery */
function championKey(champ: FoundationalQuery): string {
  return `${champ.author} | ${champ.title} | ${champ.publicationYear}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(100));
  console.log("BOX GENERATION + CO-CITATION MINING — 3x STABILITY TEST");
  console.log("=".repeat(100));

  // 1. Connect DB
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool, { schema, casing: "snake_case" });

  const [matrix] = await db
    .select()
    .from(schema.thesisMatrices)
    .where(eq(schema.thesisMatrices.id, 3));
  if (!matrix) {
    console.error("ERROR: Thesis Matrix ID=3 not found");
    await pool.end();
    process.exit(1);
  }

  const [report] = await db
    .select()
    .from(schema.originalityReports)
    .where(eq(schema.originalityReports.userId, matrix.userId));
  if (!report) {
    console.error("ERROR: Originality Report not found for userId=" + matrix.userId);
    await pool.end();
    process.exit(1);
  }

  console.log(`\n📋 Thesis: ${matrix.studyTitle.substring(0, 80)}…`);
  console.log(`📋 Badge: ${report.tezaraResults.originalityBadge}`);
  console.log(`📋 Overlap theses: ${report.tezaraResults.overlapTable.length}\n`);

  // Common prompt parameters
  const promptParams = {
    studyTitle: matrix.studyTitle,
    researchQuestion: matrix.researchQuestion,
    mainClaim: matrix.mainClaim,
    theoreticalFramework: matrix.theoreticalFramework,
    methodology: matrix.methodology,
    researchScope: matrix.researchScope,
  };

  const RUNS = 3;
  const boxResults: { run: number; boxes: GeminiThesisBox[]; raw: unknown }[] = [];

  // ======================================================================
  // PHASE 1: Box Generation — 3 runs
  // ======================================================================

  console.log("─".repeat(100));
  console.log("PHASE 1: BOX STRUCTURE GENERATION (3 runs)");
  console.log("─".repeat(100));

  for (let run = 1; run <= RUNS; run++) {
    console.log(`\n  ▶ Run ${run} — generating box structure via Gemini…`);
    const flowId = createFlowId();
    const log = new Logger(flowId);

    try {
      const geminiPrompt = buildThesisBoxGenerationPrompt(promptParams);

      const generationResult = await generateStructuredContent<
        z.infer<typeof RawBoxGenerationResponseSchema>
      >(
        GEMINI_MODEL,
        buildThesisBoxGenerationSystemInstruction(),
        geminiPrompt,
        thesisBoxGenerationSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          zodSchema: RawBoxGenerationResponseSchema,
          temperature: TEMPERATURE,
          seed: SEED,
        },
      );

      const rawBoxes = generationResult.boxes || [];

      // Normalize to GeminiThesisBox[] (same logic as actions.ts)
      const normalizedBoxes: GeminiThesisBox[] = rawBoxes.map(
        (box: z.infer<typeof RawGeminiBoxSchema>) => ({
          title: box.title,
          boxType: box.boxType as GeminiThesisBox["boxType"],
          description: box.description,
          parentId: null,
          semanticQuery: null,
          subBoxes: (box.subBoxes || []).map((sb) => ({
            title: sb.title,
            boxType: box.boxType as GeminiThesisBox["boxType"],
            description: sb.title,
            parentId: null,
            semanticQuery: sb.semanticQuery,
            subBoxes: undefined,
            foundationalQueries: sb.foundationalQueries ?? [],
            concepts: sb.concepts ?? [],
          })),
          foundationalQueries: [],
        }),
      );

      boxResults.push({ run, boxes: normalizedBoxes, raw: rawBoxes });
      console.log(`  ✅ Run ${run} — ${normalizedBoxes.length} boxes generated`);

      // Print box structure summary
      for (const b of normalizedBoxes) {
        console.log(
          `       ${b.boxType.padEnd(18)} | "${b.title}" | ${(b.subBoxes ?? []).length} sub-boxes`,
        );
      }
    } catch (err) {
      console.error(`  ❌ Run ${run} FAILED:`, err instanceof Error ? err.message : String(err));
      boxResults.push({ run, boxes: [], raw: null });
    }
  }

  // ======================================================================
  // PHASE 1 — Comparison
  // ======================================================================

  console.log("\n" + "━".repeat(100));
  console.log("BOX STRUCTURE COMPARISON");
  console.log("━".repeat(100));

  const prints = boxResults.map((r) => ({
    run: r.run,
    count: r.boxes.length,
    fingerprint: boxFingerprint(r.boxes),
    names: r.boxes
      .filter((b) => b.boxType !== "RELATED_THESES")
      .map((b) => `[${b.boxType}] ${b.title}`),
  }));

  for (const p of prints) {
    console.log(`\n  Run ${p.run} — ${p.count} boxes:`);
    for (const n of p.names) {
      console.log(`    ${n}`);
    }
  }

  // Check variance
  const fpSet = new Set(prints.map((p) => p.fingerprint));
  const boxStructureStable = fpSet.size === 1;

  if (boxStructureStable) {
    console.log(`\n  ✅ BOX STRUCTURE: 0% variance — all ${RUNS} runs IDENTICAL`);
  } else {
    console.log(`\n  ⚠️ BOX STRUCTURE VARIANCE DETECTED — ${fpSet.size} distinct fingerprints`);
  }

  // ======================================================================
  // PHASE 2: Co-Citation Mining — 3 runs with IDENTICAL queries
  // ======================================================================

  // Use queries from the first successful run
  const firstValidRun = boxResults.find((r) => r.boxes.length > 0);
  if (!firstValidRun) {
    console.error("ERROR: No successful box generation to extract queries from");
    await pool.end();
    process.exit(1);
  }

  const allQueries: { box: GeminiThesisBox; query: string }[] = [];
  for (const box of firstValidRun.boxes) {
    if (box.boxType === "PRIMARY_MATERIAL" || box.boxType === "RELATED_THESES") continue;
    for (const sb of box.subBoxes ?? []) {
      if (sb.semanticQuery?.trim()) {
        allQueries.push({ box, query: sb.semanticQuery });
      }
    }
  }

  console.log("\n" + "─".repeat(100));
  console.log(`PHASE 2: CO-CITATION MINING — ${allQueries.length} queries × ${RUNS} runs`);
  console.log("─".repeat(100));

  // Print queries
  for (let i = 0; i < allQueries.length; i++) {
    console.log(`  Q${i + 1}: [${allQueries[i].box.boxType}] ${allQueries[i].box.title} → "${allQueries[i].query.substring(0, 90)}…"`);
  }

  interface RunChampionSet {
    run: number;
    champions: FoundationalQuery[];
    rawRefereeVerdicts: { queryIdx: number; champion: FoundationalQuery }[];
  }

  const miningResults: RunChampionSet[] = [];

  for (let run = 1; run <= RUNS; run++) {
    console.log(`\n  ▶ Run ${run} — mining co-citations…`);
    const flowId = createFlowId();
    const log = new Logger(flowId);

    const runChampions: FoundationalQuery[] = [];
    const rawVerdicts: { queryIdx: number; champion: FoundationalQuery }[] = [];

    for (let qi = 0; qi < allQueries.length; qi++) {
      const { box, query } = allQueries[qi];
      const boxContext = {
        boxType: box.boxType,
        title: box.title,
        description: box.description,
      };

      const mined = await mineCoCitations([query], log, boxContext);
      const champ = mined[0];
      runChampions.push(champ);
      rawVerdicts.push({ queryIdx: qi, champion: champ });
    }

    miningResults.push({ run, champions: runChampions, rawRefereeVerdicts: rawVerdicts });
    console.log(`  ✅ Run ${run} — ${runChampions.filter(Boolean).length} champions found`);
  }

  // ======================================================================
  // PHASE 2 — Comparison
  // ======================================================================

  console.log("\n" + "━".repeat(100));
  console.log("CHAMPION VERIFICATION TABLE");
  console.log("━".repeat(100));

  // Build side-by-side table
  const header = `| Q# | Sub-Box Title | Metric | Run 1 | Run 2 | Run 3 | Variance? |`;
  const sep = `|${"-".repeat(3)}|${"-".repeat(45)}|${"-".repeat(9)}|${"-".repeat(32)}|${"-".repeat(32)}|${"-".repeat(32)}|${"-".repeat(10)}|`;

  console.log(`\n${sep}`);
  console.log(header);
  console.log(sep);

  let totalVariance = 0;

  for (let qi = 0; qi < allQueries.length; qi++) {
    const { box, query } = allQueries[qi];
    const subBox = (box.subBoxes ?? [])[qi] ?? { title: "unknown" };

    const champs = miningResults.map((r) => r.champions[qi]);
    const keys = champs.map((c) => (c ? championKey(c) : "—"));

    const keySet = new Set(keys);
    const hasVariance = keySet.size > 1;
    if (hasVariance) totalVariance++;

    // Row
    const qNum = `Q${qi + 1}`;
    const sTitle = subBox.title.length > 42 ? subBox.title.substring(0, 39) + "…" : subBox.title;

    console.log(
      `| ${qNum.padEnd(2)} | ${sTitle.padEnd(43)} | Author    | ${(champs[0]?.author ?? "—").padEnd(30)} | ${(champs[1]?.author ?? "—").padEnd(30)} | ${(champs[2]?.author ?? "—").padEnd(30)} | ${hasVariance ? "⚠️ VARIANT" : "✅ OK".padEnd(9)} |`,
    );
    console.log(
      `| ${"".padEnd(3)} | ${"".padEnd(43)} | Title     | ${(champs[0]?.title ?? "—").padEnd(30)} | ${(champs[1]?.title ?? "—").padEnd(30)} | ${(champs[2]?.title ?? "—").padEnd(30)} | ${"".padEnd(10)} |`,
    );
    console.log(
      `| ${"".padEnd(3)} | ${"".padEnd(43)} | Year      | ${String(champs[0]?.publicationYear ?? "—").padEnd(30)} | ${String(champs[1]?.publicationYear ?? "—").padEnd(30)} | ${String(champs[2]?.publicationYear ?? "—").padEnd(30)} | ${"".padEnd(10)} |`,
    );
  }

  console.log(sep);
  const totalQueries = allQueries.length;
  const variancePct = ((totalVariance / totalQueries) * 100).toFixed(1);
  console.log(`\n📊 CHAMPION VARIANCE: ${totalVariance}/${totalQueries} queries (${variancePct}%)`);

  if (totalVariance === 0) {
    console.log(`✅ PERFECT STABILITY — 0% champion variance across ${RUNS} runs`);
  } else {
    console.log(`⚠️ VARIANCE DETECTED — See above for details`);
  }

  // ======================================================================
  // SUMMARY
  // ======================================================================

  console.log("\n" + "━".repeat(100));
  console.log("CONSOLIDATED SUMMARY");
  console.log("━".repeat(100));

  const summaryRows = [
    ["Box Structure Stability", boxStructureStable ? "✅ PASS" : "⚠️ FAIL"],
    ...prints.map((p) => [`  Run ${p.run} — Total Boxes`, String(p.count)]),
    [
      "Champion Variance (cross-run)",
      totalVariance === 0
        ? `✅ 0% (${totalVariance}/${totalQueries})`
        : `⚠️ ${variancePct}% (${totalVariance}/${totalQueries})`,
    ],
    [
      "Top-2 Sub-Box Champion Stability",
      miningResults.length > 0
        ? (() => {
            const top2 = allQueries.slice(0, Math.min(2, allQueries.length));
            let top2Variance = 0;
            for (let qi = 0; qi < top2.length; qi++) {
              const keys = miningResults.map((r) => championKey(r.champions[qi]));
              if (new Set(keys).size > 1) top2Variance++;
            }
            return top2Variance === 0 ? "✅ 0% variance" : `⚠️ variance in ${top2Variance}/2`;
          })()
        : "N/A",
    ],
  ];

  const col1W = Math.max(...summaryRows.map((r) => r[0].length)) + 2;
  for (const [label, value] of summaryRows) {
    console.log(`  ${label.padEnd(col1W)} ${value}`);
  }

  console.log("\n" + "=".repeat(100));

  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
