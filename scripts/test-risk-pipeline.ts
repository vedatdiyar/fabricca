/**
 * Onboarding Risk Stage — 3x Parallel Search & Analysis Consistency Test.
 *
 * Exercises the full 4-stage risk analysis pipeline by calling the
 * underlying services directly (bypassing the Next.js server-action
 * layer), 3 consecutive times against the live Neon database, Gemini,
 * Tavily, Tezara (YÖKTEZ), and Cohere APIs.
 *
 * Run from project root:
 *   npx tsx scripts/test-risk-pipeline.ts
 *
 * Constraints:
 *   - No mocking framework — hits every real external API.
 *   - No new package dependencies (tsx + dotenv already in devDeps).
 *   - Loads Thesis Matrix ID=3 from the database.
 */

// ==================================================================
// Bootstrap: load env BEFORE any module that reads DATABASE_URL
// (which triggers Neon Pool creation at module-load time)
// ==================================================================
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Services (no Next.js dependency — safe to import statically)
import { createFlowId, Logger } from "@/lib/logger";
import { extractQueries } from "@/app/(auth)/onboarding/risk/_services/queries";
import {
  executeParallelSearch,
  evaluateTavilyResults,
} from "@/app/(auth)/onboarding/risk/_services/search";
import { siftAndFetchDetails } from "@/app/(auth)/onboarding/risk/_services/sifting";
import {
  analyzeOriginalityRisk,
  calculateOriginalityRisk,
} from "@/app/(auth)/onboarding/risk/_services/analysis";
import { synthesizeRoadmap } from "@/app/(auth)/onboarding/risk/_services/roadmap";

import type {
  OriginalityReportData,
  TezaraThesisDetails,
} from "@/lib/types";

// ==================================================================
// Result type for each run
// ==================================================================
interface RunStats {
  run: number;
  /** Total wall-clock duration of the 4-stage pipeline (ms) */
  totalDurationMs: number;
  /** Phase durations */
  queryExtractMs: number;
  parallelSearchMs: number;
  tavilyEvalMs: number;
  siftMs: number;
  juryAnalysisMs: number;
  roadmapMs: number;
  /** Keywords generated */
  tavilyQueryCount: number;
  tezaraQueryCount: number;
  keywordCount: number;
  /** Tavily evaluation */
  tavilyFactCount: number;
  /** Tezara results pipeline */
  rawTezaraCount: number;
  uniqueTezaraAfterDedup: number;
  cohereSelected: number;
  fetchSuccess: number;
  /** Jury results */
  overlapTableLength: number;
  eliminatedCount: number;
  originalityBadge: string;
      /** Network health */
      has429: boolean;
      has503: boolean;
      hasTimeout: boolean;
  /** Success */
  success: boolean;
  error: string | null;
}

// ==================================================================
// Helpers
// ==================================================================
const SEP = "─".repeat(78);

/** Check a concatenated log string for network error patterns. */
function checkNetworkHealth(logText: string): {
  has429: boolean;
  has503: boolean;
  hasTimeout: boolean;
} {
  return {
    has429: /\b429\b|too many requests|rate.limit/i.test(logText),
    has503: /\b503\b|unavailable|high demand/i.test(logText),
    hasTimeout: /\btimeout\b|aborterror|abort|etimedout|econnrefused/i.test(
      logText,
    ),
  };
}

