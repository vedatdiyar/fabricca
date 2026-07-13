"use client";

import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

interface AIBannerProps {
  variant?: "info" | "success" | "warning";
  icon?: LucideIcon;
  title: string;
  description: string;
}

const variantStyles: Record<string, string> = {
  info: "border-primary/20 bg-primary/10",
  success: "border-success/20 bg-success/10",
  warning: "border-warning/20 bg-warning/10",
};

const iconColors: Record<string, string> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
};

/**
 * AIBanner — merkezi AI bilgilendirme banner'ı.
 * Yapay zeka işlemleri hakkında kullanıcıyı bilgilendirmek için
 * onboarding sayfalarında kullanılır.
 *
 * @param props.variant - "info" (varsayılan), "success" veya "warning"
 * @param props.icon - Lucide ikonu (varsayılan: Sparkles)
 * @param props.title - Banner başlığı
 * @param props.description - Banner açıklama metni
 */
export function AIBanner({
  variant = "info",
  icon: Icon = Sparkles,
  title,
  description,
}: AIBannerProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border ${variantStyles[variant]} px-4 py-3 w-full animate-in fade-in slide-in-from-top-2 duration-300`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColors[variant]}`} />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
