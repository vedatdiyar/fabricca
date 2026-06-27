/**
 * Isolated 3x Regression Test — Cohere & Gemini Stabilization Patch.
 *
 * Uses the EXACT same 20 candidate theses (fetched once in Phase 0),
 * then runs Cohere Rerank and Gemini Jury 3 times on that fixed set
 * to verify badge + overlapTable variance is dead.
 *
 * Run:  npx tsx scripts/regression-isolated.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL not found in .env.local");
  process.exit(1);
}

type TezaraDetails = {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  abstract: string;
  yokPdfUrl?: string;
};

interface CohereRunResult {
  ids: { id: number; score: number }[];
  allEqual: boolean;
}

interface GeminiRunResult {
  overlapTableLength: number;
  eliminatedCount: number;
  badge: string;
  targetScorecards: {
    id: number;
    subject_overlap: string;
    methodology_overlap: string;
    theory_overlap: string;
    context_overlap: string;
    scorecard: Record<string, boolean | undefined>;
  }[];
  allPresentIds: number[];
}

const SEP = "=".repeat(78);

async function run(): Promise<void> {
  // ── Dynamic imports (dotenv already ran) ─────────────────────────
  const { db } = await import("@/db");
  const { thesisMatrices } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { createFlowId, Logger } = await import("@/lib/logger");
  const { rerankTheses } = await import("@/lib/cohere");
  const {
    analyzeOriginalityRisk,
    calculateOriginalityRisk,
  } = await import(
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
  console.log("  ISOLATED 3x REGRESSION TEST");
  console.log("  Pipeline: Sift(1×) → Cohere(3×) → Gemini(3×)");
  console.log(SEP);

  // ── Phase 0: Load Matrix ID=3 ───────────────────────────────────
  const MATRIX_ID = 3;
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.id, MATRIX_ID));

  if (!matrix) {
    console.error(`FATAL: Thesis Matrix ID ${MATRIX_ID} not found.`);
    process.exit(1);
  }

  const matrixInput = {
    studyTitle: matrix.studyTitle,
    researchQuestion: matrix.researchQuestion,
    mainClaim: matrix.mainClaim,
    theoreticalFramework: matrix.theoreticalFramework,
    methodology: matrix.methodology,
    researchScope: matrix.researchScope,
  };

  console.log(`\n  Matrix ID=${matrix.id}`);
  console.log(`  Title: ${matrix.studyTitle.slice(0, 60)}…`);

  // ── Phase 0: Run sifting ONCE to get the fixed 20 theses ────────
  console.log(`\n  >>> Phase 0: Fetching 20 theses via sifting (1× only)`);

  const log0 = new Logger(createFlowId());
  const extracted = await extractQueries(matrixInput, log0);
  const { tezaraSearchResults } = await executeParallelSearch(
    extracted.tavilyQueries,
    extracted.tezaraQueries,
    log0,
  );
  const { finalTheses } = await siftAndFetchDetails(
    matrixInput,
    tezaraSearchResults,
    log0,
  );

  if (finalTheses.length === 0) {
    console.error("FATAL: Sifting returned 0 theses.");
    process.exit(1);
  }

  // Sort once by ID for deterministic input to all subsequent phases
  const theses: TezaraDetails[] = [...finalTheses].sort(
    (a, b) => a.id - b.id,
  );
  const thesisIds = theses.map((t) => t.id);
  const titles = theses.map((t) => t.title);

  console.log(
    `  ✅ Fixed ${theses.length} theses (IDs: ${thesisIds[0]}..${thesisIds[thesisIds.length - 1]})`,
  );
  console.log(`  Full ID set: [${thesisIds.join(", ")}]`);

  // Build the rerank query
  const rerankQuery = [
    `studyTitle: ${matrixInput.studyTitle}`,
    `researchQuestion: ${matrixInput.researchQuestion}`,
    `mainClaim: ${matrixInput.mainClaim}`,
    `theoreticalFramework: ${matrixInput.theoreticalFramework}`,
    `methodology: ${matrixInput.methodology}`,
    `researchScope: ${matrixInput.researchScope}`,
  ].join("\n");

  // ══════════════════════════════════════════════════════════════════
  // PHASE A — 3× COHERE RERANK
  // ══════════════════════════════════════════════════════════════════
  console.log(`\n${SEP}`);
  console.log("  PHASE A — 3× COHERE RERANK (fixed 20 titles, sorted by ID)");
  console.log(SEP);

  const cohereResults: CohereRunResult[] = [];

  for (let run = 1; run <= 3; run++) {
    const log = new Logger(createFlowId());
    const { results } = await rerankTheses(rerankQuery, titles, log);

    // Apply deterministic tiebreak sort (same as sifting.ts)
    const sorted = results
      .sort((a, b) => {
        const diff = b.relevanceScore - a.relevanceScore;
        if (Math.abs(diff) < 0.001) {
          return theses[a.index].id - theses[b.index].id;
        }
        return diff;
      })
      .slice(0, 20);

    const ids = sorted.map((r) => ({
      id: theses[r.index].id,
      score: r.relevanceScore,
    }));

    const idList = ids.map((i) => i.id);
    console.log(`\n  ─── Run ${run} Cohere Order ───`);
    for (let pos = 0; pos < idList.length; pos++) {
      const marker = pos === 0 ? "🥇" : pos === 19 ? "⚠️ #20" : "   ";
      console.log(
        `  ${marker} #${(pos + 1).toString().padStart(2)}: ID=${String(idList[pos]).padStart(6)}  score=${ids[pos].score.toFixed(4)}`,
      );
    }

    // Check if identical to first run
    const allEqual =
      cohereResults.length > 0
        ? idList.every(
            (id, i) => i < cohereResults[0].ids.length && cohereResults[0].ids[i].id === id,
          )
        : true;

    cohereResults.push({ ids, allEqual });
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE B — 3× GEMINI JURY
  // ══════════════════════════════════════════════════════════════════
  console.log(`\n${SEP}`);
  console.log("  PHASE B — 3× GEMINI JURY (fixed 20 details, LOW thinking)");
  console.log(SEP);

  const geminiResults: GeminiRunResult[] = [];

  for (let run = 1; run <= 3; run++) {
    const log = new Logger(createFlowId());
    const { overlapTable } = await analyzeOriginalityRisk(
      { ...matrixInput, validDetails: theses },
      log,
    );

    const result = calculateOriginalityRisk(overlapTable, theses, log);

    // Extract scorecards for the previously mutated theses
    const targetIds = [811406, 967022];
    const targetScorecards = overlapTable
      .filter((o) => targetIds.includes(o.id))
      .map((o) => ({
        id: o.id,
        subject_overlap: o.subject_overlap,
        methodology_overlap: o.methodology_overlap,
        theory_overlap: o.theory_overlap,
        context_overlap: o.context_overlap,
        scorecard: {
          same_core_question: o.subject_scorecard?.same_core_question,
          is_subsumed_subject: o.subject_scorecard?.is_subsumed,
          significant_topic_intersection: o.subject_scorecard?.significant_topic_intersection,
          background_mention_only: o.subject_scorecard?.background_mention_only,
          identical_method_and_tools: o.methodology_scorecard?.identical_method_and_tools,
          partially_shared_approach: o.methodology_scorecard?.partially_shared_approach,
          different_empirical_design: o.methodology_scorecard?.different_empirical_design,
          same_theoretical_backbone: o.theory_scorecard?.same_theoretical_backbone,
          shared_concepts_only: o.theory_scorecard?.shared_concepts_only,
          different_epistemology: o.theory_scorecard?.different_epistemology,
          overlapping_universe_and_sample: o.context_scorecard?.overlapping_universe_and_sample,
          partial_contextual_contact: o.context_scorecard?.partial_contextual_contact,
          distinct_context: o.context_scorecard?.distinct_context,
        },
      }));

    const allPresentIds = overlapTable.map((o) => o.id);

    console.log(`\n  ─── Run ${run} Jury Results ───`);
    console.log(`  Badge:         ${result.originalityBadge}`);
    console.log(`  Overlap Table: ${result.overlapTable.length} rows`);
    console.log(`  Eliminated:    ${result.eliminatedTheses.length}`);
    console.log(`  Thesis IDs in overlap: [${allPresentIds.join(", ")}]`);

    // Check if 811406 is present and what its scorecard says
    for (const id of targetIds) {
      const found = targetScorecards.find((s) => s.id === id);
      if (found) {
        console.log(`\n  📋 ID=${id} scorecard:`);
        console.log(
          `     subject=${found.subject_overlap}  method=${found.methodology_overlap}  theory=${found.theory_overlap}  context=${found.context_overlap}`,
        );
        console.log(`     booleans: ${JSON.stringify(found.scorecard)}`);
      } else {
        // Check if it was eliminated
        const eliminated = result.eliminatedTheses.find((e) => e.id === id);
        if (eliminated) {
          console.log(`\n  ❌ ID=${id}: ELIMINATED (subject+context both OZGUN)`);
        } else {
          console.log(`\n  ❌ ID=${id}: NOT FOUND in any output (dropped by Gemini)`);
        }
      }
    }

    geminiResults.push({
      overlapTableLength: result.overlapTable.length,
      eliminatedCount: result.eliminatedTheses.length,
      badge: result.originalityBadge,
      targetScorecards,
      allPresentIds,
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE C — VERIFICATION TABLE
  // ══════════════════════════════════════════════════════════════════
  console.log(`\n${SEP}`);
  console.log("  VERIFICATION — SIDE-BY-SIDE COMPARISON");
  console.log(SEP);

  const H = (label: string, r1: string, r2: string, r3: string): void => {
    console.log(
      `  ${label.padEnd(38)} │ ${r1.padEnd(12)} │ ${r2.padEnd(12)} │ ${r3.padEnd(12)}`,
    );
  };

  H("", "RUN 1", "RUN 2", "RUN 3");
  console.log(
    `  ${"─".repeat(38)}─┼─${"─".repeat(12)}─┼─${"─".repeat(12)}─┼─${"─".repeat(12)}`,
  );

  const yesNo = (v: boolean): string => (v ? "✅ same" : "❌ DIFF");

  // Phase A: Cohere consistency
  const cohereStable =
    cohereResults[1].allEqual && cohereResults[2].allEqual;

  H("Cohere Rerank IDs identical", yesNo(true), yesNo(cohereResults[1].allEqual), yesNo(cohereResults[2].allEqual));
  H("  Cohere #20 ID", String(cohereResults[0].ids[19].id), String(cohereResults[1].ids[19].id), String(cohereResults[2].ids[19].id));
  H("  Cohere #1 ID", String(cohereResults[0].ids[0].id), String(cohereResults[1].ids[0].id), String(cohereResults[2].ids[0].id));

  // Phase B: Gemini consistency
  const badgeStable =
    geminiResults[0].badge === geminiResults[1].badge &&
    geminiResults[0].badge === geminiResults[2].badge;

  H("Badge", geminiResults[0].badge.padEnd(12), geminiResults[1].badge.padEnd(12), geminiResults[2].badge.padEnd(12));
  H("Overlap Table rows", String(geminiResults[0].overlapTableLength), String(geminiResults[1].overlapTableLength), String(geminiResults[2].overlapTableLength));
  H("Eliminated rows", String(geminiResults[0].eliminatedCount), String(geminiResults[1].eliminatedCount), String(geminiResults[2].eliminatedCount));

  // Specific thesis scorecard consistency
  const checkScorecard = (id: number): string => {
    const scorecards = geminiResults.map((r) => {
      const found = r.targetScorecards.find((s) => s.id === id);
      if (!found) return "ABSENT";
      return `${found.subject_overlap}/${found.methodology_overlap}/${found.theory_overlap}/${found.context_overlap}`;
    });
    const allSame = scorecards.every((s) => s === scorecards[0]);
    return allSame ? scorecards[0] : `❌ ${scorecards.join("|")}`;
  };

  H("ID=811406 scorecard", checkScorecard(811406), "", "");
  H("ID=967022 scorecard", checkScorecard(967022), "", "");
  H("ID count in overlap table", String(geminiResults[0].allPresentIds.length), String(geminiResults[1].allPresentIds.length), String(geminiResults[2].allPresentIds.length));

  // Dropped thesis check
  const droppedInRun = (run: number): string => {
    const ids = geminiResults[run].allPresentIds;
    const dropped = thesisIds.filter((id) => !ids.includes(id));
    // Also check eliminated
    return dropped.length ? `dropped(${dropped.join(",")})` : "all present";
  };

  H("Dropped IDs", droppedInRun(0), droppedInRun(1), droppedInRun(2));

  console.log(`\n${SEP}`);

  // ── VERDICT ────────────────────────────────────────────────────
  const allPassed =
    cohereStable &&
    badgeStable &&
    geminiResults[0].overlapTableLength === geminiResults[1].overlapTableLength &&
    geminiResults[0].overlapTableLength === geminiResults[2].overlapTableLength;

  if (allPassed) {
    console.log(
      "  ✅ PATCH VERIFIED — Badge + overlap table + Cohere order are stable across 3 runs.",
    );
  } else {
    console.log("  ❌ VARIANCE DETECTED — review the table above.");
    if (!cohereStable) console.log("     → Cohere order varied across runs.");
    if (!badgeStable) console.log("     → Badge varied across runs.");
  }

  console.log(SEP + "\n");
}

run().catch((err) => {
  console.error("\n❌ Test crashed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
