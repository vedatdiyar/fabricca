import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices } from "@/db/schema";
import { StoreHydrator } from "./_components/store-hydrator";
import { LiteratureReviewContent } from "./_components/literature-review-content";

/**
 * Literature Review onboarding step page (Server Component).
 *
 * Displays the literature review UI for each sub-box that was created
 * during the boxes step. Uses TanStack Query caching to avoid
 * re-running expensive AI pipeline on page refresh.
 */
export default async function LiteratureReviewPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  const [matrix] = await db
    .select({ id: thesisMatrices.id })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

  return (
    <div className="px-4 pt-10 pb-8">
      <StoreHydrator />
      <LiteratureReviewContent />
    </div>
  );
}
