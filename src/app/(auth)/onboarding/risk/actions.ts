"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { thesisMatrices, users, originalityReports } from "@/db/schema";
import type { NewOriginalityReport } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { withDbLogging } from "@/lib/db-helpers";
import type { OnboardingActionResult } from "@/lib/types";

import { extractQueries } from "./_services/queries";
import {
  executeParallelSearch,
  evaluateTavilyResults,
} from "./_services/search";
import { siftAndFetchDetails } from "./_services/sifting";
import { analyze4Axes } from "./_services/analysis";
import { calculateOriginalityRisk } from "./_services/risk-calc";
import { synthesizeRoadmap } from "./_services/roadmap";

/**
 * Starts the originality analysis process by executing factual and cross-language academic queries,
 * comparing the results, calculating originality risks, and saving the final report.
 * Updates the user's onboarding step to "originality_report_completed".
 *
 * @returns Success status or error message.
 */
export async function startOriginalityAnalysisAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "originality",
      data: { userId },
    });

    // Step 0: Read thesis matrix from Database
    const [matrix] = await withDbLogging(
      () =>
        db
          .select()
          .from(thesisMatrices)
          .where(eq(thesisMatrices.userId, userId)),
      "read_matrix",
      log,
    );

    if (!matrix) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Matris bulunamadı" },
      });
      return {
        error: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun.",
      };
    }

    const {
      studyTitle,
      researchQuestion,
      mainClaim,
      methodology,
      theoreticalFramework,
      historicalSpatialLimits,
    } = matrix;

    // Step 1: AI - Generate Tavily and Tezara queries
    const { tavilyQueries, tezaraQueries } = await extractQueries(
      {
        studyTitle,
        researchQuestion,
        mainClaim,
        methodology,
        theoreticalFramework,
        historicalSpatialLimits,
      },
      log,
    );

    // Step 2: Parallel search execution
    const { tavilySearchResults, tezaraSearchResults } =
      await executeParallelSearch(tavilyQueries, tezaraQueries, log);

    // Step 3: AI - Evaluate Tavily fact-check results using Gemini
    const tavilyEvaluation = await evaluateTavilyResults(
      {
        studyTitle,
        researchQuestion,
        mainClaim,
        theoreticalFramework,
      },
      tavilySearchResults,
      log,
    );

    // Step 4 & 5: Sift candidate theses and fetch full details
    const { finalTheses: validDetails } = await siftAndFetchDetails(
      {
        studyTitle,
        researchQuestion,
        theoreticalFramework,
        methodology,
        historicalSpatialLimits,
      },
      tezaraSearchResults,
      log,
    );

    let tezaraResults;

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "ZERO_RISK" as const,
        overlapTable: [],
        strategicRecommendations:
          "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir. Araştırma tasarımınızın özgünlüğü maksimum seviyenedir.",
      };

      log.info("flow_complete", {
        service: "originality",
        step: "analyze",
        data: { result: "ZERO_RISK", reason: "Hiçbir tez detayı çekilemedi" },
      });
    } else {
      // Step 6: AI - Compare across four axes
      const { overlapTable } = await analyze4Axes(
        {
          studyTitle,
          researchQuestion,
          mainClaim,
          methodology,
          theoreticalFramework,
          historicalSpatialLimits,
          validDetails,
        },
        log,
      );

      const riskCalcResult = calculateOriginalityRisk(overlapTable, validDetails, log);

      // Son yol haritası (roadmap) çağrısı öncesinde limitlerin sıfırlanması için 2 saniye bekliyoruz
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 6b: AI - Synthesize strategic academic roadmap
      const strategicRecommendations = await synthesizeRoadmap(
        {
          studyTitle,
          researchQuestion,
          mainClaim,
          methodology,
          theoreticalFramework,
          historicalSpatialLimits,
          comparisonResults: riskCalcResult.overlapTable.map((item) => ({
            title: item.title,
            author: item.author,
            year: item.year,
            axes: item.axes,
            originalityLevel: item.originalityLevel,
            comparisonNote: item.comparisonNote || "",
          })),
        },
        log,
      );

      tezaraResults = {
        originalityBadge: riskCalcResult.originalityBadge,
        overlapTable: riskCalcResult.overlapTable,
        strategicRecommendations,
        riskPercentage: riskCalcResult.riskPercentage,
      };
    }

    // Step 7: Save original report payload and update user onboarding step
    const databaseTavilyPayload = {
      items: tavilyEvaluation.items,
      briefingNote: tavilyEvaluation.briefingNote,
    };

    await withDbLogging(
      () =>
        db
          .insert(originalityReports)
          .values({
            userId,
            tavilyResults: databaseTavilyPayload,
            tezaraResults,
          })
          .onConflictDoUpdate({
            target: originalityReports.userId,
            set: {
              tavilyResults: databaseTavilyPayload,
              tezaraResults,
              updatedAt: new Date(),
            },
          }),
      "save_report",
      log,
    );

    await withDbLogging(
      () =>
        db
          .update(users)
          .set({ onboardingStep: "originality_report_completed" })
          .where(eq(users.id, userId)),
      "update_step",
      log,
    );

    revalidatePath("/onboarding", "layout");
    log.info("flow_complete", { service: "originality" });
    return { success: true };
  } catch (err) {
    log.error("flow_complete", {
      service: "originality",
      error: err,
    });
    return {
      error: "Özgünlük analizi sırasında bir hata oluştu.",
    };
  }
}

