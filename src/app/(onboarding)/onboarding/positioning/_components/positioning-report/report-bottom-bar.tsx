"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { OnboardingStepFooter } from "@/app/(onboarding)/onboarding/_components/onboarding-step-footer";

interface ReportBottomBarProps {
  isDirectOverlap: boolean;
  confirming: boolean;
  onConfirm: () => void;
}

/**
 * Renders bottom action bar for positioning report using the standardized footer.
 *
 * @param props - Bottom bar props.
 * @returns Bottom bar markup or null if direct overlap.
 */
export function ReportBottomBar({
  isDirectOverlap,
  confirming,
  onConfirm,
}: ReportBottomBarProps) {
  const router = useRouter();

  if (isDirectOverlap) {
    return null;
  }

  return (
    <OnboardingStepFooter
      onBack={() => router.push("/onboarding/proposal")}
      backLabel="Taslağı Düzenle"
      backIcon={RefreshCw}
      backDisabled={confirming}
      onNext={onConfirm}
      nextLabel="Konumlandırmayı Onayla"
      nextDisabled={confirming}
      nextLoading={confirming}
      nextLoadingText="Konu Kutuları Hazırlanıyor..."
    />
  );
}
