import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { seedMockOriginalityReportAction } from "@/app/(auth)/onboarding/risk/actions";

/**
 * Geçici debug endpointi — onboarding risk sayfasında görüntülemek üzere
 * veritabanına mock özgünlük raporu yazar ve kullanıcıyı /onboarding/risk'e yönlendirir.
 * Kullanım: Tarayıcıdan GET /api/seed-report
 */
export async function GET(_request: NextRequest) {
  const result = await seedMockOriginalityReportAction();

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  redirect("/onboarding/risk");
}
