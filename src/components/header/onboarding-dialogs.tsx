"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Confirmation dialog for reopening the onboarding flow while preserving user data.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is open.
 * @param root0.onOpenChange - Callback to toggle the dialog.
 * @param root0.onConfirm - Callback invoked when the action is confirmed.
 * @returns The reopen dialog markup.
 */
export function ReopenOnboardingDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl font-semibold text-foreground">
            Onboarding Adımlarına Dön
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Mevcut akademik verileriniz silinmeden onboarding kurulum adımlarını
            kaldığınız yerden gözden geçirmek istiyor musunuz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-xs font-medium">
            Vazgeç
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="text-xs font-medium"
          >
            Evet, Devam Et
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Confirmation dialog for wiping all user data and restarting onboarding.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is open.
 * @param root0.onOpenChange - Callback to toggle the dialog.
 * @param root0.onConfirm - Callback invoked when the action is confirmed.
 * @returns The reset dialog markup.
 */
export function ResetAllDataDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-destructive/20">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl font-semibold text-destructive">
            Tüm Verileri Sıfırla ve Baştan Başla
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Bu işlem Tez Matrisi, Konumlandırma, Kütüphane Kaynakları, Alıntı
            Fişleri, Danışman Sohbetleri ve Görevler dahil tüm akademik
            verilerinizi kalıcı olarak siler. Bu işlem geri alınamaz. Devam
            etmek istiyor musunuz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-xs font-medium">
            Vazgeç
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Evet, Her Şeyi Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