/**
 * Kullanıcının onboarding_step'ini "originality_report_completed" olarak günceller.
 * Orta ve Düşük risk senaryolarında bir sonraki aşamaya geçmek için kullanılır.
 *
 * @returns Başarı durumu veya hata mesajı.
 */
export async function completeRiskStageAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Oturum bulunamadı", action: "completeRiskStage" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    log.info("flow_start", {
      service: "originality",
      data: { userId, action: "completeRiskStage" },
    });

    await withDbLogging(
      () =>
        db
          .update(users)
          .set({ onboardingStep: "originality_report_completed" })
          .where(eq(users.id, userId)),
      "update_user_step",
      log,
    );

    revalidatePath("/onboarding", "layout");
    log.info("flow_complete", {
      service: "originality",
      step: "risk_completed",
    });
    return { success: true };
  } catch (err) {
    log.error("flow_complete", {
      service: "originality",
      step: "completeRiskStage",
      error: err,
    });
    return {
      error: "Risk aşaması tamamlanırken bir hata oluştu.",
    };
  }
}

/**
 * Seeds mock originality report data for the current user (debug/plan mode).
 * Inserts a realistic MEDIUM_RISK sample report so the UI can be previewed
 * without running the full analysis pipeline. Also sets onboarding_step to
 * "originality_report_completed" so /onboarding/risk renders the view.
 *
 * @returns Success status or error message.
 */
