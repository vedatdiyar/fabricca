"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmBoxesAction } from "../actions";
import type { OnboardingFormData } from "@/lib/types";

/**
 * Onboarding sürecindeki konu kutularını onaylayan, veritabanına kaydeden
 * ve literatür tarama sayfasına yönlendiren buton (Client Component).
 */
export function ConfirmBoxesButton() {
  const router = useRouter();

  // Zustand Store states
  const formData = useOnboardingStore((state) => state.formData);
  const enrichedData = useOnboardingStore((state) => state.enrichedData);
  const approvedKeywords = useOnboardingStore(
    (state) => state.approvedKeywords,
  );
  const juryReport = useOnboardingStore((state) => state.juryReport);
  const boxes = useOnboardingStore((state) => state.boxes);

  // Zustand Store actions
  const setStatus = useOnboardingStore((state) => state.setStatus);
  const statusBoxes = useOnboardingStore((state) => state.status.boxes);

  const mutation = useMutation({
    mutationFn: confirmBoxesAction,
    onMutate: () => {
      setStatus("boxes", "loading");
    },
    onSuccess: (res) => {
      if (res && "error" in res && res.error) {
        setStatus("boxes", "error");
        toast.error(res.error);
        return;
      }

      setStatus("boxes", "success");
      toast.success("Konu kutuları kaydedildi, literatür tarama sayfasına yönlendiriliyorsunuz.");

      // NOTE: Store is NOT reset here — data is needed by literature-review step.
      // redirect to literature-review placeholder
      router.push("/onboarding/literature-review");
    },
    onError: (err) => {
      setStatus("boxes", "error");
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    },
  });

  const handleConfirm = () => {
    if (!formData || !juryReport || !boxes) {
      toast.error(
        "Eksik onboarding verisi. Lütfen adımları sırayla tamamlayın.",
      );
      return;
    }

    // Map enriched data to OnboardingFormData if present
    const finalFormData: OnboardingFormData = enrichedData
      ? {
          studyTitle: enrichedData.academicStudyTitle,
          researchQuestion: enrichedData.literatureResearchQuestion,
          mainClaim: enrichedData.refinedThesisClaim,
          methodology: enrichedData.academicMethodologyDesign,
          theoreticalFramework:
            enrichedData.conceptualTheoreticalInfrastructure,
          historicalSpatialLimits: enrichedData.historicalSpatialLimits,
        }
      : formData;

    mutation.mutate({
      formData: finalFormData,
      approvedKeywords: approvedKeywords || [],
      juryReport,
      boxes,
    });
  };

  const isPending = statusBoxes === "loading";

  return (
    <Button
      onClick={handleConfirm}
      disabled={isPending}
      className="btn-academic-hero w-full sm:w-auto"
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Onaylanıyor...
        </span>
      ) : (
        "Kutuları Onayla ve Literatür Taramasını Başlat"
      )}
    </Button>
  );
}
