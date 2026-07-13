"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
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
import { resetOnboardingAction } from "@/app/(onboarding)/onboarding/actions";

export function StartOverButton({ className, ...props }: ButtonProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleReset = () => {
    startTransition(async () => {
      try {
        const result = await resetOnboardingAction();
        if ("error" in result && result.error) {
          toast.error(result.error);
        } else {
          queryClient.invalidateQueries();
          toast.success("Onboarding süreci başarıyla sıfırlandı.");
          setIsOpen(false);
          window.location.href = "/onboarding/matrix?reset=" + Date.now();
        }
      } catch {
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
          variant="outline"
          size="sm"
          className={`border-destructive bg-destructive/20 text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground ${className ?? ""}`}
          {...props}
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
            Bu işlem, şu ana kadar girdiğiniz tüm bilgileri, analizleri ve
            oluşturulan kutuları kalıcı olarak silecektir. Devam etmek istiyor
            musunuz?
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
