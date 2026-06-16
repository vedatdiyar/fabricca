"use client";

import { useEffect } from "react";
import { AlertTriangle, WifiOff, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getErrorDisplay,
  type ErrorDisplay as ErrorDisplayType,
} from "@/lib/error-utils";

interface ErrorDisplayProps {
  /**
   * Maskelenecek orijinal hata.
   * Error, string veya herhangi bir obje olabilir.
   * Logger ile terminale yazılır ama kullanıcıya sızmaz.
   */
  error: unknown;
  /**
   * "Yeniden Dene" butonuna tıklandığında çağrılacak callback.
   * canRetry === false ise buton render edilmez.
   * undefined ise buton render edilmez.
   */
  onRetry?: () => void;
}

const SCENARIO_CONFIG: Record<
  ErrorDisplayType["scenario"],
  {
    Icon: typeof AlertTriangle;
    containerBorder: string;
    iconBorder: string;
    iconColor: string;
    buttonVariant: "default" | "outline" | "secondary";
  }
> = {
  quota: {
    Icon: Clock,
    containerBorder: "border-warning/20 bg-warning/10",
    iconBorder: "border-warning/20",
    iconColor: "text-warning",
    buttonVariant: "secondary",
  },
  network: {
    Icon: WifiOff,
    containerBorder: "border-info/20 bg-info/10",
    iconBorder: "border-info/20",
    iconColor: "text-info",
    buttonVariant: "outline",
  },
  system: {
    Icon: AlertTriangle,
    containerBorder: "border-destructive/20 bg-destructive/10",
    iconBorder: "border-destructive/20",
    iconColor: "text-destructive",
    buttonVariant: "default",
  },
};

/**
 * Global Hata Maskeleme Bileşeni.
 *
 * Herhangi bir hata nesnesini alır, otomatik olarak sınıflandırır
 * ve kullanıcıya güvenli, anlaşılır bir başlık + açıklama çifti
 * olarak gösterir. Orijinal hata detayı asla ekrana sızmaz;
 * sadece console.error ile terminale yazılır.
 *
 * @example
 *   <ErrorDisplay error={someError} onRetry={handleRetry} />
 */
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const display = getErrorDisplay(error);
  const config = SCENARIO_CONFIG[display.scenario];
  const { Icon } = config;

  useEffect(() => {
    console.error("[ErrorDisplay]", display.scenario, error);
  }, [error, display.scenario]);

  return (
    <main className="error-display-container">
      <div className="error-display-content">
        <div className={`error-display-icon-wrapper ${config.containerBorder}`}>
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            {display.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {display.description}
          </p>
        </div>

        {display.canRetry && onRetry && (
          <Button
            onClick={onRetry}
            variant={config.buttonVariant}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
            Yeniden Dene
          </Button>
        )}
      </div>
    </main>
  );
}
