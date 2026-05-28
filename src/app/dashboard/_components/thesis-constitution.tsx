"use client";

import React, { useState, useTransition } from "react";
import {
  GraduationCap,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  FileText,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { ThesisCoreData, resetThesisCoreAction } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
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
    <div className="w-full space-y-8 select-none">
      {/* 1. ÜST PANEL: TEZ ANAYASASI (Collapsible & Proposal Zenginliğinde) */}
      <div className="w-full border border-border bg-card rounded-lg overflow-hidden transition-all duration-300">
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
                    Tez anayasasını ve tanımlanmış olan tüm Tematik Çalışma
                    Kutularını sıfırlamak istediğinize emin misiniz?
                    Kütüphanedeki PDF makaleleriniz ve okuma notlarınız
                    silinmeyecektir, ancak tematik çalışma kutusu ilişkileri
                    temizlenecektir. Bu işlem geri alınamaz.
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

      {/* 2. ALT GÖVDE: ENTELEKTÜEL KUMBARALAR (Kutular Dünyası) */}
      {thesisData.boxes && thesisData.boxes.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-end border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                <FolderOpen className="size-4 text-primary" />
                <span>Entelektüel Kumbaralar (Kartoteks Dolabı)</span>
              </h2>
              <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                Tez bölümlerinize göre okunan makaleleri, alınan notları ve
                ampirik fişleri tasnif edin
              </p>
            </div>
            <Link
              href="/library"
              className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider flex items-center gap-1 hover:text-primary-foreground/90 transition-all"
            >
              <span>Arşive Git</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {thesisData.boxes.map((box, index) => (
              <div
                key={box.id}
                className="group relative bg-card border border-border hover:border-primary/50 rounded p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.03)]"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-border group-hover:bg-primary transition-colors duration-300" />

                <div className="space-y-3">
                  {/* Card Header & Counter */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <span className="text-[10px] text-primary/70 font-mono">
                        Bölüm {index + 1}:
                      </span>
                      <span className="truncate max-w-[150px] sm:max-w-none">
                        {box.name}
                      </span>
                    </div>

                    {/* Card Index Indicator */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                      <FileText className="size-3" />
                      <span>{box.noteCount || 0} Fiş</span>
                    </div>
                  </div>

                  {/* Jüri Standartlarında Açıklama */}
                  <p className="text-xs text-muted-foreground leading-relaxed font-sans line-clamp-4 min-h-[4.5rem]">
                    {box.description ||
                      "Bu tematik çalışma odası için açıklama eklenmemiş."}
                  </p>
                </div>

                {/* Dashboard Kartoteks Interaction Trigger */}
                <div className="mt-4 pt-3 border-t border-border/60">
                  <Link
                    href={`/library?boxId=${box.id}`}
                    className="flex items-center justify-center w-full py-2 border border-dashed border-border/80 group-hover:border-primary/30 rounded text-[10px] text-muted-foreground group-hover:text-primary font-bold uppercase tracking-wider transition-all duration-300 hover:bg-primary/5 bg-transparent"
                  >
                    <Plus className="size-3 mr-1.5" />
                    <span>Fiş veya Not Fırlat</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
