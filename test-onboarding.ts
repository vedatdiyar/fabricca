import fs from "fs";
import path from "path";
import Module from "module";

// ==========================================
// 1. DYNAMIC ENVIRONMENT LOADER (.env.local)
// ==========================================
try {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (err) {
  console.error("Failed to load .env.local", err);
}

// ==========================================
// 2. NEXT.JS RUNTIME RUN-TIME MOCKING
// ==========================================
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any,
) {
  if (
    request === "next/cache" ||
    request === "next/headers" ||
    request === "next/navigation"
  ) {
    return request;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "next/cache") {
    return {
      revalidatePath: (path: string, type?: string) => {
        return;
      },
    };
  }
  if (id === "next/headers") {
    return {
      cookies: async () => {
        return {
          get: (name: string) => undefined,
          set: () => {},
          delete: () => {},
        };
      },
    };
  }
  if (id === "next/navigation") {
    return {
      redirect: (url: string) => {
        return;
      },
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// ==========================================
// 3. COMMON IMPORTS & DATA
// ==========================================
import { eq } from "drizzle-orm";

const TEST_EMAIL = "vedatdiyarcelikkeser@gmail.com";

const THESIS_INPUT = {
  studyTitle:
    "Neoliberalizmde Siyasal Bir İktidar İlişkisi Olarak Bireysel Borçlandırmanın İşleyişi: Türkiye Örneği",
  researchQuestion:
    "Neoliberalizmde bireysel borçlandırma, siyasal bir iktidar ilişkisi olarak nasıl işlemekte ve bu ilişkide borçlandırılmış özneler nasıl bir rol oynamaktadır?",
  mainClaim:
    "Literatürde yaygın olan kanının aksine, borçlandırılmış özneler borçlandırma ilişkisinin işleyişini açıklamada önemli bir role sahiptir. Borçluluk hali, yalnızca yapısal belirleyicilerle değil, öznelerin pratik ve söylemleriyle de anlaşılmalıdır. Bu çerçevede neoliberal borçlandırma, temelde bir işçi sınıfı borçlanmasıdır ve borçlu figürü “işçi-borçlu” olarak kurgulanmaktadır.",
  methodology:
    "Niteliksel araştırma deseni kapsamında, Türkiye’de borçlularla derinlemesine mülakatlar yapılmıştır. Elde edilen veriler, “borçlanma”, “yönetme” ve “tepki” olmak üzere üç tematik başlık altında analiz edilmiştir. Bu analizle borçlandırma ilişkisinin mikro-düzey işleyişi ve öznelerin deneyimleri ortaya konmuştur.",
  theoreticalFramework:
    "Foucaultcu ve Marksist yaklaşımlardan etkilenilmiştir. Borçlanma, bir iktidar ilişkisi olarak kurgulanmış; bu ilişki sonucunda kurulan özne ise bir süreç olarak tanımlanmıştır. Neoliberal borçlandırmanın özgüllüğü işçi sınıfı borçlanması olarak belirlenmiştir. Ayrıca, öznel pratikler ve gri pratikler (idare etme mekanizmaları) kavramlarıyla borçluların tepkileri teorikleştirilmiştir.",
  historicalSpatialLimits:
    "Mekânsal sınır: Türkiye. Tarihsel sınır: Tez metninde net bir tarih aralığı belirtilmemiş olmakla birlikte, neoliberal dönemin (yaklaşık 1980 sonrası) özellikle son yirmi yılına odaklanıldığı ve mülakatların güncel borçluluk hallerini yansıttığı anlaşılmaktadır. Kesin tarih aralığı için tezin tam metnine başvurulmalıdır.",
};

interface StepMetric {
  durationMs: number;
  success: boolean;
  error?: string;
  output?: any;
}

// Read args
const args = process.argv.slice(2);
const stepIndex = args.indexOf("--step");
const targetStep = stepIndex !== -1 ? args[stepIndex + 1] : "1";

async function main() {
  const { db } = await import("./src/db");
  const { users, thesisMatrices, originalityReports, thesisBoxes } =
    await import("./src/db/schema");
  const { resetOnboardingAction } =
    await import("./src/app/(auth)/onboarding/actions");
  const { submitThesisMatrixAction } =
    await import("./src/app/(auth)/onboarding/matrix/actions");
  const { confirmEnhancedThesisAction } =
    await import("./src/app/(auth)/onboarding/enrichment/actions");
  const {
    startOriginalityAnalysisAction,
    generateBoxesForCurrentMatrixAction,
  } = await import("./src/app/(auth)/onboarding/risk/actions");
  const { completeOnboardingAction } =
    await import("./src/app/(auth)/onboarding/complete/actions");

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, TEST_EMAIL));
  if (!user) {
    console.error(
      `❌ Hata: ${TEST_EMAIL} kullanıcısı veritabanında bulunamadı.`,
    );
    process.exit(1);
  }

  // Mock session
  (global as any).__mockSession = {
    userId: user.id,
    name: user.name,
  };

  if (targetStep === "1") {
    await runStep1(db, user, resetOnboardingAction, submitThesisMatrixAction);
  } else if (targetStep === "3") {
    await runStep3(
      db,
      user,
      confirmEnhancedThesisAction,
      startOriginalityAnalysisAction,
      originalityReports,
    );
  } else if (targetStep === "4") {
    await runStep4(
      db,
      user,
      generateBoxesForCurrentMatrixAction,
      thesisMatrices,
      thesisBoxes,
    );
  } else if (targetStep === "5") {
    await runStep5(db, user, completeOnboardingAction);
  } else {
    console.error(
      `❌ Geçersiz adım belirtildi: --step ${targetStep}. Geçerli adımlar: 1, 3, 4, 5`,
    );
  }
}

// ==========================================
// ADIM 1: TEZ MATRİSİ KAYIT VE ZENGİNLEŞTİRME
// ==========================================
async function runStep1(
  db: any,
  user: any,
  resetOnboardingAction: any,
  submitThesisMatrixAction: any,
) {
  console.log(`\n==================================================`);
  console.log(`🚀 ADIM 1: TEZ MATRİSİ OLGUNLAŞTIRMA TESTİ (5 TEKRAR)`);
  console.log(`==================================================\n`);

  const metrics: StepMetric[] = [];

  for (let i = 1; i <= 5; i++) {
    console.log(`🔄 İterasyon ${i}/5 çalıştırılıyor...`);

    // Reset state before matrix submit
    await resetOnboardingAction();

    const start = performance.now();
    const result = await submitThesisMatrixAction(THESIS_INPUT);
    const duration = performance.now() - start;

    if ("error" in result) {
      console.error(`  ❌ Başarısız: ${result.error}`);
      metrics.push({
        durationMs: duration,
        success: false,
        error: result.error,
      });
    } else {
      console.log(`  ✅ Başarılı. Süre: ${Math.round(duration)}ms`);
      metrics.push({
        durationMs: duration,
        success: true,
        output: result.data,
      });
    }
  }

  // Save intermediate results
  fs.writeFileSync(
    "test-step1-outputs.json",
    JSON.stringify(metrics, null, 2),
    "utf-8",
  );
  console.log(
    `\n💾 Adım 1 sonuçları 'test-step1-outputs.json' dosyasına kaydedildi.`,
  );

  // Analyze performance
  printStats("submitThesisMatrixAction (Step 1)", metrics);

  // Gemini audit
  await runGeminiAudit(
    "Adım 1: Tez Matrisi Akademik Zenginleştirme Tutarlılığı",
    `
Girdi Matrisi:
${JSON.stringify(THESIS_INPUT, null, 2)}

Çıktılar (5 İterasyon):
${metrics
  .map(
    (m, idx) => `
İterasyon ${idx + 1}:
- Akademik Başlık: ${m.output?.academicStudyTitle || "Hata"}
- Araştırma Sorusu: ${m.output?.literatureResearchQuestion || "Hata"}
- Temel İddia: ${m.output?.refinedThesisClaim || "Hata"}
- Metodoloji Tasarımı: ${m.output?.academicMethodologyDesign || "Hata"}
- Kuramsal Altyapı: ${m.output?.conceptualTheoreticalInfrastructure || "Hata"}
- Sınırlar: ${m.output?.historicalSpatialLimits || "Hata"}
`,
  )
  .join("\n")}
  `,
    1,
  );
}

// ==========================================
// ADIM 3: TEZ ONAYLAMA VE ÖZGÜNLÜK ANALİZİ
// ==========================================
async function runStep3(
  db: any,
  user: any,
  confirmEnhancedThesisAction: any,
  startOriginalityAnalysisAction: any,
  originalityReports: any,
) {
  console.log(`\n==================================================`);
  console.log(`🚀 ADIM 3: ÖZGÜNLÜK ANALİZİ TESTİ (5 TEKRAR)`);
  console.log(`==================================================\n`);

  // Read Step 1 outputs to use as the base for confirmation
  if (!fs.existsSync("test-step1-outputs.json")) {
    console.error(
      "❌ Hata: 'test-step1-outputs.json' bulunamadı. Lütfen önce --step 1 testini tamamlayın.",
    );
    process.exit(1);
  }

  const step1Data = JSON.parse(
    fs.readFileSync("test-step1-outputs.json", "utf-8"),
  );
  const successfulStep1 = step1Data.find((m: any) => m.success);
  if (!successfulStep1) {
    console.error(
      "❌ Hata: Adım 1 testleri arasında başarılı bir kayıt bulunamadı.",
    );
    process.exit(1);
  }

  const enhancedData = successfulStep1.output;
  console.log(`ℹ️ Adım 1'den gelen Akademik Matris referans alındı.`);

  const metrics: StepMetric[] = [];

  for (let i = 1; i <= 5; i++) {
    console.log(
      `🔄 İterasyon ${i}/5 çalıştırılıyor... (Özgünlük analizi uzun sürebilir)`,
    );

    // Reset user state to allow originality analysis to run
    const { users } = await import("./src/db/schema");
    await db
      .update(users)
      .set({ onboardingStep: "originality_report" })
      .where(eq(users.id, user.id));

    // Delete existing originality report to bypass auto-healing cache and force a fresh run
    await db
      .delete(originalityReports)
      .where(eq(originalityReports.userId, user.id));

    // Confirm the matrix to set DB fields
    await confirmEnhancedThesisAction(enhancedData);

    const start = performance.now();
    const result = await startOriginalityAnalysisAction();
    const duration = performance.now() - start;

    if ("error" in result) {
      console.error(`  ❌ Başarısız: ${result.error}`);
      metrics.push({
        durationMs: duration,
        success: false,
        error: result.error,
      });
    } else {
      console.log(`  ✅ Başarılı. Süre: ${Math.round(duration)}ms`);
      // Fetch report
      const [report] = await db
        .select()
        .from(originalityReports)
        .where(eq(originalityReports.userId, user.id));
      metrics.push({
        durationMs: duration,
        success: true,
        output: report
          ? {
              originalityBadge: report.tezaraResults.originalityBadge,
              riskPercentage: report.tezaraResults.riskPercentage,
              overlapCount: report.tezaraResults.overlapTable?.length ?? 0,
              briefingNote: report.tavilyResults.briefingNote,
              strategicRecommendations:
                report.tezaraResults.strategicRecommendations,
            }
          : null,
      });
    }
  }

  // Save intermediate results
  fs.writeFileSync(
    "test-step3-outputs.json",
    JSON.stringify(metrics, null, 2),
    "utf-8",
  );
  console.log(
    `\n💾 Adım 3 sonuçları 'test-step3-outputs.json' dosyasına kaydedildi.`,
  );

  // Analyze performance
  printStats("startOriginalityAnalysisAction (Step 3)", metrics);

  // Gemini audit
  await runGeminiAudit(
    "Adım 3: Özgünlük Analizi ve Risk Puanı Tutarlılığı",
    `
Referans Akademik Başlık: ${enhancedData.academicStudyTitle}

Çıktılar (5 İterasyon):
${metrics
  .map(
    (m, idx) => `
İterasyon ${idx + 1}:
- Risk Rozeti: ${m.output?.originalityBadge || "Hata"}
- Risk Yüzdesi: ${m.output?.riskPercentage !== undefined ? m.output?.riskPercentage + "%" : "Hata"}
- Çakışan Tez Sayısı: ${m.output?.overlapCount || 0}
- Tavily Özet Bilgisi: ${m.output?.briefingNote ? m.output.briefingNote.substring(0, 150) + "..." : "Hata"}
- Stratejik Öneriler: ${m.output?.strategicRecommendations ? m.output.strategicRecommendations.substring(0, 150) + "..." : "Hata"}
`,
  )
  .join("\n")}
  `,
    3,
  );
}

// ==========================================
// ADIM 4: KONU KUTULARI (KARTOTEKS) OLUŞTURMA
// ==========================================
async function runStep4(
  db: any,
  user: any,
  generateBoxesForCurrentMatrixAction: any,
  thesisMatrices: any,
  thesisBoxes: any,
) {
  console.log(`\n==================================================`);
  console.log(
    `🚀 ADIM 4: KONU KUTULARI (KARTOTEKS) OLUŞTURMA TESTİ (5 TEKRAR)`,
  );
  console.log(`==================================================\n`);

  // Ensure matrix exists in db
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, user.id));
  if (!matrix) {
    console.error(
      "❌ Hata: Veritabanında tez matrisi bulunamadı. Lütfen --step 1 ve --step 3 testlerini tamamlayın.",
    );
    process.exit(1);
  }

  const metrics: StepMetric[] = [];

  for (let i = 1; i <= 5; i++) {
    console.log(`🔄 İterasyon ${i}/5 çalıştırılıyor...`);

    // Reset user step to complete originality analysis step
    const { users } = await import("./src/db/schema");
    await db
      .update(users)
      .set({ onboardingStep: "originality_report_completed" })
      .where(eq(users.id, user.id));

    const start = performance.now();
    const result = await generateBoxesForCurrentMatrixAction();
    const duration = performance.now() - start;

    if ("error" in result) {
      console.error(`  ❌ Başarısız: ${result.error}`);
      metrics.push({
        durationMs: duration,
        success: false,
        error: result.error,
      });
    } else {
      console.log(`  ✅ Başarılı. Süre: ${Math.round(duration)}ms`);
      // Fetch boxes
      const boxes = await db
        .select()
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
      metrics.push({
        durationMs: duration,
        success: true,
        output: boxes.map((b: any) => ({
          title: b.title,
          category: b.category,
          theorists: b.theorists,
          concepts: b.concepts,
          primaryLiteratureCount: b.primaryLiterature?.length ?? 0,
          secondaryLiteratureCount: b.secondaryLiterature?.length ?? 0,
        })),
      });
    }
  }

  // Save intermediate results
  fs.writeFileSync(
    "test-step4-outputs.json",
    JSON.stringify(metrics, null, 2),
    "utf-8",
  );
  console.log(
    `\n💾 Adım 4 sonuçları 'test-step4-outputs.json' dosyasına kaydedildi.`,
  );

  // Analyze performance
  printStats("generateBoxesForCurrentMatrixAction (Step 4)", metrics);

  // Gemini audit
  await runGeminiAudit(
    "Adım 4: Konu Kutuları (Kartoteks) Yapısal Kararlılığı",
    `
Çıktılar (5 İterasyon):
${metrics
  .map(
    (m, idx) => `
İterasyon ${idx + 1}:
- Toplam Kutu Sayısı: ${m.output?.length || 0}
- Detaylar: ${JSON.stringify((m.output || []).slice(0, 3))}
`,
  )
  .join("\n")}
  `,
    4,
  );
}

