import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { ProposalStudio } from "./_components/proposal-studio";
import { StartOverButton } from "../_components/start-over-button";
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
    <div className="flex flex-col items-center justify-center p-4 pt-6 pb-4">
      <div className="flex w-full max-w-5xl flex-col items-center space-y-5">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
          <div className="flex flex-col space-y-1 text-left">
            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Tez Önerisi & Ön Değerlendirme
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tez önerinizi veya araştırma taslağınızı girin; yapay zeka web,
              YÖK tez arşivi ve uluslararası literatür taramasıyla tezinizin
              güçlü yönlerini ve metodolojik boşluklarını tespit etsin.
            </p>
          </div>
          <div className="flex items-center self-end sm:self-center">
            <StartOverButton />
          </div>
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
