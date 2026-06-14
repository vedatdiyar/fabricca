"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/store/useOnboardingStore"; // 1. Ekleme: Store kancası
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resetOnboardingAction } from "@/app/(auth)/onboarding/actions";

interface StartOverButtonProps {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function StartOverButton({
  variant = "outline",
  size = "sm",
  className = "",
}: StartOverButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const resetStore = useOnboardingStore((s) => s.resetStore); // 2. Ekleme: Sıfırlama aksiyonu

  const handleReset = () => {
    startTransition(async () => {
      try {
        const result = await resetOnboardingAction();

        if ("error" in result && result.error) {
          toast.error(result.error);
        } else {
          // 3. Kritik Hamle: Önce yerel tarayıcı hafızasını tamamen sıfırla
          resetStore();

          toast.success("Onboarding süreci başarıyla sıfırlandı.");
          setIsOpen(false);

          // 4. Kritik Hamle: Kullanıcıyı refresh etmek yerine ilk adıma fırlat
          router.push("/onboarding/matrix");
        }
      } catch (err) {
        toast.error(
          "Sıfırlama işlemi gerçekleştirilirken beklenmeyen bir hata oluştu.",
        );
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`border-destructive bg-destructive/50 text-destructive-foreground hover:bg-destructive/10 hover:text-destructive shadow-sm ${className}`}
          disabled={isPending}
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span>Baştan Başla</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Onboarding Sürecini Sıfırla
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            Bu işlem, şu ana kadar girdiğiniz tüm tez matrisi bilgilerini,
            yapılan akademik zenginleştirmeleri ve üretilen özgünlük raporlarını
            kalıcı olarak silecektir. Bu işlemi geri alamazsınız. Devam etmek
            istiyor musunuz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel>İptal Et</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleReset();
            }}
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sıfırlanıyor...
              </span>
            ) : (
              "Evet, Baştan Başla"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
