"use client";

import React from "react";
import { LayoutDashboard } from "lucide-react";

export function DashboardHeader() {
  return (
    <header className="border-b border-border pb-6 mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <LayoutDashboard className="size-6 text-primary" />
          <span>Tez Karargahı</span>
        </h1>
        <p className="text-sm text-muted-foreground font-sans">
          Tez sürecinizi organize edin, anayasanızı takip edin ve akıllı
          önerilerle literatürünüzü geliştirin
        </p>
      </div>
    </header>
  );
}
