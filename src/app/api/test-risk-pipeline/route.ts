import { NextResponse } from "next/server";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { originalityReports, thesisMatrices } from "@/db/schema";
import {
  extractQueriesAction,
  executeSearchAndSiftAction,
  finalizeJuryAnalysisAction,
} from "@/app/(onboarding)/onboarding/risk/actions";
import type {
  TezaraThesisDetails,
  OriginalityReportData,
  ThesisMatrix,
} from "@/lib/types";

export const maxDuration = 900;

const USER_ID = 1;
const MOCK_SESSION = { userId: USER_ID, name: "Vedat Diyar Çelikkeser" };

// ──────────────────────────────────────────────
// Comparison helpers
// ──────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || a === undefined || b === undefined)
    return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keysA = Object.keys(aObj).sort();
  const keysB = Object.keys(bObj).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (!deepEqual(aObj[keysA[i]], bObj[keysB[i]])) return false;
  }
  return true;
}

function findDifferences(a: unknown, b: unknown, path = ""): string[] {
  const diffs: string[] = [];
  if (Object.is(a, b)) return diffs;
  if (a === null || b === null || a === undefined || b === undefined) {
    diffs.push(`${path}: ${a} vs ${b}`);
    return diffs;
  }
  if (typeof a !== typeof b) {
    diffs.push(`${path}: type mismatch (${typeof a} vs ${typeof b})`);
    return diffs;
  }
  if (typeof a !== "object") {
    if (a !== b) diffs.push(`${path}: ${a} vs ${b}`);
    return diffs;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      diffs.push(`${path}: array length ${a.length} vs ${b.length}`);
    }
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      diffs.push(...findDifferences(a[i], b[i], `${path}[${i}]`));
    }
    return diffs;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
  for (const key of allKeys) {
    if (!(key in aObj)) {
      diffs.push(`${path}.${key}: missing in A`);
      continue;
    }
    if (!(key in bObj)) {
      diffs.push(`${path}.${key}: missing in B`);
      continue;
    }
    diffs.push(...findDifferences(aObj[key], bObj[key], `${path}.${key}`));
  }
  return diffs;
}

function truncateJson(obj: unknown, maxLen = 600): string {
  const str = JSON.stringify(obj, null, 2);
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + "\n... (truncated)";
}

// ──────────────────────────────────────────────
// Run the full pipeline
// ──────────────────────────────────────────────

interface Step1Out {
  tezaraQueries: string[];
  cohereSemanticTarget: string;
}
interface Step2Out {
  selected: TezaraThesisDetails[];
  eliminated: TezaraThesisDetails[];
}
interface Step3Out {
  reportData: OriginalityReportData | null;
}

interface RunSnapshot {
  run: number;
  step1: { ok: true; data: Step1Out } | { ok: false; error: string };
  step2: { ok: true; data: Step2Out } | { ok: false; error: string };
  step3: { ok: true; data: Step3Out } | { ok: false; error: string };
  dbRows: Record<string, unknown>[];
}

async function runPipeline(
  matrix: ThesisMatrix,
  runNum: number,
): Promise<RunSnapshot> {
  // Step 1
  let step1: RunSnapshot["step1"];
  try {
    const res = await extractQueriesAction(matrix);
    if ("error" in res) {
      step1 = { ok: false, error: res.error };
    } else {
      step1 = {
        ok: true,
        data: {
          tezaraQueries: res.data.tezaraQueries,
          cohereSemanticTarget: res.data.cohereSemanticTarget,
        },
      };
    }
  } catch (err) {
    step1 = { ok: false, error: String(err) };
  }

  // Step 2 (needs step 1 data)
  let step2: RunSnapshot["step2"];
  if (step1.ok) {
    try {
      const res = await executeSearchAndSiftAction({
        matrix,
        tezaraQueries: step1.data.tezaraQueries,
      });
      if ("error" in res) {
        step2 = { ok: false, error: res.error };
      } else {
        step2 = {
          ok: true,
          data: {
            selected: res.data.selected,
            eliminated: res.data.eliminated,
          },
        };
      }
    } catch (err) {
      step2 = { ok: false, error: String(err) };
    }
  } else {
    step2 = { ok: false, error: "Skipped due to step1 failure" };
  }

  // Step 3 (needs step 2 data)
  let step3: RunSnapshot["step3"];
  if (step2.ok && step2.data.selected.length > 0) {
    try {
      const res = await finalizeJuryAnalysisAction({
        matrix,
        selectedTheses: step2.data.selected,
      });
      if ("error" in res) {
        step3 = { ok: false, error: res.error };
      } else {
        step3 = { ok: true, data: { reportData: res.data } };
      }
    } catch (err) {
      step3 = { ok: false, error: String(err) };
    }
  } else if (step2.ok) {
    // No theses selected
    try {
      const res = await finalizeJuryAnalysisAction({
        matrix,
        selectedTheses: [],
      });
      if ("error" in res) {
        step3 = { ok: false, error: res.error };
      } else {
        step3 = { ok: true, data: { reportData: res.data } };
      }
    } catch (err) {
      step3 = { ok: false, error: String(err) };
    }
  } else {
    step3 = { ok: false, error: "Skipped due to step2 failure" };
  }

  // Read DB rows
  const rows = await db
    .select()
    .from(originalityReports)
    .where(eq(originalityReports.userId, USER_ID));

  const cleanedRows = rows.map((r) => {
    const { id, createdAt, updatedAt, userId, ...rest } = r;
    void id;
    void createdAt;
    void updatedAt;
    void userId;
    return rest as unknown as Record<string, unknown>;
  });

  return {
    run: runNum,
    step1,
    step2,
    step3,
    dbRows: cleanedRows,
  };
}