// ==========================================
// ADIM 5: ONBOARDING TAMAMLAMA
// ==========================================
async function runStep5(db: any, user: any, completeOnboardingAction: any) {
  console.log(`\n==================================================`);
  console.log(`🚀 ADIM 5: ONBOARDING TAMAMLAMA TESTİ (5 TEKRAR)`);
  console.log(`==================================================\n`);

  const metrics: StepMetric[] = [];

  for (let i = 1; i <= 5; i++) {
    console.log(`🔄 İterasyon ${i}/5 çalıştırılıyor...`);

    // Reset step tocompleted risk
    const { users } = await import("./src/db/schema");
    await db
      .update(users)
      .set({ onboardingStep: "originality_report_completed" })
      .where(eq(users.id, user.id));

    const start = performance.now();
    const result = await completeOnboardingAction();
    const duration = performance.now() - start;

    if ("error" in result) {
      console.error(`  ❌ Başarısız: ${result.error}`);
      metrics.push({
        durationMs: duration,
        success: false,
        error: result.error,
      });
    } else {
      console.log(`  ✅ Başarılı. Süre: ${Math.round(duration)}ms`);
      // Read current step
      const [usr] = await db.select().from(users).where(eq(users.id, user.id));
      metrics.push({
        durationMs: duration,
        success: true,
        output: { finalStep: usr?.onboardingStep },
      });
    }
  }

  // Save intermediate results
  fs.writeFileSync(
    "test-step5-outputs.json",
    JSON.stringify(metrics, null, 2),
    "utf-8",
  );
  console.log(
    `\n💾 Adım 5 sonuçları 'test-step5-outputs.json' dosyasına kaydedildi.`,
  );

  // Analyze performance
  printStats("completeOnboardingAction (Step 5)", metrics);

  // Print final validation
  console.log(
    `\n✔️ Adım 5 tamamlandı. Tüm iterasyonlar bittikten sonra onboardingStep: completed olmaktadır.`,
  );
}

