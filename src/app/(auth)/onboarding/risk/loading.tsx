"use client";

import { useEffect } from "react";
import { OnboardingGlobalLoader } from "@/components/ui/onboarding-global-loader";
import { useOnboardingStore } from "@/lib/store/onboarding-store";

/**
 * Next.js native page loading fallback (F5 / hard navigation).
 * Forces the global onboarding loader into a visible "initial" state so the
 * user sees a meaningful loading screen while the risk route segment loads.
 */
export default function RiskLoading() {
  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);

  useEffect(() => {
    showLoading(
      "Risk Analiz Motorları Çalışıyor",
      "Tez matrisiniz inceleniyor, veri tabanları taranıyor ve risk raporu hazırlanıyor.",
      [
        {
          text: "Sorgu ve doğrulama parametreleri üretiliyor...",
          status: "active",
        },
        {
          text: "Tavily ve Tezara paralel motorları koşturuluyor...",
          status: "idle",
        },
        {
          text: "Karşılaştırmalı literatür matrisi yapılandırılıyor...",
          status: "idle",
        },
        {
          text: "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...",
          status: "idle",
        },
      ],
    );

    return () => {
      hideLoading();
    };
  }, [showLoading, hideLoading]);

  return <OnboardingGlobalLoader />;
}