// ──────────────────────────────────────────────
// Comparison logic
// ──────────────────────────────────────────────

interface ComparisonReport {
  step1: { match: boolean; diffs: string[]; tolerance: string };
  step2: { match: boolean; diffs: string[]; tolerance: string };
  step3: { match: boolean; diffs: string[]; tolerance: string };
  db: { match: boolean; diffs: string[] };
  overall: boolean;
}

function compareRuns(runs: RunSnapshot[]): ComparisonReport {
  // Step 1 comparison
  const step1Diffs: string[] = [];
  for (let i = 1; i < runs.length; i++) {
    const p = runs[i - 1].step1;
    const c = runs[i].step1;
    if (!p.ok || !c.ok) {
      step1Diffs.push(`Run ${i} vs ${i + 1}: step1 error mismatch`);
      continue;
    }
    step1Diffs.push(
      ...findDifferences(
        p.data.tezaraQueries,
        c.data.tezaraQueries,
        `tezaraQueries`,
      ),
    );
    step1Diffs.push(
      ...findDifferences(
        p.data.cohereSemanticTarget,
        c.data.cohereSemanticTarget,
        `cohereSemanticTarget`,
      ),
    );
  }

  // Step 2 comparison + tolerance
  const step2Diffs: string[] = [];
  const toleranceNotes: string[] = [];
  for (let i = 1; i < runs.length; i++) {
    const p = runs[i - 1].step2;
    const c = runs[i].step2;
    if (!p.ok || !c.ok) {
      step2Diffs.push(`Run ${i} vs ${i + 1}: step2 error mismatch`);
      continue;
    }
    // Selected ID set
    const pSelIds = p.data.selected.map((t) => t.id).sort((a, b) => a - b);
    const cSelIds = c.data.selected.map((t) => t.id).sort((a, b) => a - b);
    step2Diffs.push(...findDifferences(pSelIds, cSelIds, `selectedIds`));
    // Eliminated ID set
    const pElimIds = p.data.eliminated.map((t) => t.id).sort((a, b) => a - b);
    const cElimIds = c.data.eliminated.map((t) => t.id).sort((a, b) => a - b);
    step2Diffs.push(...findDifferences(pElimIds, cElimIds, `eliminatedIds`));

    // Tolerance: count comparison
    toleranceNotes.push(
      `Run${i}: selected=${p.data.selected.length} eliminated=${p.data.eliminated.length}`,
    );
    toleranceNotes.push(
      `Run${i + 1}: selected=${c.data.selected.length} eliminated=${c.data.eliminated.length}`,
    );
    // Tolerance: Tezara raw volume (deduped count from selected+eliminated)
    const pTotal = p.data.selected.length + p.data.eliminated.length;
    const cTotal = c.data.selected.length + c.data.eliminated.length;
    toleranceNotes.push(
      `Run${i} vs ${i + 1}: total unique theses after dedup = ${pTotal} vs ${cTotal}`,
    );
  }

  // Step 3 comparison
  const step3Diffs: string[] = [];
  for (let i = 1; i < runs.length; i++) {
    const p = runs[i - 1].step3;
    const c = runs[i].step3;
    if (!p.ok || !c.ok) {
      step3Diffs.push(`Run ${i} vs ${i + 1}: step3 error mismatch`);
      continue;
    }
    step3Diffs.push(
      ...findDifferences(p.data.reportData, c.data.reportData, `reportData`),
    );
  }

  // DB comparison
  const dbDiffs: string[] = [];
  for (let i = 1; i < runs.length; i++) {
    const p = runs[i - 1].dbRows;
    const c = runs[i].dbRows;
    dbDiffs.push(...findDifferences(p, c, `dbRows`));
  }

  return {
    step1: {
      match: step1Diffs.length === 0,
      diffs: step1Diffs,
      tolerance:
        "Gemini seed=42 ile deterministic — ek tolerance ölçümü gerekmez",
    },
    step2: {
      match: step2Diffs.length === 0,
      diffs: step2Diffs,
      tolerance: toleranceNotes.join(" | "),
    },
    step3: {
      match: step3Diffs.length === 0,
      diffs: step3Diffs,
      tolerance:
        "Decision engine deterministic (seed=42). Cohere/Tezara tolerance step2 üzerinden ölçüldü.",
    },
    db: {
      match: dbDiffs.length === 0,
      diffs: dbDiffs,
    },
    overall:
      step1Diffs.length === 0 &&
      step2Diffs.length === 0 &&
      step3Diffs.length === 0 &&
      dbDiffs.length === 0,
  };
}

