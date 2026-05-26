"use client";

import React from "react";
import { GraduationCap } from "lucide-react";

interface DashboardLoadingProps {
  redirecting?: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function DashboardLoading({
  redirecting,
  isLoading,
  error,
  onRetry,
}: DashboardLoadingProps) {
  // 1. Redirection fallback state (lack of thesis core constitution)
  if (redirecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-6 bg-background">
        <div className="size-16 rounded-full border border-primary flex items-center justify-center bg-card shadow-xl">
          <GraduationCap className="size-8 text-primary animate-bounce" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground font-sans">
            Tez Kurulumu Algılanmadı
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto font-sans leading-relaxed">
            Fabricca Tez Karargahı&apos;nı kullanabilmek için öncelikle Tez
            Anayasası&apos;nı oluşturmalısınız. Sohbet mülakatına
            yönlendiriliyorsunuz...
          </p>
        </div>
        <div className="w-16 h-0.5 bg-primary animate-pulse" />
      </div>
    );
  }

  // 2. Beautiful cyberloading state using custom CSS variables
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute size-16 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="size-10 rounded-full bg-card border border-border flex items-center justify-center">
            <GraduationCap className="size-5 text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-sans tracking-widest text-primary mt-6 animate-pulse uppercase">
          Tez Karargahı Yükleniyor...
        </p>
        <p className="text-xs font-sans text-muted-foreground mt-2">
          Veritabanı bağlantısı ve tez anayasası senkronize ediliyor
        </p>
      </div>
    );
  }

  // 3. Error fallback state
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-4 bg-background">
        <p className="text-sm text-destructive bg-card border border-destructive p-4 rounded-lg max-w-md">
          {error}
        </p>
        <button
          onClick={onRetry || (() => window.location.reload())}
          className="text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition cursor-pointer"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  return null;
}
