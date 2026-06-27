/**
 * BADGE VARIANCE DIAGNOSTIC — Cohere vs Gemini Isolation.
 *
 * Pinpoints whether the badge shift (IKIZ → SINIRDAS) and overlap-table
 * drop (9→8) originate from:
 *
 *   1. Cohere Rerank     — does the Top-20 thesis ID list change?
 *   2. Gemini Jury        — does the raw LLM scorecard flip booleans?
 *
 * Run:
 *   npx tsx scripts/diagnostic-badge-variance.ts
 *
 * Phase A: 3 independent siftAndFetchDetails → print Top-20 IDs
 * Phase B: Feed the FIXED 20 theses (from Phase A Run 1) into
 *          analyzeOriginalityRisk 3× → print per-thesis raw scorecards
 *          and cross-run comparison.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createFlowId, Logger } from "@/lib/logger";
import { siftAndFetchDetails } from "@/app/(auth)/onboarding/risk/_services/sifting";
import {
  analyzeOriginalityRisk,
  calculateOriginalityRisk,
} from "@/app/(auth)/onboarding/risk/_services/analysis";
import { extractQueries } from "@/app/(auth)/onboarding/risk/_services/queries";
import { executeParallelSearch } from "@/app/(auth)/onboarding/risk/_services/search";
import type { TezaraThesisSummary, TezaraThesisDetails } from "@/lib/types";

// ==================================================================
// Helpers
// ==================================================================
const SEP = "─".repeat(78);

/** Quiet a logger instance so JSON noise doesn't drown diagnostic output. */
function quietLog(_flowId: string): Logger {
  const l = new Logger(_flowId);
  l.info = () => {};
  l.warn = () => {};
  l.error = () => {};
  l.step = () => {};
  l.file = () => {};
  l.data = () => {};
  l.preview = () => {};
  l.prompt = () => {};
  l.saveDebugPayload = () => undefined;
  return l;
}

