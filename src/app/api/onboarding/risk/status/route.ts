import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, originalityReports } from "@/db/schema";
import { getSession } from "@/proxy";

/**
 * GET handler for retrieving the current user's onboarding step and applying auto-healing logic.
 * This API endpoint prevents Next.js Server Actions page revalidation during polling.
 *
 * @returns NextResponse containing status success and current onboarding step, or error details.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Oturum bulunamadı." },
        { status: 401 },
      );
    }

    const [user] = await db
      .select({ onboardingStep: users.onboardingStep })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı bulunamadı." },
        { status: 404 },
      );
    }

    let step = user.onboardingStep;

    // Otomatik İyileştirme (Auto-healing): Eğer veri tabanında rapor zaten varsa ama adım tamamlanmadıysa, adımı tamamla
    if (
      step === "originality_report" ||
      step === "originality_report_processing"
    ) {
      const [report] = await db
        .select()
        .from(originalityReports)
        .where(eq(originalityReports.userId, session.userId));

      if (report) {
        await db
          .update(users)
          .set({ onboardingStep: "originality_report_completed" })
          .where(eq(users.id, session.userId));
        step = "originality_report_completed";
      }
    }

    // cache-control eklentisiyle Next.js route caching'i devre dışı bırakıyoruz
    return NextResponse.json(
      { success: true, step },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
