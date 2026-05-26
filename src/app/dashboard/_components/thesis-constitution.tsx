"use client";

import React from "react";
import { GraduationCap } from "lucide-react";
import { ThesisCoreData } from "../actions";

interface ThesisConstitutionProps {
  thesisData: ThesisCoreData;
}

export function ThesisConstitution({ thesisData }: ThesisConstitutionProps) {
  return (
    <>
      {/* TEZ ANAYASASI - Mobil Yatay Kaydırma */}
      <div className="lg:hidden space-y-2 mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
          <GraduationCap className="size-4 text-primary" />
          <span>Tez Anayasası Özet</span>
        </h2>
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
      <div className="hidden lg:block w-full border border-border bg-card p-6 rounded-lg shadow-xl space-y-6 mb-8">
        <div className="pb-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            <span>Tez Anayasası</span>
          </h2>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">
            Tezin teorik çatısı — stratejik parametreler ve yön belirleyiciler
          </p>
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
                <p className="text-xs text-muted-foreground leading-relaxed">
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
                <p className="text-xs text-muted-foreground leading-relaxed">
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
                <p className="text-xs text-muted-foreground leading-relaxed">
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
