export const maxDuration = 300;
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { LiteratureReviewContent } from "./_components/literature-review-content";
import { OnboardingStepHeader } from "../_components/onboarding-step-header";
import { fetchBoxesWithFullShape } from "@/app/(onboarding)/onboarding/_services/fetch-actions";

/**
 * Renders the literature review onboarding step for the authenticated user.
 *
 * @returns The literature review page UI.
 */
export default async function LiteratureReviewPage() {
  const profile = await getProfile();

  const [matrix] = await db
    .select({ id: matrices.id })
    .from(matrices)
    .where(eq(matrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

  const boxes = await fetchBoxesWithFullShape();
  if (!boxes || boxes.length === 0) {
    redirect("/onboarding/outline");
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="flex w-full max-w-5xl flex-col items-center space-y-4">
        <OnboardingStepHeader
          title="Literatür Taraması"
          description="Her bir konu kutusu için akademik kaynaklar taranıyor."
        />

        <LiteratureReviewContent />
      </div>
    </div>
  );
}
