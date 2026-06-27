/**
 * Isolated 3x Gemini Jury Regression Test.
 *
 * Uses the exact same 20 candidate theses (fetched once via full pipeline),
 * then runs Gemini Jury Analysis 3 times to verify methodology conservative
 * bias eliminates scorecard mutation for boundary thesis 967022.
 *
 * Run:  npx tsx scripts/regression-jury-only.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) process.exit(1);

type TezaraDetails = {
  id: number; title: string; author: string; university: string;
  year: number; thesisType: string; department: string;
  abstract: string; yokPdfUrl?: string;
};

interface RunResult {
  badge: string;
  overlapRows: number;
  eliminatedCount: number;
  presentIds: number[];
  s967022: { present: boolean; methodOverlap: string; booleans: Record<string, boolean | undefined> } | null;
  s811406: { present: boolean; methodOverlap: string; booleans: Record<string, boolean | undefined> } | null;
}

const SEP = "=".repeat(78);

async function run(): Promise<void> {
  const { db } = await import("@/db");
  const { thesisMatrices } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { createFlowId, Logger } = await import("@/lib/logger");
  const { analyzeOriginalityRisk, calculateOriginalityRisk } = await import(
    "@/app/(auth)/onboarding/risk/_services/analysis"
  );
  const { extractQueries } = await import(
    "@/app/(auth)/onboarding/risk/_services/queries"
  );
  const { executeParallelSearch } = await import(
    "@/app/(auth)/onboarding/risk/_services/search"
  );
  const { siftAndFetchDetails } = await import(
    "@/app/(auth)/onboarding/risk/_services/sifting"
  );

  console.log(SEP);
  console.log("  JURY-ONLY 3x REGRESSION — Methodology Conservative Bias");
  console.log(SEP);

  // ── Load Matrix ID=3 ──────────────────────────────────
  const [matrix] = await db.select().from(thesisMatrices).where(eq(thesisMatrices.id, 3));
  if (!matrix) { console.error("Matrix ID=3 not found."); process.exit(1); }
  const matrixInput = {
    studyTitle: matrix.studyTitle, researchQuestion: matrix.researchQuestion,
    mainClaim: matrix.mainClaim, theoreticalFramework: matrix.theoreticalFramework,
    methodology: matrix.methodology, researchScope: matrix.researchScope,
  };

  // ── Phase 0: Fetch 20 theses ONCE ──────────────────────
  console.log(`\n  >>> Phase 0: Fetching 20 theses via sifting (1×)`);
  const log0 = new Logger(createFlowId());
  const extracted = await extractQueries(matrixInput, log0);
  const { tezaraSearchResults } = await executeParallelSearch(
    extracted.tavilyQueries, extracted.tezaraQueries, log0,
  );
  const { finalTheses } = await siftAndFetchDetails(matrixInput, tezaraSearchResults, log0);
  if (finalTheses.length === 0) { console.error("0 theses."); process.exit(1); }

  const theses: TezaraDetails[] = [...finalTheses].sort((a, b) => a.id - b.id);
  const fullIds = theses.map(t => t.id);
  console.log(`  ✅ ${theses.length} theses locked: [${fullIds.join(", ")}]`);
  console.log(`  Instruction includes methodology conservative bias`);
  console.log(`  Thinking: LOW  |  Temperature: 1.0  |  Seed: 42`);

  // ── Phase B: 3× Gemini Jury ────────────────────────────
  console.log(`\n${SEP}`);
  console.log("  PHASE B — 3× GEMINI JURY (locked 20 theses)");
  console.log(SEP);

  const results: RunResult[] = [];

  for (let run = 1; run <= 3; run++) {
    const log = new Logger(createFlowId());
    const { overlapTable } = await analyzeOriginalityRisk(
      { ...matrixInput, validDetails: theses }, log,
    );
    const result = calculateOriginalityRisk(overlapTable, theses, log);

    const extractScorecard = (id: number) => {
      const found = overlapTable.find(o => o.id === id);
      if (!found) {
        const eliminated = result.eliminatedTheses.find(e => e.id === id);
        return { present: false, methodOverlap: eliminated ? "ELIMINATED" : "ABSENT", booleans: {} };
      }
      return {
        present: true,
        methodOverlap: found.methodology_overlap,
        booleans: {
          identical_method_and_tools: found.methodology_scorecard?.identical_method_and_tools,
          partially_shared_approach: found.methodology_scorecard?.partially_shared_approach,
          different_empirical_design: found.methodology_scorecard?.different_empirical_design,
        },
      };
    };

    const r: RunResult = {
      badge: result.originalityBadge,
      overlapRows: result.overlapTable.length,
      eliminatedCount: result.eliminatedTheses.length,
      presentIds: result.overlapTable.map(o => o.id),
      s967022: extractScorecard(967022),
      s811406: extractScorecard(811406),
    };
    results.push(r);

    console.log(`\n  ─── Run ${run} ───`);
    console.log(`  Badge:         ${r.badge}`);
    console.log(`  Overlap Table: ${r.overlapRows} rows`);
    console.log(`  Eliminated:    ${r.eliminatedCount}`);
    console.log(`  Present IDs:   [${r.presentIds.join(", ")}]`);
    console.log(`  ID=811406 method: ${r.s811406.methodOverlap}`);
    console.log(`  ID=967022 method: ${r.s967022.methodOverlap}`);
    if (r.s967022.present) {
      console.log(`    967022 booleans: ${JSON.stringify(r.s967022.booleans)}`);
    }
  }

  // ── Verification Table ──────────────────────────────────
  console.log(`\n${SEP}`);
  console.log("  VERIFICATION — SIDE-BY-SIDE");
  console.log(SEP);

  const H = (label: string, ...vals: string[]) => {
    console.log(`  ${label.padEnd(32)} │ ${vals.map(v => v.padEnd(14)).join("│ ")}`);
  };
  H("", "RUN 1", "RUN 2", "RUN 3");
  console.log(`  ${"─".repeat(32)}─┼─${"─".repeat(14)}─┼─${"─".repeat(14)}─┼─${"─".repeat(14)}`);

  H("Badge", ...results.map(r => r.badge));
  H("Overlap Table rows", ...results.map(r => String(r.overlapRows)));
  H("Eliminated", ...results.map(r => String(r.eliminatedCount)));

  // 967022 methodology overlap
  const m967 = results.map(r => r.s967022.methodOverlap);
  H("967022 method overlap", ...m967);
  const m811 = results.map(r => r.s811406.methodOverlap);
  H("811406 method overlap", ...m811);

  // 967022 booleans
  const b967 = results.map(r =>
    r.s967022.present ? JSON.stringify(r.s967022.booleans) : r.s967022.methodOverlap
  );
  H("967022 booleans", ...b967);

  // Overlap table count consistency
  const overlapIds = results.map(r => r.presentIds.join(","));
  H("Present IDs", ...overlapIds.map(s => `${s.split(",").length} items`));

  // ── Verdict ────────────────────────────────────────────
  console.log(`\n${SEP}`);
  const badgeStable = results.every(r => r.badge === results[0].badge);
  const methodStable = m967.every(m => m === m967[0]);
  const overlapStable = results.every(r => r.overlapRows === results[0].overlapRows);

  if (badgeStable && methodStable && overlapStable) {
    console.log(`  ✅ FULLY STABLE — Badge, overlap table, AND 967022 methodology are locked.`);
  } else {
    console.log(`  ⚠️  Results:`);
    if (!badgeStable) console.log(`     ❌ Badge varied`);
    if (!methodStable) console.log(`     ❌ 967022 methodology varied: ${m967.join(" → ")}`);
    if (!overlapStable) console.log(`     ❌ Overlap table row count varied: ${results.map(r => r.overlapRows).join(" → ")}`);
  }
  console.log(SEP + "\n");
}

run().catch(err => { console.error(err); process.exit(1); });
