export const maxDuration = 300;
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { LiteratureReviewContent } from "./_components/literature-review-content";
import { StartOverButton } from "../_components/start-over-button";
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
    redirect("/onboarding/positioning");
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="flex w-full max-w-5xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div className="flex flex-col space-y-1 text-left">
            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Literatür Taraması
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Her bir konu kutusu için akademik kaynaklar taranıyor.
            </p>
          </div>
          <div className="flex items-center self-end sm:self-center">
            <StartOverButton />
          </div>
        </div>

        <LiteratureReviewContent />
      </div>
    </div>
  );
}
