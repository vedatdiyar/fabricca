"use client";

import React, { useTransition } from "react";
import { GraduationCap, RefreshCw, AlertTriangle } from "lucide-react";
import { ThesisCoreData, resetThesisCoreAction } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

interface ThesisConstitutionProps {
  thesisData: ThesisCoreData;
}

export function ThesisConstitution({ thesisData }: ThesisConstitutionProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleReset = () => {
    startTransition(async () => {
      try {
        const res = await resetThesisCoreAction();
        if (res.success) {
          toast.success(
            "Tez Anayasası başarıyla sıfırlandı. Mülakata yönlendiriliyorsunuz.",
          );
          router.refresh();
          router.push("/onboarding");
        } else {
          toast.error(res.error || "Sıfırlama sırasında hata oluştu.");
        }
      } catch (err) {
        console.error("Reset thesis core error:", err);
        toast.error("Beklenmeyen bir hata oluştu.");
      }
    });
  };

  return (
    <>
      {/* TEZ ANAYASASI - Mobil Yatay Kaydırma */}
      <div className="lg:hidden space-y-2 mb-8 select-none">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <GraduationCap className="size-4 text-primary" />
            <span>Tez Anayasası Özet</span>
          </h2>

          <AlertDialog>
            <AlertDialogTrigger
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-destructive/20 text-[10px] font-semibold text-destructive hover:bg-destructive/10 transition cursor-pointer disabled:opacity-50 bg-transparent"
            >
              <RefreshCw
                className={`size-3 ${isPending ? "animate-spin" : ""}`}
              />
              <span>Yeniden Yapılandır</span>
            </AlertDialogTrigger>
            <AlertDialogContent className="border border-border bg-card">
              <AlertDialogHeader>
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <AlertDialogTitle className="font-sans text-foreground">
                  Tez Anayasası Sıfırlansın Mı?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  Tez anayasasını ve tanımlanmış olan tüm Tematik Çalışma
                  Kutularını sıfırlamak istediğinize emin misiniz? Kütüphanedeki
                  PDF makaleleriniz ve okuma notlarınız silinmeyecektir, ancak
                  tematik çalışma kutusu ilişkileri temizlenecektir. Bu işlem
                  geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border text-foreground hover:bg-muted cursor-pointer">
                  Vazgeç
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive hover:bg-destructive text-destructive-foreground w-full sm:w-auto cursor-pointer"
                >
                  Sıfırla ve Yeniden Başlat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
          <div className="min-w-[85vw] snap-center bg-card border border-border p-5 rounded-lg space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Tez Başlığı
              </h3>
              <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                {thesisData.title}
              </p>
            </div>
            <div className="text-[10px] text-muted-foreground pt-2 border-t border-border mt-2">
              <strong className="text-foreground">Soru:</strong>{" "}
              {thesisData.researchQuestion}
            </div>
          </div>

          <div className="min-w-[85vw] snap-center bg-card border border-border p-5 rounded-lg space-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Ana Argüman
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5">
              {thesisData.argument}
            </p>
          </div>

          <div className="min-w-[85vw] snap-center bg-card border border-border p-5 rounded-lg space-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Metodoloji & Yöntem
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5">
              {thesisData.methodology}
            </p>
          </div>
        </div>
      </div>

      {/* ÜST KATMAN: Tez Anayasası Bloğu (Masaüstü) */}
      <div className="hidden lg:block w-full border border-border bg-card p-6 rounded-lg shadow-xl space-y-6 mb-8 select-none">
        <div className="pb-4 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" />
              <span>Tez Anayasası</span>
            </h2>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Tezin teorik çatısı — stratejik parametreler ve yön belirleyiciler
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger
              disabled={isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-destructive/20 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition cursor-pointer disabled:opacity-50 bg-transparent"
            >
              <RefreshCw
                className={`size-3.5 ${isPending ? "animate-spin" : ""}`}
              />
              <span>Tez Anayasasını Yeniden Yapılandır</span>
            </AlertDialogTrigger>
            <AlertDialogContent className="border border-border bg-card">
              <AlertDialogHeader>
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <AlertDialogTitle className="font-sans text-foreground">
                  Tez Anayasası Sıfırlansın Mı?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  Tez anayasasını ve tanımlanmış olan tüm Tematik Çalışma
                  Kutularını sıfırlamak istediğinize emin misiniz? Kütüphanedeki
                  PDF makaleleriniz ve okuma notlarınız silinmeyecektir, ancak
                  tematik çalışma kutusu ilişkileri temizlenecektir. Bu işlem
                  geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border text-foreground hover:bg-muted cursor-pointer">
                  Vazgeç
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive hover:bg-destructive text-destructive-foreground cursor-pointer"
                >
                  Sıfırla ve Yeniden Başlat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="space-y-4">
          <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
              Tez Başlığı
            </h3>
            <p className="text-sm font-bold text-foreground leading-snug">
              {thesisData.title}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Araştırma Sorusu
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  {thesisData.researchQuestion}
                </p>
              </div>
            </div>
            <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Ana Argüman
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  {thesisData.argument}
                </p>
              </div>
            </div>
            <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Metodoloji & Dönem
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  {thesisData.methodology}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
