"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboardingAction } from "../actions";

/**
 * Onboarding sürecini tamamlayan ve panele yönlendiren buton (Client Component).
 */
export function CompleteButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    startTransition(async () => {
      const res = await completeOnboardingAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Onboarding tamamlandı, yönlendiriliyorsunuz.");
      router.push("/dashboard");
    });
  };

  return (
    <Button
      onClick={handleComplete}
      disabled={isPending}
      className="btn-academic-hero w-full sm:w-auto"
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Tamamlanıyor...
        </span>
      ) : (
        "Süreci Tamamla ve Panel'e Geç"
      )}
    </Button>
  );
}
