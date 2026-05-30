"use client";

import React, { useState, useTransition } from "react";
import {
  GraduationCap,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  const [isCollapsed, setIsCollapsed] = useState(false);
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
    <div className="w-full border border-border bg-card rounded-lg overflow-hidden transition-all duration-300 mb-8">
      {/* Panel Header */}
      <div className="p-5 border-b border-border flex justify-between items-center bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Tez Anayasası & Stratejik Çatı</span>
            </h2>
            <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
              Tezinizin yön bulucu anayasal parametreleri ve teorik temeli
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Resetting AlertDialog */}
          <AlertDialog>
            <AlertDialogTrigger
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-destructive/20 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition cursor-pointer disabled:opacity-50 bg-transparent"
            >
              <RefreshCw
                className={`size-3 ${isPending ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Yeniden Yapılandır</span>
            </AlertDialogTrigger>
            <AlertDialogContent className="border border-border bg-card">
              <AlertDialogHeader>
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <AlertDialogTitle className="font-sans text-foreground text-sm font-bold">
                  Tez Anayasası Sıfırlansın Mı?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Tez anayasasını, tüm tematik çalışma kutularını, kütüphanedeki
                  tüm PDF makalelerinizi, okuma notlarınızı, görevleri ve yapay
                  zeka öngörülerini tamamen silmek istediğinize emin misiniz? Bu
                  işlem geri alınamaz ve tüm verileriniz kalıcı olarak
                  temizlenecektir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border text-foreground hover:bg-muted cursor-pointer text-xs rounded">
                  Vazgeç
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs rounded cursor-pointer"
                >
                  Sıfırla ve Yeniden Başlat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
            title={isCollapsed ? "Genişlet" : "Daralt"}
          >
            {isCollapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Panel Content (Collapsible) */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? "max-h-0 opacity-0" : "max-h-[1200px] opacity-100"
        }`}
      >
        <div className="p-6 space-y-6 bg-card">
          {/* Active Header Title */}
          <div className="bg-background border border-border rounded p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
              Tez Başlığı (Süreçsel ve Odaklı)
            </h3>
            <p className="text-sm font-bold text-foreground leading-snug">
              {thesisData.title}
            </p>
          </div>

          {/* Core Parameters Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Research Question */}
            <div className="bg-background border border-border rounded p-5 relative overflow-hidden h-full flex flex-col justify-between transition-colors hover:border-border/80">
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

            {/* Argument */}
            <div className="bg-background border border-border rounded p-5 relative overflow-hidden h-full flex flex-col justify-between transition-colors hover:border-border/80">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Ana Argüman / Hipotez
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  {thesisData.argument}
                </p>
              </div>
            </div>

            {/* Methodology */}
            <div className="bg-background border border-border rounded p-5 relative overflow-hidden h-full flex flex-col justify-between transition-colors hover:border-border/80">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Metodoloji & Tarihsel Kapsam
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  {thesisData.methodology}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