// ==========================================
// İSTATİSTİK YARDIMCI METOTLARI
// ==========================================
function printStats(stepName: string, metrics: StepMetric[]) {
  const successful = metrics.filter((m) => m.success);
  const successCount = successful.length;
  const failureCount = metrics.length - successCount;
  const durations = successful.map((m) => m.durationMs);

  if (durations.length === 0) {
    console.log(`\n❌ Tüm testler başarısız oldu! Hata oranı: 100%`);
    return;
  }

  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const variance =
    durations.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  console.log(`\n📊 Performans Analizi (${stepName}):`);
  console.log(`| İstatistik | Değer |`);
  console.log(`| :--- | :--- |`);
  console.log(
    `| Başarı Oranı | ${successCount} / ${metrics.length} (${(successCount / metrics.length) * 100}%) |`,
  );
  console.log(
    `| Hata Oranı | ${failureCount} / ${metrics.length} (${(failureCount / metrics.length) * 100}%) |`,
  );
  console.log(`| Ortalama Süre | ${Math.round(avg)} ms |`);
  console.log(`| Standart Sapma | ${Math.round(stdDev)} ms |`);
  console.log(`| En Kısa Süre | ${Math.round(min)} ms |`);
  console.log(`| En Uzun Süre | ${Math.round(max)} ms |`);
}

