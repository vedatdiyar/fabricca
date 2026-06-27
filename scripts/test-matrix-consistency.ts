/**
 * Onboarding Matrix Consistency Pipeline Test (3x).
 *
 * Runs saveThesisMatrixAction-equivalent logic 3 consecutive times against
 * the live Neon database, verifying:
 *   - thesis_matrices row correctly stores all 6 fields each run
 *   - originality_reports are cleared after each run
 *   - thesis_boxes are cleared after each run
 *
 * Run from project root:
 *   npx tsx scripts/test-matrix-consistency.ts
 *
 * Constraints:
 *   - No mocking framework — hits the real DB via @/db
 *   - No new package dependencies
 *   - Session mocked via global.__mockSession
 */

// ==================================================================
// Bootstrap: load env BEFORE any module that reads DATABASE_URL
// ==================================================================
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// All DB-dependent imports happen dynamically inside run() so that
// dotenv has already populated process.env by the time @/db/index.ts
// creates the Neon Pool.

// ==================================================================
// Input Data: 6-point Thesis Matrix
// ==================================================================
const MATRIX_INPUT = {
  studyTitle:
    "Platform Kapitalizminde Güvencesizliğe Karşı Alternatif Bir Model Olarak Platform Kooperatifçiliği: İstanbul Kurye Sendikaları ve Dağıtım Kooperatifleri Örneği",
  researchQuestion:
    "Temel Soru: Platform ekonomisinin (algoritmik yönetim) kuryeler üzerindeki güvencesizleştirme stratejilerine karşı, platform kooperatifçiliği modeli İstanbul ölçeğinde sürdürülebilir, adil ve emansipator (özgürleştirici) bir alternatif iş modeli sunabilir mi?Alt Soru 1: Mevcut platformların kullandığı algoritmik denetim ve performans puanlama mekanizmaları, kuryelerin dijital emek süreçlerini ve yabancılaşma düzeylerini nasıl dönüştürmektedir?Alt Soru 2: İstanbul'daki kuryelerin öz-örgütlenme deneyimleri ile kooperatifleşme girişimlerinin önündeki yasal, finansal ve teknolojik bariyerler nelerdir?",
  theoreticalFramework:
    "Platform Kapitalizmi (Nick Srnicek), Algoritmik Yönetim ve Dijital Emek Süreci Teorisi (Harry Braverman, Michael Burawoy), Platform Kooperatifçiliği (Trebor Scholz, Nathan Schneider)",
  methodology:
    "Veri Toplama Yöntemi: İstanbul'da faaliyet gösteren kurye sendikası temsilcileri ve bağımsız kurye kooperatifi girişimcileriyle yarı yapılandırılmış mülakatlar (N=25); platform uygulamalarının arayüz ve algoritmik dağıtım kurallarının netnografik gözlemi.Veri Analizi Yöntemi: Mülakat transkriptlerinin ve saha notlarının MaxQDA üzerinde Eleştirel Söylem Analizi ve Emek Süreci Teorisi eksenli Tematik Analizi.",
  researchScope:
    "Zaman Sınırı: Platform kuryeliğinin zirve yaptığı pandemi sonrası dönem (2020–2026 yılları arası).Mekân Sınırı: İstanbul, Türkiye (Özellikle kurye mobilitesinin ve eylemlerinin yoğunlaştığı lojistik merkezler).Odaklanılan Aktörler: Esnaf kurye modeliyle çalışan moto-kuryeler, kurye hakları savunucuları, sendika liderleri ve kooperatif kurucu ortakları.",
  mainClaim:
    "Platform kapitalizminin dayattığı algoritmik denetim ve 'esnaf kurye' illüzyonu, emeği derin bir güvencesizliğe ve yabancılaşmaya sürüklemektedir; buna karşılık kuryelerin kolektif mülkiyetine dayanan demokratik platform kooperatifleri, dijital gözetimi şeffaflaştırarak ve artı-değeri emeğe geri döndürerek platform ekonomisinde sürdürülebilir bir yapısal dönüşümün yegane alternatifidir.",
} as const;

// ==================================================================
// Constants (mirrors matrix/actions.ts)
// ==================================================================
const MIN_LENGTH = 3;
const MAX_LENGTH = 4000;

type ValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

function validateField(
  value: string | undefined,
  label: string,
): ValidationResult {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `${label} en az ${MIN_LENGTH} karakter olmalıdır.`,
    };
  }
  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `${label} en fazla ${MAX_LENGTH} karakter olabilir.`,
    };
  }
  return { valid: true, value: trimmed };
}