export async function seedMockOriginalityReportAction(): Promise<OnboardingActionResult> {
  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı." };

    const userId = session.userId;

    const mockTavily: NonNullable<NewOriginalityReport["tavilyResults"]> = {
      items: [
        {
          fact: "Osmanlı İmparatorluğu'nda 16. yüzyıl boyunca merkezi hazine gelirlerinin yaklaşık %40'ı askeri harcamalara ayrılmıştır.",
          result: "VERIFIED",
          resultNote: "Birden fazla akademik kaynak bu oranı doğrulamaktadır. Özellikle İnalcık ve Darling'in çalışmaları benzer rakamlar vermektedir.",
          sourceUrl: "https://example.com/source1",
        },
        {
          fact: "Timar sisteminin kaldırılmasıyla birlikte Anadolu'da tarımsal üretim %60 oranında düşmüştür.",
          result: "PARTIALLY_VERIFIED",
          resultNote: "Tarımsal üretimde düşüş yaşandığı doğrudur ancak %60 oranı bölgesel farklılıklar göstermektedir. Batı Anadolu'da düşüş daha sınırlıyken İç Anadolu'da %50'ye yaklaşmıştır.",
          sourceUrl: "https://example.com/source2",
        },
        {
          fact: "17. yüzyıl başlarında İstanbul nüfusu 700.000'i aşarak Avrupa'nın en kalabalık şehri olmuştur.",
          result: "VERIFIED",
          resultNote: "Mantran ve daha güncel nüfus çalışmaları bu tahmini desteklemektedir.",
          sourceUrl: "https://example.com/source3",
        },
        {
          fact: "Klasik dönem Osmanlı bürokrasisinde sadrazam dışındaki tüm görevliler belirli bir eğitim kurumundan (Enderun) geçmek zorundaydı.",
          result: "REFUTED",
          resultNote: "Enderun önemli bir kaynak olmakla birlikte, ilmiye sınıfı (şeyhülislam, kadı, müderris) medrese kökenlidir ve Enderun dışında yetişmiştir.",
          sourceUrl: "https://example.com/source4",
        },
      ],
      briefingNote:
        "Yapılan maddi doğrulama taramasında tez matrisinde yer alan dört temel olgusal iddiadan ikisi tamamen doğrulanmış, biri kısmen doğrulanmış, biri ise yanlışlanmıştır. Özellikle bürokrasi eğitim kurumuna dair iddianın düzeltilmesi önerilmektedir. Genel olarak tezin tarihsel veri güvenilirliği kabul edilebilir düzeydedir.",
    };

    const mockTezara: NonNullable<NewOriginalityReport["tezaraResults"]> = {
      originalityBadge: "MEDIUM_RISK",
      riskPercentage: 45,
      overlapTable: [
        {
          id: 1001,
          title: "Osmanlı Merkeziyetçilik Tartışmaları Bağlamında 17. Yüzyıl Mali Dönüşümü",
          author: "Ayşe Yılmaz",
          university: "İstanbul Üniversitesi",
          year: 2021,
          thesisType: "Doktora",
          department: "Tarih Anabilim Dalı",
          axes: {
            subject: "OVERLAPPING",
            theory: "OVERLAPPING",
            methodology: "ORIGINAL",
            context: "OVERLAPPING",
          },
          originalityLevel: "HIGH_RISK",
          comparisonNote:
            "Çalışmanızla konu (merkeziyetçilik-mali dönüşüm ilişkisi) ve kuramsal çerçeve (Weberyan bürokrasi teorisi) bakımından yüksek düzeyde çakışma bulunmaktadır. Yılmaz'ın çalışması da benzer şekilde Osmanlı mali dönüşümünü merkeziyetçilik kavramı üzerinden okumaktadır. Ancak metodolojik yaklaşımınız (mikro-tarihsel vaka analizi) onun makro-ekonomik yaklaşımından farklılaşmaktadır. Özgün katkınızı özellikle metodolojik farklılık üzerinden konumlandırmanız önerilir.",
        },
        {
          id: 1002,
          title: "Timar Sisteminin Çözülüşü ve Osmanlı Taşrasında Toplumsal Dönüşüm (1600-1700)",
          author: "Mehmet Demir",
          university: "Hacettepe Üniversitesi",
          year: 2019,
          thesisType: "Doktora",
          department: "Tarih Bölümü",
          axes: {
            subject: "OVERLAPPING",
            theory: "ORIGINAL",
            methodology: "OVERLAPPING",
            context: "OVERLAPPING",
          },
          originalityLevel: "MEDIUM_RISK",
          comparisonNote:
            "Demir'in çalışmasıyla konu (timar sistemi çözülüşü) ve bağlam (17. yüzyıl Osmanlı taşrası) bakımından kesişme bulunmaktadır. Bununla birlikte Demir iktisadi tarih odaklıyken sizin kuramsal çerçeveniz (kurumsal değişim ve yeni kurumsal iktisat) onunkinden (Weberyan rasyonalite) ayrışmaktadır. Metodolojik olarak her iki çalışma da arşiv belgesi analizine dayandığı için bu eksende dikkatli bir farklılaştırma stratejisi geliştirmeniz gerekmektedir.",
        },
        {
          id: 1003,
          title: "17. Yüzyıl Osmanlı İstanbul'unda Sosyo-Ekonomik Yapı ve Kent Nüfusu",
          author: "Zeynep Kaya",
          university: "Boğaziçi Üniversitesi",
          year: 2022,
          thesisType: "Yüksek Lisans",
          department: "Tarih Anabilim Dalı",
          axes: {
            subject: "ORIGINAL",
            theory: "ORIGINAL",
            methodology: "OVERLAPPING",
            context: "OVERLAPPING",
          },
          originalityLevel: "LOW_RISK",
          comparisonNote:
            "Kaya'nın çalışmasıyla yalnızca bağlam (17. yüzyıl İstanbul'u) ve metodoloji (nüfus verilerinin analizi) açısından sınırlı bir kesişme söz konusudur. Kaya kent tarihi ve demografi odaklıyken sizin çalışmanız merkeziyetçilik-mali dönüşüm ilişkisine odaklanmaktadır. Kuramsal çerçeve ve konu tamamen özgün olduğu için bu çalışma düşük risk kategorisinde değerlendirilmiştir.",
        },
      ],
      strategicRecommendations:
        "Yapılan dört eksenli karşılaştırma analizi sonucunda çalışmanızın genel özgünlük profili ORTA RİSK seviyesinde tespit edilmiştir.\n\nÖncelikli olarak Ayşe Yılmaz'ın (2021) doktora teziyle olan konu ve kuram çakışmasını yönetmek için bir 'farklılaştırma stratejisi' geliştirmeniz kritik önem taşımaktadır. Metodolojik farklılığınızı (mikro-tarihsel vaka analizi) çalışmanızın en güçlü özgünlük argümanı haline getirmeniz önerilir.\n\nMehmet Demir'in (2019) çalışmasıyla olan metodolojik benzerlik, arşiv belgesi kullanımınızı daha spesifik bir belge grubuyla (örneğin yalnızca muhasebe defterleri) sınırlandırarak aşılabilir. Ayrıca Demir'den farklı olarak nitel analiz yöntemlerine (söylem analizi, içerik analizi) ağırlık vermeniz özgünlük seviyenizi artıracaktır.\n\nTez savunmanızda özgün katkınızı şu şekilde konumlandırmanızı tavsiye ederiz: 'Osmanlı mali dönüşümünü merkeziyetçilik tartışmaları ekseninde ve mikro-tarihsel bir perspektifle ele alan bu çalışma, mevcut literatürden metodolojik yaklaşımı ve kuramsal senteziyle ayrışmaktadır.'",
    };

    await db
      .insert(originalityReports)
      .values({
        userId,
        tavilyResults: mockTavily,
        tezaraResults: mockTezara,
      })
      .onConflictDoUpdate({
        target: originalityReports.userId,
        set: {
          tavilyResults: mockTavily,
          tezaraResults: mockTezara,
          updatedAt: new Date(),
        },
      });

    await db
      .update(users)
      .set({ onboardingStep: "originality_report_completed" })
      .where(eq(users.id, userId));

    revalidatePath("/onboarding", "layout");

    return { success: true };
  } catch (err) {
    return { error: "Mock veri oluşturulurken hata oluştu." };
  }
}

/**
 * Retrieves the stored originality report for the current session user.
 *
 * @returns Stored report data or error message.
 */
export async function getStoredOriginalityReportAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Oturum bulunamadı" },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    log.info("flow_start", {
      service: "originality",
      step: "read_report",
      data: { userId: session.userId },
    });

    const [report] = await withDbLogging(
      () =>
        db
          .select()
          .from(originalityReports)
          .where(eq(originalityReports.userId, session.userId)),
      "read_report",
      log,
    );

    if (!report) {
      log.info("flow_complete", {
        service: "originality",
        data: { reason: "Rapor bulunamadı" },
      });
      return { error: "Henüz özgünlük raporu oluşturulmamış." };
    }

    log.info("flow_complete", { service: "originality", step: "read_report" });

    return {
      success: true,
      data: {
        tavilyResults: report.tavilyResults,
        tezaraResults: report.tezaraResults,
      },
    };
  } catch (err) {
    log.error("flow_complete", {
      service: "originality",
      step: "rapor_oku",
      error: err,
    });
    return { error: "Özgünlük raporu yüklenirken bir hata oluştu." };
  }
}