// ──────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────

export async function GET() {
  const startTime = Date.now();

  // Set mock session
  (globalThis as unknown as Record<string, unknown>).__mockSession =
    MOCK_SESSION;

  try {
    // Fetch thesis matrix from DB
    const [matrixRow] = await db
      .select()
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, USER_ID))
      .limit(1);

    if (!matrixRow) {
      return NextResponse.json(
        { error: `Thesis matrix not found for userId=${USER_ID}` },
        { status: 404 },
      );
    }

    const matrix: ThesisMatrix = {
      researchCore: matrixRow.researchCore,
      targetActors: matrixRow.targetActors,
      context: matrixRow.context,
      framework: matrixRow.framework,
      mainClaim: matrixRow.mainClaim,
    };

    const runs: RunSnapshot[] = [];

    for (let run = 1; run <= 3; run++) {
      // Clear DB before each run
      await db
        .delete(originalityReports)
        .where(eq(originalityReports.userId, USER_ID));

      console.log(`\n═══════════════════════════════════`);
      console.log(`  RISK PIPELINE TEST — RUN ${run}/3`);
      console.log(`═══════════════════════════════════\n`);

      const snapshot = await runPipeline(matrix, run);
      runs.push(snapshot);

      console.log(`Step1: ${snapshot.step1.ok ? "OK" : "FAIL"}`);
      if (snapshot.step1.ok) {
        console.log(
          `  Queries (${snapshot.step1.data.tezaraQueries.length}):`,
          snapshot.step1.data.tezaraQueries,
        );
        console.log(
          `  CohereTarget: ${snapshot.step1.data.cohereSemanticTarget.substring(0, 80)}...`,
        );
      } else {
        console.log(`  Error: ${snapshot.step1.error}`);
      }

      console.log(
        `Step2: ${snapshot.step2.ok ? `OK (${snapshot.step2.data.selected.length} selected, ${snapshot.step2.data.eliminated.length} eliminated)` : "FAIL"}`,
      );
      if (
        !snapshot.step2.ok &&
        snapshot.step2.error !== "Skipped due to step1 failure"
      ) {
        console.log(`  Error: ${snapshot.step2.error}`);
      }

      console.log(`Step3: ${snapshot.step3.ok ? "OK" : "FAIL"}`);
      if (snapshot.step3.ok && snapshot.step3.data.reportData) {
        const r = snapshot.step3.data.reportData.tezaraResults;
        console.log(
          `  Badge: ${r.relationshipBadge} | Overlap: ${r.overlapTable.length} | Eliminated: ${r.eliminatedTheses.length}`,
        );
      } else if (snapshot.step3.ok) {
        console.log(`  No report (null) — no matching theses`);
      } else if (snapshot.step3.error !== "Skipped due to step2 failure") {
        console.log(`  Error: ${snapshot.step3.error}`);
      }

      console.log(`DB rows after run: ${snapshot.dbRows.length}`);
    }

    // Compare runs
    const comparison = compareRuns(runs);
    const elapsed = Date.now() - startTime;

    // Build response
    const response = {
      testInfo: {
        userId: USER_ID,
        userName: "Vedat Diyar Çelikkeser",
        matrix: {
          researchCore: matrix.researchCore.substring(0, 100),
          targetActors: matrix.targetActors.substring(0, 100),
          context: matrix.context.substring(0, 100),
          framework: matrix.framework.substring(0, 100),
          mainClaim: matrix.mainClaim.substring(0, 100),
        },
        totalDurationMs: elapsed,
        runsCompleted: runs.length,
      },
      comparison,
      runs: runs.map((r) => ({
        run: r.run,
        step1: r.step1.ok
          ? {
              ok: true,
              tezaraQueries: r.step1.data.tezaraQueries,
              cohereSemanticTarget: r.step1.data.cohereSemanticTarget.substring(
                0,
                150,
              ),
            }
          : { ok: false, error: r.step1.error },
        step2: r.step2.ok
          ? {
              ok: true,
              selectedCount: r.step2.data.selected.length,
              selectedIds: r.step2.data.selected.map((t) => t.id),
              eliminatedCount: r.step2.data.eliminated.length,
              eliminatedIds: r.step2.data.eliminated.map((t) => t.id),
            }
          : { ok: false, error: r.step2.error },
        step3: r.step3.ok
          ? {
              ok: true,
              relationshipBadge:
                r.step3.data.reportData?.tezaraResults.relationshipBadge ??
                null,
              overlapCount:
                r.step3.data.reportData?.tezaraResults.overlapTable.length ?? 0,
              eliminatedAnalysisCount:
                r.step3.data.reportData?.tezaraResults.eliminatedTheses
                  .length ?? 0,
            }
          : { ok: false, error: r.step3.error },
        dbRowCount: r.dbRows.length,
      })),
      // Full detail for deep comparison
      detail: {
        step1: {
          allQueries: runs.map((r, i) =>
            r.step1.ok
              ? {
                  run: i + 1,
                  queries: r.step1.data.tezaraQueries,
                  target: r.step1.data.cohereSemanticTarget,
                }
              : { run: i + 1, error: r.step1.error },
          ),
        },
        step2: {
          allSelectedTheses: runs.map((r, i) =>
            r.step2.ok
              ? {
                  run: i + 1,
                  selected: r.step2.data.selected.map((t) => ({
                    id: t.id,
                    title: t.title.substring(0, 80),
                    author: t.author,
                  })),
                  eliminated: r.step2.data.eliminated.map((t) => ({
                    id: t.id,
                    title: t.title.substring(0, 80),
                  })),
                }
              : { run: i + 1, error: r.step2.error },
          ),
        },
        step3: {
          allReports: runs.map((r, i) =>
            r.step3.ok
              ? {
                  run: i + 1,
                  reportData: r.step3.data.reportData,
                }
              : { run: i + 1, error: r.step3.error },
          ),
        },
        dbRows: runs.map((r, i) => ({
          run: i + 1,
          rows: r.dbRows.map((row) => ({
            externalThesisId: row.externalThesisId,
            title: (row.title as string).substring(0, 60),
            originalityStatus: row.originalityStatus,
            isEliminated: row.isEliminated,
            eliminationStage: row.eliminationStage,
          })),
        })),
      },
    };

    console.log(`\n═══════════════════════════════════`);
    console.log(`  TEST COMPLETE — ${elapsed}ms`);
    console.log(`  Overall match: ${comparison.overall ? "YES ✓" : "NO ✗"}`);
    console.log(
      `  Step1: ${comparison.step1.match ? "✓" : "✗"} | Step2: ${comparison.step2.match ? "✓" : "✗"} | Step3: ${comparison.step3.match ? "✓" : "✗"} | DB: ${comparison.db.match ? "✓" : "✗"}`,
    );
    console.log(`═══════════════════════════════════\n`);

    return NextResponse.json(response);
  } catch (err) {
    console.error("Test pipeline failed:", err);
    return NextResponse.json(
      {
        error: "Test pipeline failed",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 },
    );
  } finally {
    // Clear mock session
    delete (globalThis as unknown as Record<string, unknown>).__mockSession;
  }
}