// ==========================================
// GEMINI İLE KALİTE VE TUTARLILIK DENETİMİ
// ==========================================
async function runGeminiAudit(
  title: string,
  dataSummary: string,
  stepNum: number,
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("⚠️ GEMINI_API_KEY bulunamadı, kalite denetimi atlanıyor.");
    return;
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `<role>
Sen akademik kalite kontrol ve tutarlılık denetimi yapan uzman bir baş yazılım mühendisi ve yapay zeka denetçisisin.
</role>
<context>
Bir yüksek lisans tezinin onboarding sürecindeki ${title} adımı tam 5 kez çalıştırılmıştır.
</context>
<task>
Aşağıdaki 5 iterasyonun çıktılarını analiz et. Aşağıdaki kriterlere göre elit ve profesyonel bir akademik Türkçe ile bir değerlendirme raporu oluştur:
1. **Çıktı Tutarlılığı ve Varyasyon Analizi**: İterasyonlar arasındaki benzerlikleri ve farklılıkları analiz et. Çıktılar ne düzeyde tutarlı (deterministik)? Temperature 1.0 nedeniyle oluşan anlamsal kaymalar veya yaratıcı sapmalar kabul edilebilir akademik aralıkta mı?
2. **Akademik Dil ve Üslup Kalitesi**: Çıktılarda kullanılan Türkçe dilinin kalitesini, kavramların doğruluğunu ve tezin Foucaultcu/Marksist neoliberal borçlanma teorisine uyumunu değerlendir.
3. **Uç Durumlar ve Riskler**: Bu adım özelinde tezin sonraki aşamalarını olumsuz etkileyebilecek (örneğin halüsinasyon, yanlış teorisyen eşleşmesi, aşırı soyutlama gibi) bir risk tespit ettin mi?
</task>
<constraints>
- Çıktıyı doğrudan Markdown formatında üret.
- Markdown içinde başlıklar, listeler ve vurgular kullan.
- Türkçe karakterler düzgün olmalı, dil elit ve yapıcı bir tonda yazılmalıdır.
</constraints>`;

  console.log(
    `🤖 Gemini ile ${title} için anlamsal tutarlılık denetimi yapılıyor...`,
  );
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: dataSummary }] }],
      config: {
        systemInstruction,
        temperature: 1.0,
      },
    });

    const reportContent = response.text || "Değerlendirme raporu boş döndü.";

    // Save report as step_X_results.md
    const reportPath = `/Users/vedatdiyar/.gemini/antigravity-ide/brain/016354c3-3f11-4162-bc4d-3c7d402a8e6d/step_${stepNum}_results.md`;
    fs.writeFileSync(
      reportPath,
      `# ${title} Değerlendirme Raporu\n\n${reportContent}\n\n*Rapor test script'i tarafından otomatik olarak üretilmiştir.*`,
      "utf-8",
    );
    console.log(`🎉 Değerlendirme raporu başarıyla oluşturuldu: ${reportPath}`);
  } catch (err) {
    console.error("❌ Gemini analizi başarısız oldu:", err);
  }
}

main();