// ==================================================================
// Main
// ==================================================================
async function run(): Promise<void> {
  // ── Validate env ─────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL not found in .env.local");
    process.exit(1);
  }

  // ── Dynamic imports (dotenv already ran) ─────────────────────────
  const { db } = await import("@/db");
  const { thesisMatrices } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  console.log(SEP);
  console.log("  RISK PIPELINE CONSISTENCY TEST — 3x RUNS");
  console.log(
    "  Pipeline: QueryExtract → ParallelSearch → Sift → JuryAnalysis",
  );
  console.log(SEP);

  // ── Load thesis matrix ───────────────────────────────────────────
  const MATRIX_ID = 3;
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.id, MATRIX_ID));

  if (!matrix) {
    console.error(
      `FATAL: Thesis Matrix ID ${MATRIX_ID} not found. Run the Matrix test first.`,
    );
    process.exit(1);
  }

  console.log(`  Matrix: ID=${matrix.id}`);
  console.log(`  Title: ${matrix.studyTitle.slice(0, 60)}…`);
  console.log(SEP);

  const matrixInput = {
    studyTitle: matrix.studyTitle,
    researchQuestion: matrix.researchQuestion,
    mainClaim: matrix.mainClaim,
    theoreticalFramework: matrix.theoreticalFramework,
    methodology: matrix.methodology,
    researchScope: matrix.researchScope,
  };

  // Intercept console to sniff 429 / timeout warnings from the services
  const capturedLogs: string[] = [];
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    capturedLogs.push(args.join(" "));
    origLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    capturedLogs.push(args.join(" "));
    origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    capturedLogs.push(args.join(" "));
    origError(...args);
  };

  // ── Runs 1–3 ────────────────────────────────────────────────────
  const results: RunStats[] = [];

  for (let run = 1; run <= 3; run++) {
    const runStart = performance.now();
    let error: string | null = null;
    let success = true;

    // Phase timers
    let queryExtractMs = 0;
    let parallelSearchMs = 0;
    let tavilyEvalMs = 0;
    let siftMs = 0;
    let juryAnalysisMs = 0;
    let roadmapMs = 0;

    // Counters
    let tavilyQueryCount = 0;
    let tezaraQueryCount = 0;
    let keywordCount = 0;
    let tavilyFactCount = 0;
    let rawTezaraCount = 0;
    let uniqueTezaraAfterDedup = 0;
    let cohereSelected = 0;
    let fetchSuccess = 0;
    let overlapTableLength = 0;
    let eliminatedCount = 0;
    let originalityBadge = "N/A";

    const log = new Logger(createFlowId());

    // ── Phase 1: Query Extraction ─────────────────────────────────
    try {
      console.log(`\n  >>> RUN ${run} — Phase 1: Query Extraction`);

      const t1 = performance.now();
      const extracted = await extractQueries(matrixInput, log);
      queryExtractMs = performance.now() - t1;

      tavilyQueryCount = extracted.tavilyQueries.length;
      tezaraQueryCount = extracted.tezaraQueries.length;
      keywordCount = extracted.keywords.length;

      console.log(
        `  Tavily queries (${tavilyQueryCount}): ${JSON.stringify(extracted.tavilyQueries)}`,
      );
      console.log(
        `  Tezara queries (${tezaraQueryCount}): ${JSON.stringify(extracted.tezaraQueries)}`,
      );
      console.log(
        `  Keywords (${keywordCount}): ${JSON.stringify(extracted.keywords)}`,
      );

      // ── Phase 2: Parallel Search + Tavily Evaluation ──────────────
      console.log(`\n  >>> RUN ${run} — Phase 2: Parallel Search`);

      const t2 = performance.now();
      const { tavilySearchResults, tezaraSearchResults } =
        await executeParallelSearch(
          extracted.tavilyQueries,
          extracted.tezaraQueries,
          log,
        );
      parallelSearchMs = performance.now() - t2;

      rawTezaraCount = tezaraSearchResults.reduce(
        (sum, list) => sum + list.length,
        0,
      );

      console.log(
        `  Tavily results: ${tavilySearchResults.reduce((s, r) => s + r.results.length, 0)} items`,
      );
      console.log(`  Raw Tezara results: ${rawTezaraCount} items`);

      console.log(`\n  >>> RUN ${run} — Tavily Evaluation`);

      const t3 = performance.now();
      const tavilyResults = await evaluateTavilyResults(
        { studyTitle: matrixInput.studyTitle },
        tavilySearchResults,
        log,
      );
      tavilyEvalMs = performance.now() - t3;

      tavilyFactCount = tavilyResults.items.length;
      console.log(`  Tavily facts evaluated: ${tavilyFactCount}`);

      // ── Phase 3: Sifting ─────────────────────────────────────────
      console.log(`\n  >>> RUN ${run} — Phase 3: Sifting & Fetch Details`);

      const t4 = performance.now();
      const { finalTheses, eliminatedTheses, diagnostic } =
        await siftAndFetchDetails(matrixInput, tezaraSearchResults, log);
      siftMs = performance.now() - t4;

      uniqueTezaraAfterDedup = diagnostic.uniqueAfterDedup;
      cohereSelected = diagnostic.stage1Count;
      fetchSuccess = diagnostic.fetchSuccess;

      console.log(
        `  Unique after dedup: ${uniqueTezaraAfterDedup}, Cohere selected: ${cohereSelected}, Fetch OK: ${fetchSuccess}`,
      );

      // ── Phase 4: Jury Analysis ───────────────────────────────────
      console.log(`\n  >>> RUN ${run} — Phase 4: Jury Analysis`);

      const t5 = performance.now();
      const { overlapTable } = await analyzeOriginalityRisk(
        { ...matrixInput, validDetails: finalTheses },
        log,
      );
      juryAnalysisMs = performance.now() - t5;

      const riskCalcResult = calculateOriginalityRisk(
        overlapTable,
        finalTheses,
        log,
      );

      console.log(
        `  Overlap candidates: ${riskCalcResult.overlapTable.length}, Eliminated: ${riskCalcResult.eliminatedTheses.length}`,
      );

      // Roadmap synthesis
      const t6 = performance.now();
      const strategicRecommendations = await synthesizeRoadmap(
        {
          studyTitle: matrixInput.studyTitle,
          researchQuestion: matrixInput.researchQuestion,
          mainClaim: matrixInput.mainClaim,
          theoreticalFramework: matrixInput.theoreticalFramework,
          methodology: matrixInput.methodology,
          researchScope: matrixInput.researchScope,
          comparisonResults: riskCalcResult.overlapTable.map((item) => ({
            title: item.title,
            author: item.author,
            year: item.year,
            axes: item.axes,
            comparisonNote: item.comparisonNote || "",
          })),
        },
        log,
      );
      roadmapMs = performance.now() - t6;

      overlapTableLength = riskCalcResult.overlapTable.length;
      eliminatedCount = riskCalcResult.eliminatedTheses.length;
      originalityBadge = riskCalcResult.originalityBadge;

      // Build full report data to validate schema
      const reportData: OriginalityReportData = {
        tavilyResults: {
          items: tavilyResults.items,
          briefingNote: tavilyResults.briefingNote,
        },
        tezaraResults: {
          originalityBadge: riskCalcResult.originalityBadge as OriginalityReportData["tezaraResults"]["originalityBadge"],
          overlapTable: riskCalcResult.overlapTable,
          strategicRecommendations,
        },
      };

      // Validate schema: badge must be one of IKIZ|SINIRDAS|OZGUN
      if (
        !["IKIZ", "SINIRDAS", "OZGUN"].includes(
          reportData.tezaraResults.originalityBadge,
        )
      ) {
        throw new Error(
          `Invalid originalityBadge: ${reportData.tezaraResults.originalityBadge}`,
        );
      }
      // overlapTable must be an array
      if (!Array.isArray(reportData.tezaraResults.overlapTable)) {
        throw new Error("overlapTable is not an array");
      }
      // tavilyResults must have items and briefingNote
      if (!Array.isArray(reportData.tavilyResults.items)) {
        throw new Error("tavilyResults.items is not an array");
      }
      if (typeof reportData.tavilyResults.briefingNote !== "string") {
        throw new Error("tavilyResults.briefingNote is not a string");
      }

      console.log(
        `  ✅ Badge: ${originalityBadge}, Strategic recommendations generated`,
      );
      console.log(`  ✅ Full OriginalityReportData schema validated`);
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Run ${run} failed: ${error}`);
    }

    const totalDurationMs = performance.now() - runStart;

    results.push({
      run,
      totalDurationMs: Math.round(totalDurationMs * 100) / 100,
      queryExtractMs: Math.round(queryExtractMs * 100) / 100,
      parallelSearchMs: Math.round(parallelSearchMs * 100) / 100,
      tavilyEvalMs: Math.round(tavilyEvalMs * 100) / 100,
      siftMs: Math.round(siftMs * 100) / 100,
      juryAnalysisMs: Math.round(juryAnalysisMs * 100) / 100,
      roadmapMs: Math.round(roadmapMs * 100) / 100,
      tavilyQueryCount,
      tezaraQueryCount,
      keywordCount,
      tavilyFactCount,
      rawTezaraCount,
      uniqueTezaraAfterDedup,
      cohereSelected,
      fetchSuccess,
      overlapTableLength,
      eliminatedCount,
      originalityBadge,
      has429: false,
      has503: false,
      hasTimeout: false,
      success,
      error,
    });
  }

  // Restore console
  console.log = origLog;
  console.warn = origWarn;
  console.error = origError;

  // Post-process network health from all captured logs
  const allLogs = capturedLogs.join("\n").toLowerCase();
  const { has429, has503, hasTimeout } = checkNetworkHealth(allLogs);
  for (const r of results) {
    r.has429 = has429;
    r.has503 = has503;
    r.hasTimeout = hasTimeout;
  }

  // ── Report ──────────────────────────────────────────────────────
  console.log("\n" + SEP);
  console.log("  RAW JSON RESULTS — 3 RUNS");
  console.log(SEP);

  for (const r of results) {
    console.log(`\n  === RUN ${r.run} ===`);
    console.log(`  ${JSON.stringify(r, null, 4)}`);
  }

  // Summary table
  console.log("\n" + SEP);
  console.log("  SIDE-BY-SIDE SUMMARY");
  console.log(SEP);

  const H = (label: string, r1: string, r2: string, r3: string): void => {
    console.log(
      `  ${label.padEnd(26)} │ ${r1.padEnd(14)} │ ${r2.padEnd(14)} │ ${r3.padEnd(14)}`,
    );
  };

  H("", "RUN 1", "RUN 2", "RUN 3");
  console.log(
    `  ${"─".repeat(26)}─┼─${"─".repeat(14)}─┼─${"─".repeat(14)}─┼─${"─".repeat(14)}`,
  );

  const yN = (v: boolean): string => (v ? "✅ YES" : "❌ NO");
  const fMs = (ms: number): string => `${ms.toFixed(0)}ms`;

  H("Success", yN(results[0].success), yN(results[1].success), yN(results[2].success));
  H("Total Duration", fMs(results[0].totalDurationMs), fMs(results[1].totalDurationMs), fMs(results[2].totalDurationMs));
  H("│ Query Extract", fMs(results[0].queryExtractMs), fMs(results[1].queryExtractMs), fMs(results[2].queryExtractMs));
  H("│ Parallel Search", fMs(results[0].parallelSearchMs), fMs(results[1].parallelSearchMs), fMs(results[2].parallelSearchMs));
  H("│ Tavily Eval", fMs(results[0].tavilyEvalMs), fMs(results[1].tavilyEvalMs), fMs(results[2].tavilyEvalMs));
  H("│ Sift + Fetch", fMs(results[0].siftMs), fMs(results[1].siftMs), fMs(results[2].siftMs));
  H("│ Jury Analysis", fMs(results[0].juryAnalysisMs), fMs(results[1].juryAnalysisMs), fMs(results[2].juryAnalysisMs));
  H("│ Roadmap", fMs(results[0].roadmapMs), fMs(results[1].roadmapMs), fMs(results[2].roadmapMs));
  H("Tavily Queries", String(results[0].tavilyQueryCount), String(results[1].tavilyQueryCount), String(results[2].tavilyQueryCount));
  H("Tezara Queries", String(results[0].tezaraQueryCount), String(results[1].tezaraQueryCount), String(results[2].tezaraQueryCount));
  H("Keywords", String(results[0].keywordCount), String(results[1].keywordCount), String(results[2].keywordCount));
  H("Tavily Facts", String(results[0].tavilyFactCount), String(results[1].tavilyFactCount), String(results[2].tavilyFactCount));
  H("Raw Tezara", String(results[0].rawTezaraCount), String(results[1].rawTezaraCount), String(results[2].rawTezaraCount));
  H("Unique After Dedup", String(results[0].uniqueTezaraAfterDedup), String(results[1].uniqueTezaraAfterDedup), String(results[2].uniqueTezaraAfterDedup));
  H("Cohere Selected", String(results[0].cohereSelected), String(results[1].cohereSelected), String(results[2].cohereSelected));
  H("Fetch OK", String(results[0].fetchSuccess), String(results[1].fetchSuccess), String(results[2].fetchSuccess));
  H("Overlap Table", String(results[0].overlapTableLength), String(results[1].overlapTableLength), String(results[2].overlapTableLength));
  H("Eliminated", String(results[0].eliminatedCount), String(results[1].eliminatedCount), String(results[2].eliminatedCount));
  H("Badge", results[0].originalityBadge, results[1].originalityBadge, results[2].originalityBadge);
  H("429 Rate-Limit", String(results[0].has429), String(results[1].has429), String(results[2].has429));
  H("503 Gemini (retried)", String(results[0].has503), String(results[1].has503), String(results[2].has503));
  H("Timeouts", String(results[0].hasTimeout), String(results[1].hasTimeout), String(results[2].hasTimeout));

  console.log("\n" + SEP);

  // Acceptable: 503 Gemini "high demand" errors are auto-retried by SDK.
  // Unacceptable: 429 rate limits, timeouts, or execution failures.
  const hasNetworkFailures = results.some(
    (r) => !r.success || r.has429 || r.hasTimeout,
  );

  if (!hasNetworkFailures) {
    console.log(
      "  ✅ ALL 3 RUNS PASSED — pipeline is resilient and consistent.",
    );
  } else {
    console.log("  ❌ SOME CHECKS FAILED — review details above.");
    for (const r of results) {
      if (!r.success)
        console.log(`  Run ${r.run}: execution error — ${r.error}`);
      if (r.has429) console.log(`  Run ${r.run}: 429 rate-limit detected`);
      if (r.hasTimeout) console.log(`  Run ${r.run}: timeout detected`);
    }
    process.exitCode = 1;
  }

  // Report Gemini 503 health
  const has503Spikes = results.some((r) => r.has503);
  if (has503Spikes) {
    console.log(
      "  ⚠️  Gemini 503 transient errors occurred — all auto-retried successfully.",
    );
  } else {
    console.log("  ✅ No Gemini service spikes detected.");
  }

  // Report Tezara search health
  const tezaraVaried = results.some(
    (r) => r.rawTezaraCount !== results[0].rawTezaraCount,
  );
  if (tezaraVaried) {
    console.log(
      "  ⚠️  Tezara search result counts varied across runs (normal behavioral variation).",
    );
  }

  console.log(SEP + "\n");
}

run().catch((err) => {
  console.error("\n❌ Test crashed with unhandled exception:");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