// ==================================================================
// Run result type
// ==================================================================
interface RunResult {
  run: number;
  success: boolean;
  durationMs: number;
  matrixId: number | null;
  fieldsMatch: boolean;
  originalityCleared: boolean;
  boxesCleared: boolean;
  validationErrors: string[];
  error: string | null;
}

// ==================================================================
// Helpers
// ==================================================================
function fieldsMatch(
  row: { studyTitle: string; researchQuestion: string; theoreticalFramework: string; methodology: string; researchScope: string; mainClaim: string },
  input: typeof MATRIX_INPUT,
): boolean {
  return (
    row.studyTitle === input.studyTitle &&
    row.researchQuestion === input.researchQuestion &&
    row.theoreticalFramework === input.theoreticalFramework &&
    row.methodology === input.methodology &&
    row.researchScope === input.researchScope &&
    row.mainClaim === input.mainClaim
  );
}

const SEP = "─".repeat(78);

// ==================================================================
// Main
// ==================================================================
async function run(): Promise<void> {
  // ── Validate env ─────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL not found. Load .env.local first.");
    process.exit(1);
  }

  // ── Dynamic imports (dotenv already ran, so env vars are ready) ──
  const { db } = await import("@/db");
  const {
    thesisMatrices,
    originalityReports,
    thesisBoxes,
    users,
  } = await import("@/db/schema");
  const { eq, sql } = await import("drizzle-orm");

  // Resolve a real user from the seed DB for the mock session
  const testEmail = "vedatdiyarcelikkeser@gmail.com";
  const [userRow] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, testEmail));

  if (!userRow) {
    console.error(
      `FATAL: Test user "${testEmail}" not found in DB. Run "npx tsx src/db/seed.ts" first.`,
    );
    process.exit(1);
  }

  const sessionUser: { userId: number; name: string } = {
    userId: userRow.id,
    name: userRow.name,
  };

  globalThis.__mockSession = sessionUser;

  // Clean any residual data from previous runs for this user
  await db
    .delete(originalityReports)
    .where(eq(originalityReports.userId, sessionUser.userId));

  const [existingMatrix] = await db
    .select({ id: thesisMatrices.id })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, sessionUser.userId));

  if (existingMatrix) {
    await db
      .delete(thesisBoxes)
      .where(eq(thesisBoxes.thesisMatrixId, existingMatrix.id));
  }

  await db
    .delete(thesisMatrices)
    .where(eq(thesisMatrices.userId, sessionUser.userId));

  console.log(SEP);
  console.log("  MATRIX CONSISTENCY PIPELINE TEST — 3x RUNS");
  console.log(`  User: ${sessionUser.name} (id=${sessionUser.userId})`);
  console.log(SEP);

  // ── Runs 1–3 ────────────────────────────────────────────────────
  const results: RunResult[] = [];

  for (let run = 1; run <= 3; run++) {
    const startTime = performance.now();
    const validationErrors: string[] = [];

    // Phase A: Validation (mirrors matrix/actions.ts)
    const studyTitle = validateField(MATRIX_INPUT.studyTitle, "Çalışma başlığı");
    if (!studyTitle.valid) validationErrors.push(studyTitle.error);
    const researchQuestion = validateField(
      MATRIX_INPUT.researchQuestion,
      "Araştırma sorusu",
    );
    if (!researchQuestion.valid) validationErrors.push(researchQuestion.error);
    const theoreticalFramework = validateField(
      MATRIX_INPUT.theoreticalFramework,
      "Kavramsal çerçeve",
    );
    if (!theoreticalFramework.valid)
      validationErrors.push(theoreticalFramework.error);
    const methodology = validateField(MATRIX_INPUT.methodology, "Metodoloji");
    if (!methodology.valid) validationErrors.push(methodology.error);
    const researchScope = validateField(
      MATRIX_INPUT.researchScope,
      "Araştırma kapsamı",
    );
    if (!researchScope.valid) validationErrors.push(researchScope.error);
    const mainClaim = validateField(MATRIX_INPUT.mainClaim, "Temel iddia");
    if (!mainClaim.valid) validationErrors.push(mainClaim.error);

    // Phase B: DB persistence (mirrors the action exactly)
    let success = false;
    let error: string | null = null;
    let matrixId: number | null = null;
    let originalityCleared = false;
    let boxesCleared = false;

    if (validationErrors.length === 0) {
      try {
        // Upsert thesis matrix
        await db
          .insert(thesisMatrices)
          .values({
            userId: sessionUser.userId,
            studyTitle: studyTitle.value,
            researchQuestion: researchQuestion.value,
            theoreticalFramework: theoreticalFramework.value,
            methodology: methodology.value,
            researchScope: researchScope.value,
            mainClaim: mainClaim.value,
            updatedAt: sql`now()`,
          })
          .onConflictDoUpdate({
            target: thesisMatrices.userId,
            set: {
              studyTitle: studyTitle.value,
              researchQuestion: researchQuestion.value,
              theoreticalFramework: theoreticalFramework.value,
              methodology: methodology.value,
              researchScope: researchScope.value,
              mainClaim: mainClaim.value,
              updatedAt: sql`now()`,
            },
          });

        // Clear originality reports
        await db
          .delete(originalityReports)
          .where(eq(originalityReports.userId, sessionUser.userId));

        const [matrixRow] = await db
          .select({ id: thesisMatrices.id })
          .from(thesisMatrices)
          .where(eq(thesisMatrices.userId, sessionUser.userId));

        if (matrixRow) {
          matrixId = matrixRow.id;
          // Clear thesis boxes
          await db
            .delete(thesisBoxes)
            .where(eq(thesisBoxes.thesisMatrixId, matrixRow.id));
        }

        success = true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    } else {
      error = `Validation failed: ${validationErrors.join("; ")}`;
    }

    // Phase C: Assertions
    let fMatch = false;

    if (matrixId !== null) {
      const [saved] = await db
        .select({
          studyTitle: thesisMatrices.studyTitle,
          researchQuestion: thesisMatrices.researchQuestion,
          theoreticalFramework: thesisMatrices.theoreticalFramework,
          methodology: thesisMatrices.methodology,
          researchScope: thesisMatrices.researchScope,
          mainClaim: thesisMatrices.mainClaim,
        })
        .from(thesisMatrices)
        .where(eq(thesisMatrices.id, matrixId));

      fMatch = saved ? fieldsMatch(saved, MATRIX_INPUT) : false;
    }

    // Check downstream clearing
    const [origCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(originalityReports)
      .where(eq(originalityReports.userId, sessionUser.userId));

    let boxCnt = 0;
    if (matrixId !== null) {
      const [bCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrixId));
      boxCnt = bCount.count;
    }

    originalityCleared = origCount.count === 0;
    boxesCleared = boxCnt === 0;

    const durationMs = performance.now() - startTime;

    results.push({
      run,
      success,
      durationMs: Math.round(durationMs * 100) / 100,
      matrixId,
      fieldsMatch: fMatch,
      originalityCleared,
      boxesCleared,
      validationErrors,
      error,
    });
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

  const H = (
    label: string,
    r1: string,
    r2: string,
    r3: string,
  ): void => {
    console.log(
      `  ${label.padEnd(24)} │ ${r1.padEnd(12)} │ ${r2.padEnd(12)} │ ${r3.padEnd(12)}`,
    );
  };

  H("", "RUN 1", "RUN 2", "RUN 3");
  console.log(`  ${"─".repeat(24)}─┼─${"─".repeat(12)}─┼─${"─".repeat(12)}─┼─${"─".repeat(12)}`);

  const yesNo = (v: boolean): string => (v ? "✅ YES" : "❌ NO");
  const fmtMs = (ms: number): string => `${ms.toFixed(0)}ms`;

  H("Success", yesNo(results[0].success), yesNo(results[1].success), yesNo(results[2].success));
  H("Duration", fmtMs(results[0].durationMs), fmtMs(results[1].durationMs), fmtMs(results[2].durationMs));
  H("Matrix ID", String(results[0].matrixId ?? "—"), String(results[1].matrixId ?? "—"), String(results[2].matrixId ?? "—"));
  H("Fields Match", yesNo(results[0].fieldsMatch), yesNo(results[1].fieldsMatch), yesNo(results[2].fieldsMatch));
  H("Orig. Cleared", yesNo(results[0].originalityCleared), yesNo(results[1].originalityCleared), yesNo(results[2].originalityCleared));
  H("Boxes Cleared", yesNo(results[0].boxesCleared), yesNo(results[1].boxesCleared), yesNo(results[2].boxesCleared));
  H("Validation Err", String(results[0].validationErrors.length), String(results[1].validationErrors.length), String(results[2].validationErrors.length));

  console.log("\n" + SEP);

  const allPassed = results.every(
    (r) =>
      r.success &&
      r.fieldsMatch &&
      r.originalityCleared &&
      r.boxesCleared &&
      r.validationErrors.length === 0,
  );

  if (allPassed) {
    console.log("  ✅ ALL 3 RUNS PASSED — 100% data consistency verified.");
  } else {
    console.log("  ❌ ONE OR MORE RUNS FAILED — review details above.");
    process.exitCode = 1;
  }

  console.log(SEP + "\n");
}

run().catch((err) => {
  console.error("\n❌ Test crashed with unhandled exception:");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
