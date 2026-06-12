"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  /** Shadcn Button variant değeri. Varsayılan: "outline" */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  /** Butona eklenecek ek CSS sınıfları */
  className?: string;
}

/**
 * Onboarding sürecini baştan başlatmak için kullanılan buton bileşeni (Client Component).
 * Kullanıcıdan onay alan bir Alert Dialog açar ve onay verildiğinde veritabanındaki onboarding
 * ilerlemesini temizleyerek süreci ilk adıma sıfırlar.
 *
 * @param variant - Shadcn Button variant değeri (varsayılan: "outline")
 * @param className - Butona eklenecek ek CSS sınıfları
 */
export function StartOverButton({
  variant = "outline",
  className = "",
}: StartOverButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleReset = () => {
    startTransition(async () => {
      try {
        const result = await resetOnboardingAction();

        if ("error" in result && result.error) {
          toast.error(result.error);
        } else {
          toast.success("Onboarding süreci başarıyla sıfırlandı.");
          setIsOpen(false);
          router.refresh();
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
          size="sm"
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
