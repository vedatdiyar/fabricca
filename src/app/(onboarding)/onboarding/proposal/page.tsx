import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { ProposalStudio } from "./_components/proposal-studio";
import { fetchThesisMatrixFresh } from "@/app/(onboarding)/onboarding/_services/fetch-actions";

/**
 * Onboarding Step 1: Thesis proposal intake, multi-angle research audit, and diagnostic critique.
 *
 * @returns The rendered proposal onboarding page.
 */
export default async function OnboardingProposalPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  const initialMatrix = await fetchThesisMatrixFresh();

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="flex w-full max-w-5xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Tez Önerisi & Ön Değerlendirme
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Tez önerinizi veya araştırma taslağınızı girin; yapay zeka web, YÖK
            tez arşivi ve uluslararası literatür taramasıyla tezinizin güçlü
            yönlerini ve metodolojik boşluklarını tespit etsin.
          </p>
        </div>

        <ProposalStudio
          key={
            initialMatrix?.id
              ? `proposal-${initialMatrix.id}`
              : "proposal-empty"
          }
          initialProposal={initialMatrix?.rawProposal ?? ""}
        />
      </div>
    </div>
  );
}
