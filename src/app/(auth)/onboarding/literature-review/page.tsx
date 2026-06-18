export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices } from "@/db/schema";
import { LiteratureReviewContent } from "./_components/literature-review-content";

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
      <LiteratureReviewContent />
    </div>
  );
}
