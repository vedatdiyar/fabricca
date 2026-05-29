"use client";

import React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export function MissingThesisConstitution() {
  return (
    <div className="w-full border border-border bg-card p-6 rounded-lg shadow-xl relative overflow-hidden mb-8">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary animate-pulse" />
            <span>Tez Anayasası Bulunamadı</span>
          </h2>
          <p className="text-sm text-muted-foreground font-sans max-w-2xl leading-relaxed">
            Fabricca&apos;nın akıllı RAG danışmanı, literatür tavsiyeleri ve
            yapay zeka entegrasyon özelliklerinden tam verim alabilmek için
            öncelikle Tez Anayasası&apos;nı oluşturmalısınız. Prof. Dr. Verita
            ile 4 adımlı sohbet mülakatına hemen başlayın.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 hover:opacity-90 transition-all shadow-md shrink-0 cursor-pointer"
        >
          Tez Anayasası Oluştur
        </Link>
      </div>
    </div>
  );
}
