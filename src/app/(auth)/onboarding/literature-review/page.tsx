export const maxDuration = 300;

import { redirect } from "next/navigation";
import { getProfile } from "@/session";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices } from "@/db/schema";
import { LiteratureReviewContent } from "./_components/literature-review-content";
import { StartOverButton } from "../_components/start-over-button";

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
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div className="flex flex-col space-y-1 text-left">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
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
