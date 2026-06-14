"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmBoxesAction } from "../actions";

/**
 * Onboarding sürecindeki konu kutularını onaylayan ve panele yönlendiren buton (Client Component).
 */
export function ConfirmBoxesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await confirmBoxesAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Konu kutuları onaylandı, yönlendiriliyorsunuz.");
      router.push("/dashboard");
    });
  };

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