// ==================================================================
// Main
// ==================================================================
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL not found in .env.local");
    process.exit(1);
  }

  const { db } = await import("@/db");
  const { thesisMatrices } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  // Load matrix
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.id, 3));

  if (!matrix) {
    console.error("FATAL: Thesis Matrix ID=3 not found.");
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

  // ── Fetch Tezara results ONCE (fixed input for all sift runs) ──
  const fetchLog = quietLog(createFlowId());
  const extracted = await extractQueries(matrixInput, fetchLog);
  const { tezaraSearchResults: tezaraRaw } = await executeParallelSearch(
    extracted.tavilyQueries,
    extracted.tezaraQueries,
    fetchLog,
  );

  // ==================================================================
  // PHASE A — Cohere Isolation: 3× siftAndFetchDetails
  // ==================================================================

  console.log("\n" + SEP);
  console.log("  PHASE A — Cohere Rerank: 3× Independent Sift");
  console.log(SEP);

  type SiftRecord = {
    run: number;
    top20Ids: number[];
    stage1Count: number;
    fetchSuccess: number;
    fetchFailed: number;
    uniqueAfterDedup: number;
    theses20: { id: number; title: string; author: string; year: number }[];
    allDetails: TezaraThesisDetails[];
  };

  const siftRecords: SiftRecord[] = [];

  for (let run = 1; run <= 3; run++) {
    const log = quietLog(createFlowId());
    const { finalTheses, diagnostic } = await siftAndFetchDetails(
      matrixInput,
      tezaraRaw,
      log,
    );

    siftRecords.push({
      run,
      top20Ids: diagnostic.topIds,
      stage1Count: diagnostic.stage1Count,
      fetchSuccess: diagnostic.fetchSuccess,
      fetchFailed: diagnostic.fetchFailed,
      uniqueAfterDedup: diagnostic.uniqueAfterDedup,
      theses20: finalTheses.map((t) => ({
        id: t.id,
        title: t.title,
        author: t.author,
        year: t.year,
      })),
      allDetails: finalTheses,
    });

    console.log(`\n  [Run ${run}] Cohere Top-20 IDs:`);
    console.log(`    ${JSON.stringify(diagnostic.topIds)}`);
    console.log(
      `    Unique: ${diagnostic.uniqueAfterDedup} → Cohere: ${diagnostic.stage1Count} → Fetch OK: ${diagnostic.fetchSuccess} Failed: ${diagnostic.fetchFailed}`,
    );
  }

  // Phase A comparison
  const idsEq12 =
    JSON.stringify(siftRecords[0].top20Ids) ===
    JSON.stringify(siftRecords[1].top20Ids);
  const idsEq13 =
    JSON.stringify(siftRecords[0].top20Ids) ===
    JSON.stringify(siftRecords[2].top20Ids);

  console.log(`\n  Cohere ID consistency:`);
  console.log(`    Run1 vs Run2: ${idsEq12 ? "✅ IDENTICAL" : "❌ DIFFERENT"}`);
  console.log(`    Run1 vs Run3: ${idsEq13 ? "✅ IDENTICAL" : "❌ DIFFERENT"}`);

  if (!idsEq12 || !idsEq13) {
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const a = siftRecords[i].top20Ids;
        const b = siftRecords[j].top20Ids;
        const onlyInA = a.filter((id) => !b.includes(id));
        const onlyInB = b.filter((id) => !a.includes(id));
        if (onlyInA.length > 0 || onlyInB.length > 0) {
          console.log(`\n  Diff Run${i + 1} vs Run${j + 1}:`);
          console.log(`    Only in Run${i + 1}: [${onlyInA.join(", ")}]`);
          console.log(`    Only in Run${j + 1}: [${onlyInB.join(", ")}]`);
          for (const id of onlyInA) {
            const t = siftRecords[i].theses20.find((t) => t.id === id);
            if (t) console.log(`      id=${id} "${t.title.slice(0, 70)}" (${t.author}, ${t.year})`);
          }
          for (const id of onlyInB) {
            const t = siftRecords[j].theses20.find((t) => t.id === id);
            if (t) console.log(`      id=${id} "${t.title.slice(0, 70)}" (${t.author}, ${t.year})`);
          }
        }
      }
    }
  }

  // ==================================================================
  // PHASE B — Gemini Jury: 3× analyzeOriginalityRisk
  //            using the FIXED 20 theses from Run 1
  // ==================================================================

  console.log(`\n${SEP}`);
  console.log("  PHASE B — Gemini Jury: 3× analyzeOriginalityRisk");
  console.log("  (FIXED 20 theses — using Run 1 sift output)");
  console.log(SEP);

  const fixedDetails = siftRecords[0].allDetails;

  type GeminiEntry = {
    id: number;
    title: string;
    academic_reasoning: string;
    subject_scorecard?: Record<string, boolean>;
    subject_overlap: string;
    methodology_scorecard?: Record<string, boolean>;
    methodology_overlap: string;
    theory_scorecard?: Record<string, boolean>;
    theory_overlap: string;
    context_scorecard?: Record<string, boolean>;
    context_overlap: string;
  };

  type PhaseBRecord = {
    run: number;
    entries: GeminiEntry[];
    overlapTableLength: number;
    eliminatedCount: number;
    badge: string;
    eliminatedIds: number[];
  };

  const phaseBRecords: PhaseBRecord[] = [];

  for (let run = 1; run <= 3; run++) {
    const log = quietLog(createFlowId());

    const { overlapTable } = await analyzeOriginalityRisk(
      { ...matrixInput, validDetails: fixedDetails },
      log,
    );

    const riskCalc = calculateOriginalityRisk(
      overlapTable as any,
      fixedDetails,
    );

    const entries: GeminiEntry[] = overlapTable.map((item) => {
      const detail = fixedDetails.find((d) => d.id === item.id);
      return {
        id: item.id,
        title: detail?.title ?? "UNKNOWN",
        academic_reasoning: item.academic_reasoning,
        subject_scorecard: item.subject_scorecard,
        subject_overlap: item.subject_overlap,
        methodology_scorecard: item.methodology_scorecard,
        methodology_overlap: item.methodology_overlap,
        theory_scorecard: item.theory_scorecard,
        theory_overlap: item.theory_overlap,
        context_scorecard: item.context_scorecard,
        context_overlap: item.context_overlap,
      };
    });

    phaseBRecords.push({
      run,
      entries,
      overlapTableLength: riskCalc.overlapTable.length,
      eliminatedCount: riskCalc.eliminatedTheses.length,
      badge: riskCalc.originalityBadge,
      eliminatedIds: riskCalc.eliminatedTheses.map((t) => t.id),
    });

    console.log(`\n  [Run ${run}] Badge: ${riskCalc.originalityBadge}`);
    console.log(
      `    Overlap: ${riskCalc.overlapTable.length} | Eliminated: ${riskCalc.eliminatedTheses.length} ${riskCalc.eliminatedTheses.length > 0 ? `(IDs: [${riskCalc.eliminatedTheses.map((t) => t.id).join(", ")}])` : ""}`,
    );

    for (const th of entries) {
      console.log(`\n    [${th.id}] ${th.title.slice(0, 55)}...`);
      console.log(`      subj=${th.subject_overlap} sc=${JSON.stringify(th.subject_scorecard)}`);
      console.log(`      theo=${th.theory_overlap} sc=${JSON.stringify(th.theory_scorecard)}`);
      console.log(`      meth=${th.methodology_overlap} sc=${JSON.stringify(th.methodology_scorecard)}`);
      console.log(`      ctx=${th.context_overlap} sc=${JSON.stringify(th.context_scorecard)}`);
      console.log(`      reason=${(th.academic_reasoning ?? "").slice(0, 120)}`);
    }
  }

  // ==================================================================
  // Phase B — Cross-Run Mutation Detection
  // ==================================================================

  console.log(`\n${SEP}`);
  console.log("  PHASE B — CROSS-RUN MUTATION ANALYSIS");
  console.log(SEP);

  const allThesisIds = Array.from(
    new Set(phaseBRecords.flatMap((r) => r.entries.map((e) => e.id))),
  );

  let totalMutations = 0;
  const eliminatedSets = phaseBRecords.map((r) => new Set(r.eliminatedIds));

  for (const thesisId of allThesisIds) {
    const entries = phaseBRecords.map((r) =>
      r.entries.find((e) => e.id === thesisId),
    );
    const presentCount = entries.filter(Boolean).length;

    if (presentCount < 3) {
      console.log(
        `\n  ⚠️  Thesis ${thesisId} — present in ${presentCount}/3 runs`,
      );
      for (let i = 0; i < 3; i++) {
        if (entries[i]) {
          console.log(`      Run${i + 1}: subj=${entries[i]!.subject_overlap} theo=${entries[i]!.theory_overlap} meth=${entries[i]!.methodology_overlap} ctx=${entries[i]!.context_overlap}`);
        } else {
          const isElim = eliminatedSets[i].has(thesisId);
          console.log(`      Run${i + 1}: NOT in overlap table ${isElim ? "(eliminated by calculateOriginalityRisk)" : "(not returned by Gemini)"}`);
        }
      }
      totalMutations++;
      continue;
    }

    // Compare full scorecard hashes across all 3 runs
    const ref = entries[0]!;
    let thesisMutated = false;

    for (let run = 1; run < 3; run++) {
      const cur = entries[run]!;

      const hash = (e: GeminiEntry): string =>
        JSON.stringify({
          subj: `${e.subject_overlap}|${JSON.stringify(e.subject_scorecard)}`,
          theo: `${e.theory_overlap}|${JSON.stringify(e.theory_scorecard)}`,
          meth: `${e.methodology_overlap}|${JSON.stringify(e.methodology_scorecard)}`,
          ctx: `${e.context_overlap}|${JSON.stringify(e.context_scorecard)}`,
          reason: e.academic_reasoning,
        });

      if (hash(ref) !== hash(cur)) {
        thesisMutated = true;
        console.log(`\n  ❌ Thesis ${thesisId} — MUTATED in Run ${run + 1}`);
        console.log(`      Title: ${ref.title.slice(0, 60)}`);
        console.log(`      Run1: subj=${ref.subject_overlap} theo=${ref.theory_overlap} meth=${ref.methodology_overlap} ctx=${ref.context_overlap}`);
        console.log(`      Run${run + 1}: subj=${cur.subject_overlap} theo=${cur.theory_overlap} meth=${cur.methodology_overlap} ctx=${cur.context_overlap}`);
        console.log(`      Run1 scorecards:`);
        console.log(`        subject:     ${JSON.stringify(ref.subject_scorecard)}`);
        console.log(`        theory:       ${JSON.stringify(ref.theory_scorecard)}`);
        console.log(`        methodology: ${JSON.stringify(ref.methodology_scorecard)}`);
        console.log(`        context:      ${JSON.stringify(ref.context_scorecard)}`);
        console.log(`      Run${run + 1} scorecards:`);
        console.log(`        subject:     ${JSON.stringify(cur.subject_scorecard)}`);
        console.log(`        theory:       ${JSON.stringify(cur.theory_scorecard)}`);
        console.log(`        methodology: ${JSON.stringify(cur.methodology_scorecard)}`);
        console.log(`        context:      ${JSON.stringify(cur.context_scorecard)}`);
        console.log(`      Run1 reasoning:  ${(ref.academic_reasoning ?? "").slice(0, 200)}`);
        console.log(`      Run${run + 1} reasoning:  ${(cur.academic_reasoning ?? "").slice(0, 200)}`);
      }
    }

    if (!thesisMutated) {
      console.log(`  ✅ Thesis ${thesisId} — scorecards identical across all 3 runs`);
    }
  }

  // ==================================================================
  // FINAL VERDICT
  // ==================================================================

  console.log(`\n${SEP}`);
  console.log("  DIAGNOSTIC SUMMARY");
  console.log(SEP);

  const badges = phaseBRecords.map((r) => r.badge);
  const uniqueB = [...new Set(badges)];

  console.log(`\n  Phase A — Cohere Top-20 ID consistency:`);
  console.log(`    Run1 vs Run2: ${idsEq12 ? "IDENTICAL" : "DIFFERENT"}`);
  console.log(`    Run1 vs Run3: ${idsEq13 ? "IDENTICAL" : "DIFFERENT"}`);

  if (!idsEq12 || !idsEq13) {
    console.log(`  ⚠️  Cohere variance detected — different thesis pools fed to Gemini`);
  } else {
    console.log(`  ✅ Cohere stable — all runs selected the same 20 theses`);
  }

  console.log(`\n  Phase B — Gemini Scorecard:`);
  console.log(`    Mutated theses: ${totalMutations} / ${allThesisIds.length} total`);
  console.log(`    Badges across runs: ${badges.join(" → ")}`);

  if (uniqueB.length === 1) {
    console.log(`    Badge: consistent (${uniqueB[0]})`);
  } else {
    console.log(`    Badge: VARIED (${badges.join(" → ")})`);
  }

  // Root cause
  const cohereVaries = !idsEq12 || !idsEq13;
  const geminiMutates = totalMutations > 0;

  console.log(`\n  ROOT CAUSE:`);
  if (cohereVaries && geminiMutates) {
    console.log("    BOTH Cohere AND Gemini contribute to variance.");
  } else if (cohereVaries) {
    console.log("    Cohere Rerank is the sole source of variance.");
  } else if (geminiMutates) {
    console.log("    Gemini Jury (despite seed=42) is the sole source of variance.");
  } else {
    console.log("    NO variance detected in this run set — rerun for more data.");
  }

  console.log(`\n${SEP}\n`);
}

main().catch((err) => {
  console.error("\n❌ Diagnostic crashed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
